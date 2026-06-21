-- CreateTable
CREATE TABLE "DiceRoll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "playerSessionId" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "result" INTEGER NOT NULL,
    "rolls" TEXT NOT NULL,
    "context" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'normal',
    "keptRoll" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiceRoll_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DiceRoll_playerSessionId_fkey" FOREIGN KEY ("playerSessionId") REFERENCES "PlayerSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "ownerSessionId" TEXT,
    "isNpc" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "raceSlug" TEXT NOT NULL,
    "subraceSlug" TEXT,
    "classSlug" TEXT NOT NULL,
    "subclassSlug" TEXT,
    "backgroundSlug" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "str" INTEGER NOT NULL,
    "dex" INTEGER NOT NULL,
    "con" INTEGER NOT NULL,
    "int" INTEGER NOT NULL,
    "wis" INTEGER NOT NULL,
    "cha" INTEGER NOT NULL,
    "abilityMethod" TEXT NOT NULL DEFAULT 'standard-array',
    "baseAbilitiesJson" TEXT NOT NULL DEFAULT '{}',
    "proficiencyBonus" INTEGER NOT NULL DEFAULT 2,
    "maxHp" INTEGER NOT NULL DEFAULT 1,
    "currentHp" INTEGER NOT NULL DEFAULT 1,
    "tempHp" INTEGER NOT NULL DEFAULT 0,
    "ac" INTEGER NOT NULL DEFAULT 10,
    "speed" INTEGER NOT NULL DEFAULT 30,
    "initiative" INTEGER NOT NULL DEFAULT 0,
    "savesJson" TEXT NOT NULL DEFAULT '{}',
    "skillsJson" TEXT NOT NULL DEFAULT '{}',
    "spellSlotsJson" TEXT NOT NULL DEFAULT '{}',
    "conditionsJson" TEXT NOT NULL DEFAULT '[]',
    "overridesJson" TEXT NOT NULL DEFAULT '[]',
    "currencyJson" TEXT NOT NULL DEFAULT '{}',
    "spellSlotsUsedJson" TEXT NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Character_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Character" ("abilityMethod", "ac", "backgroundSlug", "baseAbilitiesJson", "campaignId", "cha", "classSlug", "con", "conditionsJson", "createdAt", "currencyJson", "currentHp", "dex", "id", "initiative", "int", "isNpc", "level", "maxHp", "name", "notes", "overridesJson", "ownerSessionId", "proficiencyBonus", "raceSlug", "savesJson", "skillsJson", "speed", "spellSlotsJson", "str", "subclassSlug", "subraceSlug", "tempHp", "updatedAt", "wis") SELECT "abilityMethod", "ac", "backgroundSlug", "baseAbilitiesJson", "campaignId", "cha", "classSlug", "con", "conditionsJson", "createdAt", "currencyJson", "currentHp", "dex", "id", "initiative", "int", "isNpc", "level", "maxHp", "name", "notes", "overridesJson", "ownerSessionId", "proficiencyBonus", "raceSlug", "savesJson", "skillsJson", "speed", "spellSlotsJson", "str", "subclassSlug", "subraceSlug", "tempHp", "updatedAt", "wis" FROM "Character";
DROP TABLE "Character";
ALTER TABLE "new_Character" RENAME TO "Character";
CREATE INDEX "Character_campaignId_idx" ON "Character"("campaignId");
CREATE INDEX "Character_ownerSessionId_idx" ON "Character"("ownerSessionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DiceRoll_campaignId_idx" ON "DiceRoll"("campaignId");

-- CreateIndex
CREATE INDEX "DiceRoll_campaignId_createdAt_idx" ON "DiceRoll"("campaignId", "createdAt");
