# SRD 5.1 — Attribution & License

The reference data seeded by `prisma/seed/index.ts` (spells, items, monsters) is
derived from the **System Reference Document 5.1 ("SRD 5.1")**.

> This work includes material from the System Reference Document 5.1
> ("SRD 5.1") by Wizards of the Coast LLC and available under the
> **Creative Commons Attribution 4.0 International License** (CC-BY-4.0).
> https://creativecommons.org/licenses/by/4.0/legalcode

## Source dataset
The JSON in `prisma/seed/data/` was vendored from the open
**[5e-bits/5e-database](https://github.com/5e-bits/5e-database)** project
(`src/2014/en/`), which packages SRD 5.1 content. The dataset code is MIT
licensed; the **game content** it carries is SRD 5.1 under CC-BY-4.0 as above.

Only SRD 5.1 material is included — no non-SRD content.

## Files
- `data/Spells.json` — SRD spells
- `data/Monsters.json` — SRD monsters / statblocks
- `data/Equipment.json` — SRD mundane equipment (weapons, armor, gear)
- `data/Magic-Items.json` — SRD magic items

The in-app attribution line is rendered in the Reference footer (see
`app/reference/`), satisfying the CC-BY-4.0 attribution requirement.
