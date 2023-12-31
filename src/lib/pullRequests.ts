import { createScopedLogger } from '../logging';
import { context } from '../context';
import {
  getGithubRepositoryPullsAsApp,
  OctokitPullListItem,
  OctokitPullItem,
} from '../external/github';
import { pullRequestBackloadDurationSeconds } from '../metrics';
import { upsertGithubUser } from './githubUsers';
import {
  YearlyGitPOAPsMap,
  createNewClaimsForRepoContribution,
  createYearlyGitPOAPsMap,
} from './claims';
import { GitPOAPStatus } from '@prisma/client';
import { DateTime } from 'luxon';

async function getRepoInfo(repoId: number) {
  const logger = createScopedLogger('getRepoInfo');

  const result = await context.prisma.repo.findMany({
    where: {
      id: repoId,
    },
    select: {
      id: true,
      name: true,
      organization: {
        select: {
          name: true,
        },
      },
      project: {
        select: {
          gitPOAPs: {
            where: {
              isPRBased: true,
              NOT: {
                poapApprovalStatus: GitPOAPStatus.DEPRECATED,
              },
            },
            select: {
              id: true,
              year: true,
              threshold: true,
              isPRBased: true,
            },
          },
          repos: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (result.length !== 1) {
    logger.error(`Found multiple repos with ID: ${repoId}`);
    return null;
  }

  return result[0];
}

// Helper function to either return the commit where this was merged
// or the last commit of the PR in case merge_commit_sha is null
export function extractMergeCommitSha(pr: OctokitPullListItem | OctokitPullItem) {
  if (pr.merge_commit_sha === null) {
    return pr.head.sha;
  }

  return pr.merge_commit_sha;
}

export async function upsertGithubPullRequest(
  repoId: number,
  githubPullNumber: number,
  githubTitle: string,
  githubCreatedAt: Date,
  githubMergedAt: Date | null,
  githubMergeCommitSha: string | null,
  githubUserId: number,
) {
  const logger = createScopedLogger('upsertGithubPullRequest');

  logger.info(`Upserting PR #${githubPullNumber}`);

  return await context.prisma.githubPullRequest.upsert({
    where: {
      repoId_githubPullNumber: {
        repoId,
        githubPullNumber,
      },
    },
    update: {
      githubTitle,
      githubCreatedAt,
      githubMergedAt,
      githubMergeCommitSha,
    },
    create: {
      githubPullNumber,
      githubTitle,
      githubCreatedAt,
      githubMergedAt,
      githubMergeCommitSha,
      repo: {
        connect: {
          id: repoId,
        },
      },
      githubUser: {
        connect: {
          id: githubUserId,
        },
      },
    },
  });
}

async function backloadGithubPullRequest(
  repo: {
    id: number;
    project: { repos: { id: number }[] };
  },
  yearlyGitPOAPsMap: YearlyGitPOAPsMap,
  pr: OctokitPullListItem,
) {
  const logger = createScopedLogger('backloadGithubPullRequest');

  if (pr.merged_at === null) {
    logger.debug(`Skipping unmerged PR #${pr.number}`);
    return;
  }

  if (pr.user === null) {
    logger.debug(`Skipping PR #${pr.number} with no user`);
    return;
  }

  logger.debug(`Handling PR #${pr.number}`);

  if (pr.user.type === 'Bot') {
    logger.info(`Skipping creating claims for bot ${pr.user.login}`);
    return;
  }

  const githubUser = await upsertGithubUser(pr.user.id, pr.user.login);

  const mergedAt = new Date(pr.merged_at);

  // Don't create the PR if it already is in the DB (maybe via ongoing issuance)
  // but update the title if it's changed
  const githubPullRequest = await upsertGithubPullRequest(
    repo.id,
    pr.number,
    pr.title,
    new Date(pr.created_at),
    mergedAt,
    extractMergeCommitSha(pr), // This must be final since it's been merged
    githubUser.id,
  );

  const claims = await createNewClaimsForRepoContribution(
    githubUser,
    repo.project.repos,
    yearlyGitPOAPsMap,
    { pullRequest: githubPullRequest },
  );

  for (const claim of claims) {
    // If this is the githubUser's first PR set the earned at field
    if (claim.pullRequestEarnedId === null) {
      logger.info(
        `Setting pullRequestEarned for Claim ID ${claim.id} to GithubPullRequest ID ${githubPullRequest.id} for user ${pr.user.login}`,
      );

      await context.prisma.claim.update({
        where: {
          id: claim.id,
        },
        data: {
          pullRequestEarned: {
            connect: {
              id: githubPullRequest.id,
            },
          },
        },
      });
    }
  }
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

  if (repoInfo.project.gitPOAPs.length === 0) {
    logger.warn(
      `No GitPOAPs found for repo with ID ${repoId} (Possibly since they are not PR-based)`,
    );
    return;
  }

  const yearlyGitPOAPsMap = createYearlyGitPOAPsMap(repoInfo.project.gitPOAPs);

  let page = 1;
  let isProcessing = true;

  while (isProcessing) {
    logger.debug(`Handling page #${page}`);

    const prData = await getGithubRepositoryPullsAsApp(
      repoInfo.organization.name,
      repoInfo.name,
      BACKFILL_PRS_PER_REQUEST,
      page++,
      'asc',
    );

    // If we've reached the last of the PRs, end after this loop
    if (prData.length < BACKFILL_PRS_PER_REQUEST) {
      isProcessing = false;
    }

    // Handle all the PRs individually (and sequentially)
    for (const pr of prData) {
      await backloadGithubPullRequest(repoInfo, yearlyGitPOAPsMap, pr);
    }
  }

  endTimer();

  logger.debug(
    `Finished backloading the historical PR data for repo ID: ${repoId} (${repoInfo.organization.name}/${repoInfo.name})`,
  );
}

// This should only be used by our background processes
async function getGithubRepositoryPullsMergedAfter(
  org: string,
  repo: string,
  mergedAfter: DateTime,
) {
  const logger = createScopedLogger('getGithubRepositoryPullsMergedAfter');

  let page = 1;
  let prsReceived = BACKFILL_PRS_PER_REQUEST;

  const reverseResults: Awaited<ReturnType<typeof getGithubRepositoryPullsAsApp>> = [];

  // We need to start from the most recent and construct the list
  // of PRs in reverse
  while (prsReceived === BACKFILL_PRS_PER_REQUEST) {
    const prs = await getGithubRepositoryPullsAsApp(
      org,
      repo,
      BACKFILL_PRS_PER_REQUEST,
      page++,
      'desc',
    );

    prsReceived = prs.length;

    for (const pr of prs) {
      // Skip non-merged PRs
      if (pr.merged_at === null) {
        continue;
      }

      // Stop early after we've reached the first irrelevant PR
      if (DateTime.fromISO(pr.merged_at) < mergedAfter) {
        const lastPRDesc = `#${pr.number} made on ${pr.merged_at}`;
        if (reverseResults.length === 0) {
          logger.debug(`Found no merged PRs to ${org}/${repo} after ${lastPRDesc}`);
        } else {
          const firstPR = reverseResults[reverseResults.length - 1];
          const firstPRDesc = `#${firstPR.number} made on ${firstPR.merged_at}`;
          logger.debug(
            `Found ${reverseResults.length} merged PRs to ${org}/${repo} starting on ${firstPRDesc} after ${lastPRDesc}`,
          );
        }

        return reverseResults.reverse();
      }

      reverseResults.push(pr);
    }
  }

  return reverseResults.reverse();
}

// We skip timing this since it is a special case
export async function backloadGithubPullRequestDataForPRsMergedAfter(
  repoId: number,
  mergedAfter: DateTime,
) {
  const logger = createScopedLogger('backloadGithubPullRequestDataForPRsMergedAfter');

  const repoInfo = await getRepoInfo(repoId);

  if (repoInfo === null) {
    logger.error(`Failed to look up repo with ID ${repoId}`);
    return;
  }

  const fullRepoName = `${repoInfo.organization.name}/${repoInfo.name}`;

  logger.info(
    `Backloading the historical PR data merged after ${mergedAfter} for repo ID: ${repoId} (${fullRepoName})`,
  );

  if (repoInfo.project.gitPOAPs.length === 0) {
    logger.warn(
      `No GitPOAPs found for repo with ID ${repoId} (Possibly since they are not PR-based)`,
    );
    return;
  }

  const yearlyGitPOAPsMap = createYearlyGitPOAPsMap(repoInfo.project.gitPOAPs);

  const prData = await getGithubRepositoryPullsMergedAfter(
    repoInfo.organization.name,
    repoInfo.name,
    mergedAfter,
  );

  logger.info(`Found ${prData.length} merged PRs after ${mergedAfter}`);

  // Handle all the PRs individually (and sequentially)
  for (const pr of prData) {
    await backloadGithubPullRequest(repoInfo, yearlyGitPOAPsMap, pr);
  }

  logger.debug(
    `Finished backloading the historical PR data merged after ${mergedAfter} for repo ID: ${repoId} (${fullRepoName})`,
  );
}
