-- AlterTable
ALTER TABLE "GitPOAP" ADD COLUMN     "gitPOAPRequestId" INTEGER;

-- AddForeignKey
ALTER TABLE "GitPOAP" ADD CONSTRAINT "GitPOAP_gitPOAPRequestId_fkey" FOREIGN KEY ("gitPOAPRequestId") REFERENCES "GitPOAPRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;