-- CreateTable
CREATE TABLE "CharacterItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "itemSlug" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "attuned" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "CharacterItem_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterItem_itemSlug_fkey" FOREIGN KEY ("itemSlug") REFERENCES "Item" ("slug") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Character_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Character" ("abilityMethod", "ac", "backgroundSlug", "baseAbilitiesJson", "campaignId", "cha", "classSlug", "con", "conditionsJson", "createdAt", "currentHp", "dex", "id", "initiative", "int", "isNpc", "level", "maxHp", "name", "notes", "overridesJson", "ownerSessionId", "proficiencyBonus", "raceSlug", "savesJson", "skillsJson", "speed", "spellSlotsJson", "str", "subclassSlug", "subraceSlug", "tempHp", "updatedAt", "wis") SELECT "abilityMethod", "ac", "backgroundSlug", "baseAbilitiesJson", "campaignId", "cha", "classSlug", "con", "conditionsJson", "createdAt", "currentHp", "dex", "id", "initiative", "int", "isNpc", "level", "maxHp", "name", "notes", "overridesJson", "ownerSessionId", "proficiencyBonus", "raceSlug", "savesJson", "skillsJson", "speed", "spellSlotsJson", "str", "subclassSlug", "subraceSlug", "tempHp", "updatedAt", "wis" FROM "Character";
DROP TABLE "Character";
ALTER TABLE "new_Character" RENAME TO "Character";
CREATE INDEX "Character_campaignId_idx" ON "Character"("campaignId");
CREATE INDEX "Character_ownerSessionId_idx" ON "Character"("ownerSessionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CharacterItem_characterId_idx" ON "CharacterItem"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterItem_characterId_itemSlug_key" ON "CharacterItem"("characterId", "itemSlug");
