# Community packs — licensing & attribution

Content beyond the SRD 5.1 set is sourced **exclusively from open-licensed (Open Game
License 1.0a) community content**, aggregated via the [Open5e](https://open5e.com) API
(`api.open5e.com`). Each seeded row stores its own `source` + `license` so attribution
is exact and per-entry. Copyrighted PHB-only content (Assassin, Arcane Trickster, etc.)
is **never** vendored — no legitimate open source distributes it.

## What is vendored here (all OGL 1.0a)
| File | Content | Sources (publisher) |
|------|---------|---------------------|
| `data/community-subclasses.json` | 97 subclasses for the 12 SRD classes | Open5e Originals (Open5e) · Tome of Heroes (Kobold Press) · Tal’Dorei Campaign Setting (Green Ronin Publishing) |
| `data/community-backgrounds.json` | 41 backgrounds | Advanced 5e / Adventurer's Guide (EN Publishing) · Open5e Originals · Tome of Heroes (Kobold Press) · Tal’Dorei (Green Ronin) |

The seed dedupes community entries by `slug` against the SRD set (SRD wins on collision)
and upserts with each entry's own `source`/`license`.

## OGL 1.0a — Section 15 (COPYRIGHT NOTICE)
The full Open Game License 1.0a must accompany any distribution of this content. Section 15
copyright chain for the vendored sources:

```
Open Game License v 1.0a © 2000, Wizards of the Coast, Inc.
System Reference Document 5.1 © 2016, Wizards of the Coast, Inc.; Authors Mike Mearls, Jeremy Crawford, et al.
Open5e (open5e.com) content, © Open5e; available under the OGL 1.0a.
Tome of Heroes © 2022 Open Design LLC (Kobold Press); available under the OGL 1.0a.
Tal'Dorei Campaign Setting © 2017 Green Ronin Publishing, LLC; available under the OGL 1.0a.
Advanced 5th Edition / Adventurer's Guide © EN Publishing; available under the OGL 1.0a.
```

> Aggregation and machine-readable shaping by the Open5e project. The app surfaces the
> per-row `source`/`license` in the Characters UI (subclass cards) and this notice file.

System Reference Document 5.1 © Wizards of the Coast LLC is also available under CC-BY-4.0
(see `SRD-5.1-CC-BY-4.0.md`).
