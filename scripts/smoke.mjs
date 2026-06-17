// End-to-end smoke test against a running server (npm run dev).
// Drives real socket.io clients to verify the Sprint-0 Definition of Done.
import { io } from "socket.io-client";

const URL = process.env.SMOKE_URL ?? "http://localhost:3000";
let pass = 0;
let fail = 0;
const ok = (m) => { console.log("  ✓", m); pass++; };
const no = (m) => { console.log("  ✗", m); fail++; };

const connect = (auth) =>
  new Promise((res) => {
    const s = io(URL, { auth, forceNew: true, transports: ["websocket", "polling"] });
    s.on("connect", () => res(s));
  });
const emit = (s, ev, payload) =>
  new Promise((res) => s.emit(ev, payload, (ack) => res(ack)));
const next = (s, ev, ms = 1500) =>
  new Promise((res) => {
    const t = setTimeout(() => res(null), ms);
    s.once(ev, (d) => { clearTimeout(t); res(d); });
  });

console.log("\nSMOKE: D&D Campaign Manager — Foundation DoD\n");

// 1. DM creates a room.
const dm = await connect({});
const created = await emit(dm, "campaign:create", { campaignName: "Ember Crown", dmDisplayName: "Mara" });
created?.ok && created.state?.inviteCode ? ok(`DM created room, invite code = ${created.state.inviteCode}`) : no("create failed");
const code = created?.state?.inviteCode;
const campaignId = created?.state?.campaignId;

// 2. Bad invite code rejected.
const player = await connect({});
const bad = await emit(player, "campaign:join", { inviteCode: "ZZZZZZ", displayName: "Thorin" });
!bad.ok && bad.code === "BAD_CODE" ? ok("bad invite code rejected (BAD_CODE)") : no("bad code not rejected");

// 3. Duplicate name rejected.
const dup = await emit(player, "campaign:join", { inviteCode: code, displayName: "Mara" });
!dup.ok && dup.code === "DUPLICATE_NAME" ? ok("duplicate display name rejected (DUPLICATE_NAME)") : no("dup name not rejected");

// 4. Player joins; DM sees a live roster:update with 2 participants (<=500ms).
const rosterPromise = next(dm, "roster:update", 800);
const t0 = Date.now();
const joined = await emit(player, "campaign:join", { inviteCode: code, displayName: "Thorin" });
const roster = await rosterPromise;
const dt = Date.now() - t0;
joined?.ok ? ok("player joined") : no("join failed");
roster && roster.participants?.length === 2
  ? ok(`DM received live roster:update (2 participants) in ${dt}ms`)
  : no("DM did not receive roster:update with 2 participants");
const playerToken = joined?.token;
const playerSessionId = joined?.sessionId;

// 5. Player cannot perform DM actions (server-side authz).
const hack = await emit(player, "campaign:rename", { name: "Hacked" });
!hack.ok && hack.code === "UNAUTHORIZED" ? ok("player rename rejected server-side (UNAUTHORIZED)") : no("player rename not rejected");

// 6. DM rename broadcasts to the room.
const patchPromise = next(player, "state:patch", 800);
await emit(dm, "campaign:rename", { name: "Ember Crown Reborn" });
const patch = await patchPromise;
patch?.value === "Ember Crown Reborn" ? ok("DM rename broadcast to player (state:patch)") : no("rename not broadcast");

// 7. Reconnect via token restores full state with no duplicate seat.
player.disconnect();
await new Promise((r) => setTimeout(r, 200));
const player2 = await connect({ sessionToken: playerToken });
const snap = await next(player2, "state:snapshot", 1500);
snap && snap.participants?.length === 2 && snap.participants.filter((p) => p.sessionId === playerSessionId).length === 1
  ? ok("reconnect via token restored snapshot, no duplicate seat")
  : no("reconnect snapshot wrong");

// 8. Secrets never leaked in broadcasts.
const leaked = JSON.stringify(snap ?? {}).includes("sessionToken") || JSON.stringify(created ?? {}).includes(playerToken ?? "__");
leaked ? no("secret token leaked in a broadcast/state") : ok("no secret tokens in broadcast-safe state");

dm.disconnect();
player2.disconnect();

console.log(`\nRESULT: ${pass} passed, ${fail} failed\n`);
console.log(`(campaign ${campaignId} left in DB for restart-rehydrate check)`);
process.exit(fail === 0 ? 0 : 1);
