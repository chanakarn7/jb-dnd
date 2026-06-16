# PRD — Foundation (Sprint 0)
### D&D Campaign Manager · module 1 of 8

> Module-level PRD. Inherits the program authorities as hard constraints:
> [VISION](../../program/VISION.md) · [ARCHITECTURE](../../program/ARCHITECTURE.md) · [DATA_MODEL](../../program/DATA_MODEL.md) · [DESIGN_SYSTEM](../../program/DESIGN_SYSTEM.md) · [ROADMAP](../../program/ROADMAP.md).
> Downstream chain reads this file: `/sa` → `/uxui` → `/proto` → `/dev`.

---

## 1. Feature Overview & KPIs

### 1.1 What this module is
Foundation is the **spine** every later module plugs into. It delivers the runnable app shell, the **room/lobby** (a DM creates a campaign and gets an invite code, players join by code + display name), the **DM-vs-player role** model, and the **server-authoritative real-time layer** (Socket.io) with a shared state store that **syncs live across every connected client** and survives disconnects/restarts. It also lands the **`LLMProvider` interface stub** so the AI module (Sprint 7) only adds an adapter, not a refactor.

It deliberately does **not** deliver gameplay (character sheets, combat, dice, reference data) — those are later sprints. Foundation only needs a player to **occupy a seat/role** in a live, synced room.

### 1.2 Core problem
A group around one table needs to spin up a shared, live session in seconds with **no accounts and no cloud** — and trust that what they see (who's connected, session state) is the **same on every screen** and **not silently desynced**.

### 1.3 Objective & value
- Prove the "playable" plumbing end-to-end: **create room → join by code → live sync across two browsers.**
- Establish the **server-authoritative** contract (clients send *intents*; the server validates, persists, broadcasts) that every later module reuses.
- Make the app **resilient at the table**: a dropped phone or a restarted server must recover without losing the campaign.

### 1.4 Success metrics (KPIs)
| KPI | Target |
|-----|--------|
| Time for a DM to create a room and read out a code | ≤ 15 s |
| Time for a player to join (code + name → in the room) | ≤ 10 s |
| Connected-players list propagation latency (one client joins → others update) | ≤ 500 ms on LAN |
| State recovered correctly after server restart with an active campaign | 100% (campaign + roster persist) |
| Reconnect after a client drop restores full state | 100%, ≤ 3 s |
| Core flow works with **no LLM provider configured** | Always (AI absence never blocks anything) |

---

## 2. Target Platforms & User Roles

### 2.1 Platform
- **Responsive web app** (Next.js + TypeScript), served by a **single Node process on the DM's machine**, bound to `0.0.0.0`, reachable on the LAN at `http://<dm-ip>:3000`.
- Primary devices: laptops & tablets around one table. Dark theme default (per DESIGN_SYSTEM).
- **Offline-capable** at the table — no internet needed for any Foundation feature.

### 2.2 Roles (Actors)
| Role | How they enter | Can do (in Foundation scope) |
|------|----------------|------------------------------|
| **Dungeon Master (DM)** | Creates the campaign → becomes its DM, holds an elevated DM session token | Create campaign; see/read invite code; see the live roster of connected participants; rename the campaign; remove a participant; (later modules add game control) |
| **Player** | Opens the join link/page → enters invite code + display name → claims a seat | Join a campaign; set their display name; occupy a player seat; see the live roster + shared session state; leave |

**Authorization is server-side on every intent.** The server derives role from the session, never from the client payload. A player can write only their **own** seat data; the DM is the only one who can mutate campaign-level state.

### 2.3 Out of scope (explicit non-goals — deferred)
| Deferred to | Item |
|-------------|------|
| Sprint 1 (5e Reference) | spells / items / monsters data |
| Sprint 2 (Characters) | the full 5e character sheet — Foundation's "claim a character" is just a **named seat**, not a sheet |
| Sprint 3 (Inventory) | gear, currency, attunement |
| Sprint 4 (Combat) | initiative, HP, conditions, turn order |
| Sprint 5 (Story) | sessions, quests, NPCs, journal |
| Sprint 6 (Player UI/Dice) | dice roller, dashboards, search |
| Sprint 7 (AI) | real LLM generation — Foundation ships only the **interface stub** (no adapter, AI features disabled) |
| Out of v1 entirely | accounts/passwords, remote/internet play, multi-DM permissions |

---

## 3. User Stories & Functional Workflows

### 3.1 User stories
- **US-1 (DM):** As a DM, I create a campaign and get a short invite code so my players can join.
- **US-2 (Player):** As a player, I enter the invite code and a display name so I take a seat in the campaign.
- **US-3 (Player):** As a player, I claim a player seat so the table knows which character slot is mine. *(In Foundation a "seat" = a `PlayerSession` with a chosen name; the 5e sheet comes in Sprint 2.)*
- **US-4 (any):** As any participant, I see a live roster that updates the instant someone joins or leaves, on every screen.
- **US-5 (DM):** As a DM, I can remove a participant or rename the campaign, and everyone sees it immediately.
- **US-6 (any):** As any participant, if my device drops, I reconnect and get the full current state back automatically.
- **US-7 (DM):** As a DM, if I restart the server mid-session, my campaign and roster are still there.

### 3.2 Primary workflow — DM creates a room
1. DM opens `http://<dm-ip>:3000` → landing → **"Create Campaign"**.
2. Enters a campaign name + their DM display name → submits.
3. Server creates a `Campaign` (with a unique **invite code**) and the DM's `PlayerSession` (role `dm`), issues the DM a **DM session token** (persisted client-side, e.g. localStorage), and opens the DM's socket into the campaign room.
4. DM lands on the **lobby**: campaign name, **invite code shown prominently**, the join URL/IP hint, and a live (initially just-the-DM) roster.

### 3.3 Primary workflow — Player joins
1. Player opens the app on the same Wi-Fi → **"Join Campaign"**.
2. Enters **invite code** + **display name** → submits.
3. Server validates the code → creates a `PlayerSession` (role `player`) scoped to that `campaignId`, issues the player a session token, joins their socket to the campaign room.
4. Server **broadcasts** the updated roster to the room → DM and all players see the new player appear **within ≤500 ms**.
5. Player lands on a **waiting/lobby** view showing the roster + shared session state.

### 3.4 Real-time sync contract (the reusable pattern)
- Client → server: **intents** (`campaign:create`, `campaign:join`, `campaign:rename`, `participant:remove`, `session:leave`). Names follow the `domain:action` convention from ARCHITECTURE.
- Server: validates (role + ownership + campaign scope) → updates the **in-memory authoritative working set** → **persists to SQLite** → **broadcasts** the new state (or a delta) to the campaign room only.
- Client never mutates shared state locally and assumes it stuck — it renders what the server broadcasts.
- **On (re)connect:** client emits `session:resume` with its token → server replies with a **full state snapshot** for that campaign → client renders, then resumes deltas.

### 3.5 LLMProvider stub (no AI yet)
- Define the `LLMProvider` TypeScript interface and a provider **registry** that resolves to **none** by default.
- Anything that would consume AI checks "is a provider configured?" → **no → feature simply absent/disabled.** Nothing in Foundation calls an LLM. This exists purely so Sprint 7 adds an adapter without touching call sites.

---

## 4. Data Dictionary & UI Elements

> Foundation **owns** `Campaign` and `PlayerSession` per [DATA_MODEL](../../program/DATA_MODEL.md). `/sa` finalizes columns/migration; below is the requirement-level shape.

### 4.1 `Campaign`
| Field | Type | Req | Notes |
|-------|------|-----|-------|
| `id` | string (cuid/uuid) | ✓ | PK; tenant root |
| `name` | string | ✓ | 1–60 chars |
| `inviteCode` | string | ✓ | **unique**; short, human-readable, unambiguous (see §5.7) |
| `dmSessionToken` | string | ✓ | secret; identifies the DM session on reconnect |
| `status` | enum `active`/`closed` | ✓ | default `active` |
| `createdAt` | datetime | ✓ | |

### 4.2 `PlayerSession`
| Field | Type | Req | Notes |
|-------|------|-----|-------|
| `id` | string | ✓ | PK |
| `campaignId` | string (FK→Campaign) | ✓ | every row scoped to a campaign |
| `displayName` | string | ✓ | 1–24 chars; unique **within a campaign** (see §5.2) |
| `role` | enum `dm`/`player` | ✓ | |
| `sessionToken` | string | ✓ | secret; reconnect identity |
| `characterId` | string (FK→Character) | ✗ | **null in Foundation**; wired in Sprint 2 |
| `connectedAt` | datetime | ✓ | |
| `lastSeenAt` | datetime | ✓ | updated on heartbeat/disconnect |
| `isConnected` | boolean | ✓ | live presence flag for the roster |

### 4.3 Key UI elements (Foundation screens — detailed by `/uxui`)
- **Landing:** Create Campaign · Join Campaign.
- **Create form:** campaign name, DM display name, submit.
- **Join form:** invite code, display name, submit; inline validation/errors.
- **Lobby (DM):** campaign name (editable), big **invite code** + copy button, join URL/IP hint, live roster with presence dots, remove-participant control.
- **Lobby (Player):** campaign name, live roster, "waiting for the DM" state.
- **Global:** connection status indicator (connected / reconnecting / offline), toast for join/leave/errors.

---

## 5. Edge Cases & Exception Handling

| # | Case | Expected handling |
|---|------|-------------------|
| 5.1 | **Bad / unknown invite code** | Reject with clear inline error ("No campaign found for that code"). No session created. Don't reveal whether codes exist for other campaigns. |
| 5.2 | **Duplicate display name within the same campaign** | Reject with "That name's taken in this campaign — pick another." (Names need only be unique per campaign, not globally.) |
| 5.3 | **Closed / ended campaign code** | Reject join with "This campaign has ended." |
| 5.4 | **DM disconnects** | Campaign stays alive; DM shown as `disconnected` in roster (not removed). DM reconnects via `dmSessionToken` and regains control. Players are **not** kicked when the DM drops. |
| 5.5 | **DM reconnect** | `session:resume` with DM token → full snapshot, DM controls restored, presence flips to connected. |
| 5.6 | **Player disconnect / reconnect** | Seat preserved; roster shows them `disconnected`; on resume their seat (and later their character) is reclaimed via token, not duplicated. |
| 5.7 | **Invite-code collision / ambiguity** | Generate from an unambiguous alphabet (no `0/O`, `1/I/L`); retry on the rare unique-constraint clash. |
| 5.8 | **Two clients race** (e.g. two players grab the same name simultaneously) | Server is the single arbiter: first valid intent wins via the unique constraint; the loser gets a rejection + retry, never a silent dupe. |
| 5.9 | **Server restart with an active campaign** | On boot, server **rehydrates** the in-memory working set from SQLite. Campaign + roster persist; all participants are marked `disconnected` until their clients reconnect via token and resume. |
| 5.10 | **Client sends an intent it isn't authorized for** (player tries a DM action, or acts on another campaign) | Server rejects server-side (role/ownership/campaign-scope check); never trust client-claimed role. Log + ignore. |
| 5.11 | **Malformed / oversized intent payload** | Validate & reject with a typed error; never crash the room. |
| 5.12 | **Same person opens two tabs** | Treated as two sockets on the same `sessionToken`; presence stays connected while ≥1 socket is live; broadcasts go to all. |
| 5.13 | **No LLM provider configured** | Always the default; AI-dependent affordances are simply absent. Must never block create/join/sync. |

---

## 6. Compliance & Non-Functional Requirements

### 6.1 Architecture conformance (hard constraints — from program docs)
- **Stack:** Next.js + TypeScript · SQLite + Prisma (**migrations from day one**, additive-only schema evolution) · Socket.io. No cloud services.
- **Server-authoritative:** server owns mutable state; clients send intents; server validates + persists + broadcasts. Authorization always server-side.
- **Multi-tenancy:** every row + every socket + every broadcast scoped to `campaignId`; no query or broadcast crosses campaigns.
- **Transport:** Socket.io rooms keyed by `campaignId`.
- **Hosting:** single Node process bound to `0.0.0.0`; document the IP/port discovery flow for players.
- **LLMProvider** interface stubbed; app fully functional with no provider.

### 6.2 Performance
- Roster/state propagation ≤ 500 ms on a typical home LAN.
- Reconnect-to-restored-state ≤ 3 s.
- Comfortably supports one table (≈1 DM + up to ~8 players) per campaign, multiple campaigns per server.

### 6.3 Reliability
- Durable across server restart (SQLite is the persistent truth; in-memory is the working set).
- A dropped client never corrupts shared state; the server remains the single source of truth.

### 6.4 Security / privacy
- No PII beyond a freely-chosen display name → minimal PDPA/GDPR surface; data lives only on the DM's machine.
- Session tokens (`dmSessionToken`, `sessionToken`) are secrets used for reconnect identity; not guessable; never exposed in the roster broadcast to other clients.
- LAN-trust model for v1 (anyone with the code on the Wi-Fi can join) — acceptable and documented; remote/auth hardening is out of v1 scope.

### 6.5 Usability
- Invite code must be **easy to read aloud** across a table (short, unambiguous alphabet, copy button).
- Clear connection-status feedback (connected / reconnecting / offline) so the table trusts what they see.

---

## 7. Acceptance Criteria (Definition of Done)
1. ✅ A DM can create a campaign and is shown a unique, readable **invite code**.
2. ✅ A player can join by entering the **code + display name** and lands in the campaign's lobby.
3. ✅ The **connected-players roster updates live on every connected client** (≤500 ms) when someone joins or leaves.
4. ✅ DM-only actions (rename campaign, remove participant) are enforced **server-side** and rejected for players.
5. ✅ A disconnected client (player **or** DM) **reconnects via token and receives a full state snapshot**; no duplicate seats.
6. ✅ After a **server restart** with an active campaign, the campaign + roster are **rehydrated from SQLite**.
7. ✅ Bad code, duplicate name, and unauthorized-intent are all rejected with clear, safe errors.
8. ✅ The app runs and the full create→join→sync loop works **with no LLM provider configured**.
9. ✅ Schema ships as a **Prisma migration**; `Campaign` + `PlayerSession` match the program [DATA_MODEL](../../program/DATA_MODEL.md).

---

*Next stage: `/sa` reads this PRD → writes `docs/modules/foundation/SA_BLUEPRINT.md` and amends the shared `docs/program/DATA_MODEL.md` (`Campaign`, `PlayerSession` columns + first migration).*
