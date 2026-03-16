-- AlterTable
ALTER TABLE "Idea" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Idea_isHidden_idx" ON "Idea"("isHidden");
