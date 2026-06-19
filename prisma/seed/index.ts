// SRD 5.1 seed — idempotent upsert by `slug` (re-runnable).
// Reads vendored dnd5eapi JSON from prisma/seed/data/, transforms to our schema,
// and upserts. Reference tables are GLOBAL (no campaignId). Deterministic derived
// values (xp, crSort) are computed in transform.ts. License: prisma/seed/SRD-5.1-CC-BY-4.0.md
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { toSpellRow, toMonsterRow, toItemRow } from "./transform";

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

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
