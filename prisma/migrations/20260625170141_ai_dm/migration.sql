-- CreateTable
CREATE TABLE "AIDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "parsedJson" TEXT,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedEntityId" TEXT,
    "approvedEntityType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIDraft_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AIDraft_campaignId_status_idx" ON "AIDraft"("campaignId", "status");

-- CreateIndex
CREATE INDEX "AIDraft_campaignId_createdAt_idx" ON "AIDraft"("campaignId", "createdAt");
