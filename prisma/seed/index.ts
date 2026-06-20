// SRD 5.1 seed — idempotent upsert by `slug` (re-runnable).
// Reads vendored dnd5eapi JSON from prisma/seed/data/, transforms to our schema,
// and upserts. Reference tables are GLOBAL (no campaignId). Deterministic derived
// values (xp, crSort) are computed in transform.ts. License: prisma/seed/SRD-5.1-CC-BY-4.0.md
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { toSpellRow, toMonsterRow, toItemRow } from "./transform";
import {
  toClassRow, toSubclassRow, toClassLevelRow, toFeatureRow, toRaceRow, toBackgroundRow,
} from "./transform-characters";

const prisma = new PrismaClient();
const DATA = path.join(process.cwd(), "prisma", "seed", "data");
const load = <T>(file: string): T[] => JSON.parse(readFileSync(path.join(DATA, file), "utf8")) as T[];

async function chunkedUpsert<R extends { slug: string }>(
  label: string,
  rows: R[],
  upsertOne: (row: R) => Promise<unknown>,
) {
  const size = 100;
  for (let i = 0; i < rows.length; i += size) {
    await prisma.$transaction(rows.slice(i, i + size).map((r) => upsertOne(r)) as never);
  }
  console.log(`  ✔ ${label}: ${rows.length} rows`);
}

// Same batching but for rows without a single `slug` key (e.g. ClassLevel compound key).
async function runChunked(label: string, ops: (() => Promise<unknown>)[]) {
  const size = 100;
  for (let i = 0; i < ops.length; i += size) {
    await prisma.$transaction(ops.slice(i, i + size).map((op) => op()) as never);
  }
  console.log(`  ✔ ${label}: ${ops.length} rows`);
}

async function main() {
  console.log("Seeding SRD 5.1 reference data…");

  // Spells
  const spells = load<Parameters<typeof toSpellRow>[0]>("Spells.json").map(toSpellRow);
  await chunkedUpsert("spells", spells, (r) =>
    prisma.spell.upsert({ where: { slug: r.slug }, create: r, update: r }),
  );

  // Monsters
  const monsters = load<Parameters<typeof toMonsterRow>[0]>("Monsters.json").map(toMonsterRow);
  await chunkedUpsert("monsters", monsters, (r) =>
    prisma.monster.upsert({ where: { slug: r.slug }, create: r, update: r }),
  );

  // Items = Equipment + Magic-Items, de-duped by slug (first wins).
  const rawItems = [
    ...load<Parameters<typeof toItemRow>[0]>("Equipment.json"),
    ...load<Parameters<typeof toItemRow>[0]>("Magic-Items.json"),
  ].map(toItemRow);
  const seen = new Set<string>();
  const items = rawItems.filter((r) => (seen.has(r.slug) ? false : (seen.add(r.slug), true)));
  await chunkedUpsert("items", items, (r) =>
    prisma.item.upsert({ where: { slug: r.slug }, create: r, update: r }),
  );

  await seedCharacterReference();

  console.log("Done.");
}

// ── Characters reference (Sprint 2) ─────────────────────────────────
interface FeatureSrc { index?: string; name: string; class?: { index?: string }; subclass?: { index?: string }; level?: number; desc?: string[] }
interface CommunitySub {
  index: string; name: string; class: { index: string }; subclass_flavor?: string; desc?: string[];
  features?: Record<string, { name: string; desc: string }[]>; source?: string; license?: string;
}

async function seedCharacterReference() {
  console.log("Seeding Characters reference (SRD 5.1 + community)…");

  // Classes
  const classes = load<Parameters<typeof toClassRow>[0]>("Classes.json").map(toClassRow);
  await chunkedUpsert("classes", classes, (r) =>
    prisma.class.upsert({ where: { slug: r.slug }, create: r, update: r }),
  );

  // Features (class + subclass), from SRD
  const featuresSrc = load<FeatureSrc>("Features.json");
  const features = featuresSrc.map(toFeatureRow);

  // Group SRD subclass features by subclass slug → { level: [featureSlug] }
  const featsBySubclass: Record<string, Record<string, string[]>> = {};
  for (const f of featuresSrc) {
    const sc = f.subclass?.index;
    if (!sc) continue;
    const lvl = String(f.level ?? 1);
    (featsBySubclass[sc] ??= {})[lvl] ??= [];
    featsBySubclass[sc][lvl].push(f.index ?? "");
  }

  // Subclasses: SRD + community pack (deduped by slug, SRD wins)
  const srdSubs = load<Parameters<typeof toSubclassRow>[0]>("Subclasses.json").map((s) =>
    toSubclassRow(s, featsBySubclass[s.index ?? ""] ?? {}),
  );
  const community = load<CommunitySub>("community-subclasses.json");
  const communityRows = community.map((s) => {
    const byLevel: Record<string, string[]> = {};
    for (const [lvl, feats] of Object.entries(s.features ?? {})) byLevel[lvl] = feats.map((f) => f.name);
    return toSubclassRow(s, byLevel, { source: s.source, license: s.license });
  });
  // Community features → Feature rows
  for (const s of community) {
    for (const [lvl, feats] of Object.entries(s.features ?? {})) {
      for (const f of feats) {
        features.push({
          slug: `${s.index}-${f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`,
          name: f.name, classSlug: s.class.index, subclassSlug: s.index,
          level: Number(lvl) || 1, description: f.desc, source: s.source ?? "Community", license: s.license ?? "OGL-1.0a",
        });
      }
    }
  }
  const seenSub = new Set<string>();
  const subclasses = [...srdSubs, ...communityRows].filter((r) => (seenSub.has(r.slug) ? false : (seenSub.add(r.slug), true)));
  await chunkedUpsert("subclasses", subclasses, (r) =>
    prisma.subclass.upsert({ where: { slug: r.slug }, create: r, update: r }),
  );

  // Features (dedupe by slug)
  const seenFeat = new Set<string>();
  const featureRows = features.filter((r) => r.slug && (seenFeat.has(r.slug) ? false : (seenFeat.add(r.slug), true)));
  await chunkedUpsert("features", featureRows, (r) =>
    prisma.feature.upsert({ where: { slug: r.slug }, create: r, update: r }),
  );

  // Class levels (1–20 per class) — exclude subclass-specific level rows
  const levels = load<Parameters<typeof toClassLevelRow>[0]>("Levels.json")
    .filter((l) => l.class?.index && l.level && !l.subclass)
    .map(toClassLevelRow);
  await runChunked("class-levels", levels.map((r) => () =>
    prisma.classLevel.upsert({
      where: { classSlug_level: { classSlug: r.classSlug, level: r.level } },
      create: r, update: r,
    }),
  ));

  // Races + Subraces (one table)
  const races = [
    ...load<Parameters<typeof toRaceRow>[0]>("Races.json").map((r) => toRaceRow(r, false)),
    ...load<Parameters<typeof toRaceRow>[0]>("Subraces.json").map((r) => toRaceRow(r, true)),
  ];
  await chunkedUpsert("races", races, (r) =>
    prisma.race.upsert({ where: { slug: r.slug }, create: r, update: r }),
  );

  // Backgrounds: SRD (Acolyte) + open community packs (OGL, already row-shaped)
  const srdBg = load<Parameters<typeof toBackgroundRow>[0]>("Backgrounds.json").map(toBackgroundRow);
  const communityBg = load<(typeof srdBg)[number]>("community-backgrounds.json");
  const seenBg = new Set<string>();
  const backgrounds = [...srdBg, ...communityBg].filter((r) => (seenBg.has(r.slug) ? false : (seenBg.add(r.slug), true)));
  await chunkedUpsert("backgrounds", backgrounds, (r) =>
    prisma.background.upsert({ where: { slug: r.slug }, create: r, update: r }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
