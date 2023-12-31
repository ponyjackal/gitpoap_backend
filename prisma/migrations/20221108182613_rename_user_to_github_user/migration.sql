/*
  Warnings:

  - A unique constraint covering the columns `[gitPOAPId,githubUserId]` on the table `Claim` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[repoId,githubUserId,pullRequestId]` on the table `GithubMention` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[repoId,githubUserId,issueId]` on the table `GithubMention` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Address" DROP CONSTRAINT "Address_githubUserId_fkey";

-- DropForeignKey
ALTER TABLE "AuthToken" DROP CONSTRAINT "AuthToken_githubId_fkey";

-- DropForeignKey
ALTER TABLE "Claim" DROP CONSTRAINT "Claim_userId_fkey";

-- DropForeignKey
ALTER TABLE "GithubIssue" DROP CONSTRAINT "GithubIssue_userId_fkey";

-- DropForeignKey
ALTER TABLE "GithubMention" DROP CONSTRAINT "GithubMention_userId_fkey";

-- DropForeignKey
ALTER TABLE "GithubPullRequest" DROP CONSTRAINT "GithubPullRequest_userId_fkey";

-- DropIndex
DROP INDEX "Claim_gitPOAPId_userId_key";

-- DropIndex
DROP INDEX "GithubMention_repoId_userId_issueId_key";

-- DropIndex
DROP INDEX "GithubMention_repoId_userId_pullRequestId_key";

-- AlterTable
ALTER TABLE "Claim" RENAME COLUMN "userId" TO "githubUserId";

-- AlterTable
ALTER TABLE "GithubIssue" RENAME COLUMN "userId" TO "githubUserId";

-- AlterTable
ALTER TABLE "GithubMention" RENAME COLUMN "userId" TO "githubUserId";

-- AlterTable
ALTER TABLE "GithubPullRequest" RENAME COLUMN "userId" TO "githubUserId";

-- AlterTable
ALTER TABLE "User" RENAME TO "GithubUser";

-- AlterTable
ALTER TABLE "GithubUser" RENAME CONSTRAINT "User_pkey" TO "GithubUser_pkey";

-- CreateIndex
CREATE UNIQUE INDEX "Claim_gitPOAPId_githubUserId_key" ON "Claim"("gitPOAPId", "githubUserId");

-- CreateIndex
CREATE UNIQUE INDEX "GithubMention_repoId_githubUserId_pullRequestId_key" ON "GithubMention"("repoId", "githubUserId", "pullRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "GithubMention_repoId_githubUserId_issueId_key" ON "GithubMention"("repoId", "githubUserId", "issueId");

-- RenameIndex
ALTER INDEX "User_githubId_key" RENAME TO "GithubUser_githubId_key";

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_githubUserId_fkey" FOREIGN KEY ("githubUserId") REFERENCES "GithubUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_githubUserId_fkey" FOREIGN KEY ("githubUserId") REFERENCES "GithubUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_githubId_fkey" FOREIGN KEY ("githubId") REFERENCES "GithubUser"("githubId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubPullRequest" ADD CONSTRAINT "GithubPullRequest_githubUserId_fkey" FOREIGN KEY ("githubUserId") REFERENCES "GithubUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubIssue" ADD CONSTRAINT "GithubIssue_githubUserId_fkey" FOREIGN KEY ("githubUserId") REFERENCES "GithubUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubMention" ADD CONSTRAINT "GithubMention_githubUserId_fkey" FOREIGN KEY ("githubUserId") REFERENCES "GithubUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
