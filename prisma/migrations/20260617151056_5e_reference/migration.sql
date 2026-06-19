-- CreateTable
CREATE TABLE "Spell" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "school" TEXT NOT NULL,
    "castingTime" TEXT NOT NULL,
    "range" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "components" TEXT NOT NULL,
    "ritual" BOOLEAN NOT NULL DEFAULT false,
    "concentration" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "higherLevels" TEXT,
    "classesJson" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SRD 5.1'
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rarity" TEXT NOT NULL DEFAULT 'mundane',
    "requiresAttunement" BOOLEAN NOT NULL DEFAULT false,
    "propertiesJson" TEXT NOT NULL DEFAULT '{}',
    "description" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SRD 5.1'
);

-- CreateTable
CREATE TABLE "Monster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "alignment" TEXT NOT NULL,
    "cr" TEXT NOT NULL,
    "crSort" REAL NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "ac" INTEGER NOT NULL,
    "acNote" TEXT,
    "hp" INTEGER NOT NULL,
    "hpFormula" TEXT,
    "speed" TEXT NOT NULL,
    "abilityScores" TEXT NOT NULL,
    "savesJson" TEXT NOT NULL DEFAULT '{}',
    "skillsJson" TEXT NOT NULL DEFAULT '{}',
    "senses" TEXT,
    "languages" TEXT,
    "immunitiesJson" TEXT NOT NULL DEFAULT '{}',
    "resistancesJson" TEXT NOT NULL DEFAULT '[]',
    "traitsJson" TEXT NOT NULL DEFAULT '[]',
    "actionsJson" TEXT NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL DEFAULT 'SRD 5.1'
);

-- CreateIndex
CREATE UNIQUE INDEX "Spell_slug_key" ON "Spell"("slug");

-- CreateIndex
CREATE INDEX "Spell_level_idx" ON "Spell"("level");

-- CreateIndex
CREATE INDEX "Spell_school_idx" ON "Spell"("school");

-- CreateIndex
CREATE INDEX "Spell_name_idx" ON "Spell"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Item_slug_key" ON "Item"("slug");

-- CreateIndex
CREATE INDEX "Item_type_idx" ON "Item"("type");

-- CreateIndex
CREATE INDEX "Item_rarity_idx" ON "Item"("rarity");

-- CreateIndex
CREATE INDEX "Item_name_idx" ON "Item"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Monster_slug_key" ON "Monster"("slug");

-- CreateIndex
CREATE INDEX "Monster_crSort_idx" ON "Monster"("crSort");

-- CreateIndex
CREATE INDEX "Monster_type_idx" ON "Monster"("type");

-- CreateIndex
CREATE INDEX "Monster_size_idx" ON "Monster"("size");

-- CreateIndex
CREATE INDEX "Monster_name_idx" ON "Monster"("name");
