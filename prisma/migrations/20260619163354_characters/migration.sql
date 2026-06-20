-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hitDie" INTEGER NOT NULL,
    "primaryAbility" TEXT NOT NULL,
    "savesJson" TEXT NOT NULL,
    "armorProfJson" TEXT NOT NULL DEFAULT '[]',
    "weaponProfJson" TEXT NOT NULL DEFAULT '[]',
    "toolProfJson" TEXT NOT NULL DEFAULT '[]',
    "skillChoicesJson" TEXT NOT NULL DEFAULT '{}',
    "spellcastingJson" TEXT,
    "subclassLevel" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'SRD 5.1',
    "license" TEXT NOT NULL DEFAULT 'CC-BY-4.0'
);

-- CreateTable
CREATE TABLE "Subclass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "classSlug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "flavor" TEXT,
    "description" TEXT,
    "featuresByLevelJson" TEXT NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT 'SRD 5.1',
    "license" TEXT NOT NULL DEFAULT 'CC-BY-4.0'
);

-- CreateTable
CREATE TABLE "ClassLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classSlug" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "proficiencyBonus" INTEGER NOT NULL,
    "featuresJson" TEXT NOT NULL DEFAULT '[]',
    "spellSlotsJson" TEXT NOT NULL DEFAULT '{}',
    "classCountersJson" TEXT NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT 'SRD 5.1'
);

-- CreateTable
CREATE TABLE "Feature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classSlug" TEXT,
    "subclassSlug" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SRD 5.1',
    "license" TEXT NOT NULL DEFAULT 'CC-BY-4.0'
);

-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentRaceSlug" TEXT,
    "abilityBonusesJson" TEXT NOT NULL DEFAULT '{}',
    "size" TEXT NOT NULL DEFAULT 'Medium',
    "speed" INTEGER NOT NULL DEFAULT 30,
    "traitsJson" TEXT NOT NULL DEFAULT '[]',
    "proficienciesJson" TEXT NOT NULL DEFAULT '{}',
    "languagesJson" TEXT NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL DEFAULT 'SRD 5.1',
    "license" TEXT NOT NULL DEFAULT 'CC-BY-4.0'
);

-- CreateTable
CREATE TABLE "Background" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "skillProficienciesJson" TEXT NOT NULL DEFAULT '[]',
    "toolProficienciesJson" TEXT NOT NULL DEFAULT '[]',
    "languagesJson" TEXT NOT NULL DEFAULT '[]',
    "featureJson" TEXT NOT NULL DEFAULT '{}',
    "startingEquipment" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SRD 5.1',
    "license" TEXT NOT NULL DEFAULT 'CC-BY-4.0'
);

-- CreateTable
CREATE TABLE "Character" (
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
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Character_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CharacterSpell" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "spellSlug" TEXT NOT NULL,
    "known" BOOLEAN NOT NULL DEFAULT true,
    "prepared" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "CharacterSpell_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterSpell_spellSlug_fkey" FOREIGN KEY ("spellSlug") REFERENCES "Spell" ("slug") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlayerSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "characterId" TEXT,
    "isConnected" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerSession_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerSession_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PlayerSession" ("campaignId", "characterId", "connectedAt", "displayName", "id", "isConnected", "lastSeenAt", "role", "sessionToken") SELECT "campaignId", "characterId", "connectedAt", "displayName", "id", "isConnected", "lastSeenAt", "role", "sessionToken" FROM "PlayerSession";
DROP TABLE "PlayerSession";
ALTER TABLE "new_PlayerSession" RENAME TO "PlayerSession";
CREATE UNIQUE INDEX "PlayerSession_characterId_key" ON "PlayerSession"("characterId");
CREATE INDEX "PlayerSession_campaignId_idx" ON "PlayerSession"("campaignId");
CREATE UNIQUE INDEX "PlayerSession_campaignId_displayName_key" ON "PlayerSession"("campaignId", "displayName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Class_slug_key" ON "Class"("slug");

-- CreateIndex
CREATE INDEX "Class_name_idx" ON "Class"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Subclass_slug_key" ON "Subclass"("slug");

-- CreateIndex
CREATE INDEX "Subclass_classSlug_idx" ON "Subclass"("classSlug");

-- CreateIndex
CREATE INDEX "Subclass_name_idx" ON "Subclass"("name");

-- CreateIndex
CREATE INDEX "ClassLevel_classSlug_idx" ON "ClassLevel"("classSlug");

-- CreateIndex
CREATE UNIQUE INDEX "ClassLevel_classSlug_level_key" ON "ClassLevel"("classSlug", "level");

-- CreateIndex
CREATE UNIQUE INDEX "Feature_slug_key" ON "Feature"("slug");

-- CreateIndex
CREATE INDEX "Feature_classSlug_idx" ON "Feature"("classSlug");

-- CreateIndex
CREATE INDEX "Feature_subclassSlug_idx" ON "Feature"("subclassSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Race_slug_key" ON "Race"("slug");

-- CreateIndex
CREATE INDEX "Race_parentRaceSlug_idx" ON "Race"("parentRaceSlug");

-- CreateIndex
CREATE INDEX "Race_name_idx" ON "Race"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Background_slug_key" ON "Background"("slug");

-- CreateIndex
CREATE INDEX "Background_name_idx" ON "Background"("name");

-- CreateIndex
CREATE INDEX "Character_campaignId_idx" ON "Character"("campaignId");

-- CreateIndex
CREATE INDEX "Character_ownerSessionId_idx" ON "Character"("ownerSessionId");

-- CreateIndex
CREATE INDEX "CharacterSpell_characterId_idx" ON "CharacterSpell"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterSpell_characterId_spellSlug_key" ON "CharacterSpell"("characterId", "spellSlug");
