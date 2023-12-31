import { GithubIssue } from '@prisma/client';
import { context } from '../context';
import { createScopedLogger } from '../logging';

export async function upsertGithubIssue(
  repoId: number,
  githubIssueNumber: number,
  githubTitle: string,
  githubCreatedAt: Date,
  githubClosedAt: Date | null,
  githubUserId: number,
): Promise<GithubIssue> {
  const logger = createScopedLogger('upsertGithubIssue');

  logger.info(`Upserting Issue #${githubIssueNumber}`);

  return await context.prisma.githubIssue.upsert({
    where: {
      repoId_githubIssueNumber: {
        repoId,
        githubIssueNumber,
      },
    },
    update: {
      githubTitle,
      githubCreatedAt,
      githubClosedAt,
    },
    create: {
      githubIssueNumber,
      githubTitle,
      githubCreatedAt,
      githubClosedAt,
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
