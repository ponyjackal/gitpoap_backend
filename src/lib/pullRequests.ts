import { createScopedLogger } from '../logging';
import { context } from '../context';
import { GithubPullRequestData, getGithubRepositoryPullsAsAdmin } from '../external/github';
import { pullRequestBackloadDurationSeconds } from '../metrics';

type GitPOAPMap = Record<string, number>;

// Generate a year to GitPOAP ID map for a repository
async function generateGitPOAPMap(repoId: number): Promise<GitPOAPMap> {
  const gitPOAPs = await context.prisma.gitPOAP.findMany({
    where: {
      repoId,
    },
    select: {
      id: true,
      year: true,
    },
  });

  return gitPOAPs.reduce((gitPOAPMap, currentGitPOAP) => {
    return {
      ...gitPOAPMap,
      [currentGitPOAP.year.toString()]: currentGitPOAP.id,
    };
  }, {} as GitPOAPMap);
}

async function getRepoInfo(repoId: number) {
  return await context.prisma.repo.findUnique({
    where: {
      id: repoId,
    },
    select: {
      name: true,
      organization: {
        select: {
          name: true,
        },
      },
    },
  });
}

// Helper function to either return the commit where this was merged
// or the last commit of the PR in case merge_commit_sha is null
export function extractMergeCommitSha(pr: GithubPullRequestData) {
  if (pr.merge_commit_sha === null) {
    return pr.head.sha;
  }

  return pr.merge_commit_sha;
}

async function backloadGithubPullRequest(
  repoId: number,
  gitPOAPMap: GitPOAPMap,
  pr: GithubPullRequestData,
) {
  const logger = createScopedLogger('backloadGithubPullRequest');

  if (pr.merged_at === null) {
    logger.debug(`Skipping unmerged PR #${pr.number}`);
    return;
  }
  logger.debug(`Handling PR #${pr.number}`);

  const user = await context.prisma.user.upsert({
    where: {
      githubId: pr.user.id,
    },
    update: {
      githubHandle: pr.user.login,
    },
    create: {
      githubId: pr.user.id,
      githubHandle: pr.user.login,
    },
  });

  const mergedAt = new Date(pr.merged_at);
  const mergeCommitSha = extractMergeCommitSha(pr);

  // Don't create the PR if it already is in the DB (maybe via ongoing issuance)
  // but update the title if it's changed
  const githubPullRequest = await context.prisma.githubPullRequest.upsert({
    where: {
      repoId_githubPullNumber: {
        repoId,
        githubPullNumber: pr.number,
      },
    },
    update: {
      githubMergedAt: mergedAt,
      githubTitle: pr.title,
      githubMergeCommitSha: mergeCommitSha,
    },
    create: {
      githubPullNumber: pr.number,
      githubTitle: pr.title,
      githubMergedAt: mergedAt,
      githubMergeCommitSha: mergeCommitSha,
      repo: {
        connect: {
          id: repoId,
        },
      },
      user: {
        connect: {
          id: user.id,
        },
      },
    },
  });

  const gitPOAPId = gitPOAPMap[mergedAt.getFullYear().toString()];
  if (gitPOAPId === undefined) {
    logger.warn(`There's no GitPOAP for year ${mergedAt.getFullYear()}`);
    return;
  }

  // If this is the user's first PR to the repo in this particular year, mark
  // it as the one that earned them the claim
  await context.prisma.claim.updateMany({
    where: {
      gitPOAPId,
      userId: user.id,
      pullRequestEarned: null,
    },
    data: {
      pullRequestEarnedId: githubPullRequest.id,
    },
  });
}

const BACKFILL_PRS_PER_REQUEST = 100; // the max

export async function backloadGithubPullRequestData(repoId: number) {
  const logger = createScopedLogger('backloadGithubPullRequestData');

  const endTimer = pullRequestBackloadDurationSeconds.startTimer();

  const repoInfo = await getRepoInfo(repoId);

  if (repoInfo === null) {
    logger.error(`Failed to look up repo with ID ${repoId}`);
    return;
  }

  logger.info(
    `Backloading the historical PR data for repo ID: ${repoId} (${repoInfo.organization.name}/${repoInfo.name})`,
  );

  const gitPOAPMap = await generateGitPOAPMap(repoId);

  let page = 1;
  let isProcessing = true;

  while (isProcessing) {
    logger.debug(`Handling page #${page}`);

    const prData: GithubPullRequestData[] = await getGithubRepositoryPullsAsAdmin(
      repoInfo.organization.name,
      repoInfo.name,
      BACKFILL_PRS_PER_REQUEST,
      page++,
      'asc',
    );

    if (prData === null) {
      logger.error(`Failed to request page ${page - 1} of the PR data from GitHub`);
      return;
    }

    // If we've reached the last of the PRs, end after this loop
    if (prData.length < BACKFILL_PRS_PER_REQUEST) {
      isProcessing = false;
    }

    // Handle all the PRs individually
    await Promise.all(prData.map(pr => backloadGithubPullRequest(repoId, gitPOAPMap, pr)));
  }

  endTimer();

  logger.debug(
    `Finished backloading the historical PR data for repo ID: ${repoId} (${repoInfo.organization.name}/${repoInfo.name})`,
  );
}