# VISION — D&D Campaign Manager (multiplayer, local)

> Program-level "what". Source of truth for scope and the module map.
> Companion docs: [ARCHITECTURE.md](./ARCHITECTURE.md) (how, shared) · [DATA_MODEL.md](./DATA_MODEL.md) (the data) · [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) (the look) · [ROADMAP.md](./ROADMAP.md) (where we are).

## One-liner
A self-hosted, local-first tool for running tabletop **D&D 5e** campaigns where the **Dungeon Master and players play together in real time**. The DM prepares and runs the game; each player drives their own character sheet; a live, server-authoritative combat tracker keeps the whole table in sync over the same Wi-Fi.

## Goal
Make a real, in-person D&D session **playable end-to-end** on laptops/tablets around one table — without cloud services, accounts, or per-token AI costs.

## Scope (v1)
- DM creates a campaign → invite code → players join over LAN at `http://<dm-ip>:3000`.
- Players create/claim a **5e character** and own their sheet (HP, slots, inventory).
- A **live combat tracker** (initiative, HP, 5e conditions, turn order) synced to every screen.
- 5e **reference data** (spells/items/monsters) seeded from **SRD 5.1**.
- **Story** tooling: sessions, quests, NPCs, journal.
- A **dice roller** that broadcasts results to the table; a DM dashboard; global search.
- An **AI DM Assistant** that is **free-first**: local Ollama by default + an "Import from Claude" paste path. AI output is always a **DM-approved draft**, never live state.

### Locked decisions (do not re-litigate)
- Players are first-class users, not just a DM admin tool.
- Hosting is **same-room LAN only**; no cloud, no paid services.
- Real-time and **server-authoritative**: server owns HP/initiative/turn; clients are synced views.
- **Lightweight join** (invite code + display name + character claim), not heavy auth.
- Ruleset is **D&D 5e, full**.
- AI is optional and free-first; a paid Anthropic API adapter is **out of scope for v1** (the interface exists so it can be added later without a refactor).

## Non-goals (v1)
- Remote/internet play via tunnel (LAN only).
- Accounts/billing/multi-DM permissions beyond DM-vs-player.
- VTT-grade battle maps with grid movement & fog of war.
- Homebrew rules engine beyond 5e.
- Paid Anthropic API integration; auto-applying AI output; the LLM doing rules math.

## Definition of "playable" (the gameplay loop)
1. DM creates a campaign → gets an invite code.
2. Players join with the code, create or claim a 5e character.
3. DM starts a session; everyone sees the shared session screen.
4. DM starts an encounter → live combat tracker: initiative order, HP, conditions, whose turn.
5. Players act on their turn, roll dice (results broadcast), update their HP/resources.
6. DM logs the session, awards loot/XP, advances the story.

## Users & roles
- **Dungeon Master (DM):** creates the campaign/room, manages NPCs/monsters/encounters, controls the live combat tracker, reveals information. Full read/write.
- **Player:** joins via invite code, owns one character, edits their own sheet, rolls dice (broadcast to the table), sees initiative/turn order during combat.

## Module Map
| Module | Purpose (5e-aware) | Depends on |
|--------|--------------------|------------|
| **Foundation** | scaffold, campaign/room + invite code, roles (DM/player), **WebSocket real-time layer**, server-authoritative state store, `LLMProvider` interface stub | — |
| **5e Reference** | spells, items/equipment, monsters/statblocks — seedable from **SRD 5.1** | Foundation |
| **Characters** | 5e sheet: ability scores, race, class/subclass, skills, proficiency, HP/AC, saving throws, spell slots; **owned by a player** | 5e Reference |
| **Inventory** | equip / attunement / currency; players use their own items | Characters + Items |
| **Combat** ⭐ | initiative, HP, **5e conditions**, turn order — **synced live to every screen** | Characters + Monsters |
| **Story** | session log, quests, NPCs, journal | Combat + Characters |
| **Player UI + Dice + Dashboard** | player's own sheet view, dice roller (broadcast), DM dashboard, global search | all modules |
| **AI DM Assistant** | generate story/NPCs/loot flavor via a pluggable LLM; hybrid rules engine; "Import from Claude" paste path | 5e Reference + Characters + Story |

Independent pairs that *could* parallelize once their deps exist: e.g. **Inventory** and **Combat** both sit on Characters and have little shared mutable state — note this if splitting across worktrees.

See [ROADMAP.md](./ROADMAP.md) for the sprint sequencing and live status.
