-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "title" TEXT,
    "date" DATETIME NOT NULL,
    "summary" TEXT,
    "xpAwarded" INTEGER NOT NULL DEFAULT 0,
    "notableLoot" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "giverName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "objectivesJson" TEXT NOT NULL DEFAULT '[]',
    "reward" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quest_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Npc" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "characterId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "faction" TEXT,
    "notes" TEXT,
    "isAlive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Npc_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Npc_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "sessionId" TEXT,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JournalEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JournalEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Session_campaignId_idx" ON "Session"("campaignId");

-- CreateIndex
CREATE INDEX "Session_campaignId_date_idx" ON "Session"("campaignId", "date");

-- CreateIndex
CREATE INDEX "Quest_campaignId_idx" ON "Quest"("campaignId");

-- CreateIndex
CREATE INDEX "Quest_campaignId_status_idx" ON "Quest"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Npc_campaignId_idx" ON "Npc"("campaignId");

-- CreateIndex
CREATE INDEX "Npc_campaignId_faction_idx" ON "Npc"("campaignId", "faction");

-- CreateIndex
CREATE INDEX "Npc_campaignId_isAlive_idx" ON "Npc"("campaignId", "isAlive");

-- CreateIndex
CREATE INDEX "JournalEntry_campaignId_idx" ON "JournalEntry"("campaignId");

-- CreateIndex
CREATE INDEX "JournalEntry_campaignId_createdAt_idx" ON "JournalEntry"("campaignId", "createdAt");
