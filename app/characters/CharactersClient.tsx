"use client";
// File: app/characters/CharactersClient.tsx
// Characters module UI: list → create wizard (7 steps, live auto-fill preview) →
// sheet (auto/override). Reads GLOBAL reference over REST; character CRUD carries the
// session bearer token. Mirrors the prototype at docs/modules/characters/mockups/.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, ChevronRight, ChevronLeft, Shield, Heart, BookOpen, Sparkles } from "lucide-react";
import { useCampaign } from "../providers";
import { ABILITY_INFO, SKILL_INFO, ABILITY_KEYS, type AbilityKey } from "@/lib/characters/glossary";
import {
  abilityMod, profBonusForLevel, maxHpFor, effectiveAbilities,
  STANDARD_ARRAY, pointBuyCost, validatePointBuy, totalPointBuyCost,
} from "@/lib/characters/rules";
import type {
  ClassListItem, ClassDetail, SubclassListItem, RaceListItem, RaceDetail,
  BackgroundListItem, CharacterListItem, CharacterDetail,
} from "@/lib/characters/types";

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

function token(campaignId?: string): string | null {
  if (typeof window === "undefined" || !campaignId) return null;
  try {
    const all = JSON.parse(localStorage.getItem("dnd.sessions") ?? "{}");
    return all[campaignId]?.token ?? null;
  } catch {
    return null;
  }
}
const authHeaders = (campaignId?: string): HeadersInit => {
  const t = token(campaignId);
  return t ? { "Content-Type": "application/json", Authorization: `Bearer ${t}` } : { "Content-Type": "application/json" };
};

type View = { name: "list" } | { name: "wizard" } | { name: "sheet"; id: string };

export default function CharactersClient() {
  const router = useRouter();
  const { state, me } = useCampaign();
  const [view, setView] = useState<View>({ name: "list" });

  // Prefer the live socket session; fall back to the stored seat so a hard refresh
  // of /characters still works (the live `state` is only present after a client-side
  // nav from the campaign page). A device's stored seat carries campaignId + token.
  // Read once during render (lazy init) — no setState-in-effect.
  const [storedCampaignId] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    try {
      const keys = Object.keys(JSON.parse(localStorage.getItem("dnd.sessions") ?? "{}"));
      return keys[keys.length - 1]; // most recently joined
    } catch {
      return undefined;
    }
  });
  const campaignId = state?.campaignId ?? storedCampaignId;

  // In-session only (PRD edge 5.12): no seat at all → /join. (router.replace, not setState.)
  useEffect(() => {
    if (campaignId) return;
    let hasSeat = false;
    try { hasSeat = Object.keys(JSON.parse(localStorage.getItem("dnd.sessions") ?? "{}")).length > 0; } catch { hasSeat = false; }
    if (!hasSeat) router.replace("/join");
  }, [router, campaignId]);

  const backHref = campaignId ? `/campaign/${campaignId}` : "/";

  return (
    <main className="min-h-dvh max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        {view.name === "list" ? (
          <Link href={backHref} className="text-muted hover:text-text text-sm flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Campaign
          </Link>
        ) : (
          <button onClick={() => setView({ name: "list" })} className="text-muted hover:text-text text-sm flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> ตัวละครทั้งหมด
          </button>
        )}
        <Link href="/reference" className="text-muted hover:text-accent text-sm flex items-center gap-1.5">
          <BookOpen className="w-4 h-4" /> Reference
        </Link>
      </div>

      <h1 className="font-display text-3xl text-accent">ตัวละคร</h1>

      {view.name === "list" && (
        <CharacterList campaignId={campaignId} onOpen={(id) => setView({ name: "sheet", id })} onCreate={() => setView({ name: "wizard" })} />
      )}
      {view.name === "wizard" && (
        <Wizard campaignId={campaignId} isDM={me?.role === "dm"} onCreated={(id) => setView({ name: "sheet", id })} onCancel={() => setView({ name: "list" })} />
      )}
      {view.name === "sheet" && (
        <Sheet campaignId={campaignId} id={view.id} onDeleted={() => setView({ name: "list" })} />
      )}

      <footer className="pt-6 text-xs text-faint border-t border-border">
        เนื้อหากฎจาก SRD 5.1 (CC-BY-4.0) + ชุดเสริมชุมชนแบบเปิด (OGL/CC). ดู prisma/seed/COMMUNITY-LICENSE.md
      </footer>
    </main>
  );
}

// ──────────────── LIST ────────────────
function CharacterList({ campaignId, onOpen, onCreate }: { campaignId?: string; onOpen: (id: string) => void; onCreate: () => void }) {
  const [chars, setChars] = useState<CharacterListItem[] | null>(null);
  useEffect(() => {
    if (!campaignId) return;
    fetch("/api/characters", { headers: authHeaders(campaignId) })
      .then((r) => (r.ok ? r.json() : []))
      .then(setChars)
      .catch(() => setChars([]));
  }, [campaignId]);

  if (chars === null) return <div className="text-muted py-12 text-center">กำลังโหลด…</div>;

  const mine = chars.filter((c) => c.ownedByMe);
  const others = chars.filter((c) => !c.ownedByMe);

  return (
    <div className="space-y-6">
      {mine.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          <UserPlus className="w-12 h-12 mx-auto text-faint" />
          <p className="text-muted mt-4">ยังไม่มีตัวละคร — สร้างตัวแรกของคุณ</p>
          <button onClick={onCreate} className="mt-4 bg-accent text-bg font-semibold px-5 py-2 rounded-md hover:bg-accent-hover">สร้างตัวละคร</button>
        </div>
      ) : (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs text-faint uppercase tracking-wider">ของฉัน</h2>
            <button onClick={onCreate} className="text-sm text-accent hover:text-accent-hover">+ สร้างใหม่</button>
          </div>
          <ul className="space-y-2">{mine.map((c) => <CharRow key={c.id} c={c} onOpen={onOpen} accent />)}</ul>
        </section>
      )}
      {others.length > 0 && (
        <section>
          <h2 className="text-xs text-faint uppercase tracking-wider mb-2">ในปาร์ตี้</h2>
          <ul className="space-y-2">{others.map((c) => <CharRow key={c.id} c={c} onOpen={onOpen} />)}</ul>
        </section>
      )}
    </div>
  );
}

function CharRow({ c, onOpen, accent }: { c: CharacterListItem; onOpen: (id: string) => void; accent?: boolean }) {
  return (
    <li>
      <button onClick={() => onOpen(c.id)} className="w-full text-left bg-surface-raised border border-border rounded-2xl p-4 hover:border-accent/60 transition"
        style={accent ? { borderLeft: "3px solid var(--accent)" } : undefined}>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="font-display text-lg">{c.name} {c.isNpc && <span className="text-xs text-arcane">NPC</span>}</div>
            <div className="text-sm text-muted">{c.raceName} · {c.className}{c.subclassName ? ` (${c.subclassName})` : ""} · Lv {c.level}</div>
          </div>
          <div className="text-right tnum font-mono text-sm">
            <div className="text-danger flex items-center gap-1 justify-end"><Heart className="w-3.5 h-3.5" />{c.currentHp}/{c.maxHp}</div>
            <div className="text-muted flex items-center gap-1 justify-end"><Shield className="w-3.5 h-3.5" />{c.ac}</div>
          </div>
        </div>
      </button>
    </li>
  );
}

// ──────────────── WIZARD ────────────────
const STEPS = ["Race", "Class", "Subclass", "Background", "Abilities", "Skills", "Details"] as const;

function Wizard({ campaignId, isDM, onCreated, onCancel }: { campaignId?: string; isDM: boolean; onCreated: (id: string) => void; onCancel: () => void }) {
  const [step, setStep] = useState(0);
  const [races, setRaces] = useState<RaceListItem[]>([]);
  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [backgrounds, setBackgrounds] = useState<BackgroundListItem[]>([]);
  const [subclasses, setSubclasses] = useState<SubclassListItem[]>([]);
  const [raceDetail, setRaceDetail] = useState<RaceDetail | null>(null);
  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null);

  const [raceSlug, setRaceSlug] = useState("");
  const [classSlug, setClassSlug] = useState("");
  const [subclassSlug, setSubclassSlug] = useState<string | null>(null);
  const [backgroundSlug, setBackgroundSlug] = useState<string | null>(null);
  const [method, setMethod] = useState<"standard-array" | "point-buy">("standard-array");
  const [scores, setScores] = useState<Record<AbilityKey, number>>({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
  const [skills, setSkills] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [isNpc, setIsNpc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/reference/races").then((r) => r.json()),
      fetch("/api/reference/classes").then((r) => r.json()),
      fetch("/api/reference/backgrounds").then((r) => r.json()),
    ]).then(([r, c, b]) => { setRaces(r); setClasses(c); setBackgrounds(b); });
  }, []);
  useEffect(() => { if (raceSlug) fetch(`/api/reference/races/${raceSlug}`).then((r) => r.json()).then(setRaceDetail); }, [raceSlug]);
  useEffect(() => {
    if (!classSlug) return;
    fetch(`/api/reference/classes/${classSlug}`).then((r) => r.json()).then(setClassDetail);
    fetch(`/api/reference/subclasses?class=${classSlug}`).then((r) => r.json()).then(setSubclasses);
  }, [classSlug]);

  // Reset class-dependent picks when the class changes (in the handler, not an effect).
  const pickClass = (slug: string) => { setClassSlug(slug); setSubclassSlug(null); setSkills([]); };

  const raceBonus = raceDetail?.abilityBonuses ?? {};
  const eff = effectiveAbilities(scores, raceBonus as Partial<Record<AbilityKey, number>>);
  const conMod = abilityMod(eff.con);
  const pbTotal = totalPointBuyCost(ABILITY_KEYS.map((a) => scores[a]));
  const previewHp = classDetail ? maxHpFor(classDetail.hitDie, 1, conMod) : 0;

  // Validation per step
  const canNext = useMemo(() => {
    if (step === 0) return !!raceSlug;
    if (step === 1) return !!classSlug;
    if (step === 4) return method === "standard-array"
      ? sameMultiset(ABILITY_KEYS.map((a) => scores[a]), STANDARD_ARRAY)
      : validatePointBuy(ABILITY_KEYS.map((a) => scores[a]));
    if (step === 6) return name.trim().length > 0;
    return true;
  }, [step, raceSlug, classSlug, method, scores, name]);

  const skillCount = classDetail?.skillChoices.count ?? 0;

  async function submit() {
    if (!campaignId) return;
    setBusy(true); setErr(null);
    const res = await fetch("/api/characters", {
      method: "POST", headers: authHeaders(campaignId),
      body: JSON.stringify({ name: name.trim(), raceSlug, classSlug, subclassSlug, backgroundSlug, level: 1, abilityMethod: method, baseAbilities: scores, skills, isNpc: isDM && isNpc }),
    });
    if (res.ok) { const c = (await res.json()) as CharacterDetail; onCreated(c.id); }
    else { const e = await res.json().catch(() => ({})); setErr(e.error ?? "สร้างไม่สำเร็จ"); setBusy(false); }
  }

  return (
    <div className="grid md:grid-cols-[1fr_280px] gap-6">
      <div className="space-y-5">
        {/* stepper */}
        <ol className="flex flex-wrap gap-1.5 text-xs">
          {STEPS.map((s, i) => (
            <li key={s} className={`px-2.5 py-1 rounded-full border ${i === step ? "border-accent text-accent" : i < step ? "border-success/40 text-success" : "border-border text-faint"}`}>{i + 1}. {s}</li>
          ))}
        </ol>

        {step === 0 && <PickGrid items={races.filter((r) => !r.parentRaceSlug || true)} sel={raceSlug} onPick={setRaceSlug}
          render={(r) => <><div className="font-semibold">{r.name}</div><div className="text-xs text-faint">{r.size} · {r.speed || "—"} ft.</div></>} />}

        {step === 1 && <PickGrid items={classes} sel={classSlug} onPick={pickClass}
          render={(c) => <><div className="font-semibold">{c.name}</div><div className="text-xs text-faint">d{c.hitDie} · {c.isCaster ? "ร่ายเวท" : "ไม่ร่ายเวท"}</div></>} />}

        {step === 2 && (
          subclasses.length === 0
            ? <Empty msg="คลาสนี้ยังไม่มี subclass ในชุดเปิด — ข้ามไปก่อนแล้วเลือกภายหลังได้" />
            : <div className="space-y-2">
                {classDetail && <p className="text-xs text-muted">เลือกได้ตั้งแต่ Lv {classDetail.subclassLevel}{classDetail.subclassLevel > 1 ? " (ตัวละครเริ่ม Lv 1 — เลือกตอนนี้หรือทีหลังก็ได้)" : ""}</p>}
                {subclasses.map((s) => (
                  <button key={s.slug} onClick={() => setSubclassSlug(s.slug === subclassSlug ? null : s.slug)}
                    className={`w-full text-left p-3 rounded-xl border ${subclassSlug === s.slug ? "border-accent bg-accent/10" : "border-border bg-surface-raised hover:border-accent/50"}`}>
                    <div className="flex items-center gap-2"><span className="font-semibold">{s.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.license === "CC-BY-4.0" ? "border border-success/40 text-success" : "border border-arcane/40 text-arcane"}`}>{s.license}</span></div>
                    {s.flavor && <div className="text-xs text-muted mt-1">{s.flavor}</div>}
                    <div className="text-[10px] text-faint mt-1">ที่มา: {s.source}</div>
                  </button>
                ))}
              </div>
        )}

        {step === 3 && (
          backgrounds.length === 0 ? <Empty msg="ไม่มี background ในชุดเปิด" /> :
          <PickGrid items={backgrounds} sel={backgroundSlug ?? ""} onPick={(v) => setBackgroundSlug(v)}
            render={(b) => <div className="font-semibold">{b.name}</div>} />
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {(["standard-array", "point-buy"] as const).map((m) => (
                <button key={m} onClick={() => { setMethod(m); setScores(m === "point-buy" ? { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 } : { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }); setSkills([]); }}
                  className={`px-3 py-1.5 rounded-md text-sm ${method === m ? "bg-accent text-bg" : "border border-border"}`}>{m === "standard-array" ? "Standard Array" : "Point-Buy"}</button>
              ))}
              {method === "point-buy" && <span className="ml-auto text-sm tnum font-mono">เหลือ {27 - pbTotal}/27</span>}
            </div>
            <AbilityAssign method={method} scores={scores} setScores={setScores} raceBonus={raceBonus as Record<string, number>} eff={eff} />
            <details className="group"><summary className="cursor-pointer text-xs text-muted">ℹ️ ค่าพลังแต่ละตัวคืออะไร?</summary>
              <div className="mt-2 grid sm:grid-cols-2 gap-1.5">{ABILITY_KEYS.map((a) => (
                <div key={a} className="bg-surface rounded-lg p-2 text-xs"><span className="font-mono text-accent uppercase font-semibold">{a}</span> <span>{ABILITY_INFO[a].name}</span><div className="text-muted mt-0.5">{ABILITY_INFO[a].desc}</div></div>
              ))}</div></details>
          </div>
        )}

        {step === 5 && (
          <div>
            <p className="text-sm text-muted mb-3">เลือก skill proficiency จากคลาส <span className="tnum font-mono">({skills.length}/{skillCount})</span> — proficient จะได้ +PB ทบกับ modifier</p>
            {classDetail && classDetail.skillChoices.from.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-1.5">{classDetail.skillChoices.from.map((sk) => {
                const on = skills.includes(sk), full = skills.length >= skillCount && !on;
                const info = SKILL_INFO[sk];
                return (
                  <label key={sk} className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${on ? "border-accent bg-accent/10" : "border-border"} ${full ? "opacity-40" : ""}`}>
                    <input type="checkbox" checked={on} disabled={full} onChange={() => setSkills((p) => on ? p.filter((x) => x !== sk) : [...p, sk])} className="accent-accent mt-0.5" />
                    <span className="flex-1"><span className="flex items-center gap-2"><span className="font-medium">{sk}</span>{info && <span className="font-mono text-[10px] text-faint border border-border rounded px-1">{info.ability.toUpperCase()}</span>}</span>
                      {info && <span className="block text-xs text-muted mt-0.5">{info.desc}</span>}</span>
                  </label>
                );
              })}</div>
            ) : <Empty msg="คลาสนี้ไม่มี skill ให้เลือกเพิ่ม" />}
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <label className="block"><span className="text-sm text-muted">ชื่อตัวละคร</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus className="mt-1 w-full rounded-md bg-bg border border-border px-3 py-2" placeholder="เช่น Thorin" /></label>
            {isDM && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isNpc} onChange={(e) => setIsNpc(e.target.checked)} className="accent-accent" /> สร้างเป็น NPC (ไม่มีผู้เล่นเป็นเจ้าของ)</label>}
            {err && <p className="text-danger text-sm">{err}</p>}
          </div>
        )}

        {/* nav */}
        <div className="flex items-center justify-between pt-2">
          <button onClick={() => (step === 0 ? onCancel() : setStep((s) => s - 1))} className="text-sm text-muted hover:text-text flex items-center gap-1"><ChevronLeft className="w-4 h-4" />{step === 0 ? "ยกเลิก" : "ย้อน"}</button>
          {step < STEPS.length - 1 ? (
            <button disabled={!canNext} onClick={() => setStep((s) => s + 1)} className="bg-accent text-bg font-semibold px-5 py-2 rounded-md disabled:opacity-40 flex items-center gap-1">ถัดไป <ChevronRight className="w-4 h-4" /></button>
          ) : (
            <button disabled={!canNext || busy} onClick={submit} className="bg-accent text-bg font-semibold px-5 py-2 rounded-md disabled:opacity-40">{busy ? "กำลังสร้าง…" : "สร้างตัวละคร"}</button>
          )}
        </div>
      </div>

      {/* live preview */}
      <aside className="bg-surface-raised border border-border rounded-2xl p-4 h-fit space-y-3 text-sm">
        <div className="font-display text-accent">{name || "ตัวละครใหม่"}</div>
        <div className="text-muted text-xs">{races.find((r) => r.slug === raceSlug)?.name ?? "—"} · {classes.find((c) => c.slug === classSlug)?.name ?? "—"} · Lv 1</div>
        <div className="grid grid-cols-3 gap-1.5">{ABILITY_KEYS.map((a) => (
          <div key={a} className="bg-surface rounded-lg p-1.5 text-center" title={`${ABILITY_INFO[a].name} — ${ABILITY_INFO[a].desc}`}>
            <div className="text-[10px] text-faint uppercase">{a}</div>
            <div className="font-mono tnum">{eff[a] || "—"}</div>
            <div className="font-mono tnum text-xs text-accent">{eff[a] ? sign(abilityMod(eff[a])) : ""}</div>
          </div>
        ))}</div>
        {classDetail && <div className="flex justify-between text-xs"><span className="text-muted flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-danger" />HP</span><span className="font-mono tnum">{previewHp}</span></div>}
        <div className="flex justify-between text-xs"><span className="text-muted">Prof Bonus</span><span className="font-mono tnum">{sign(profBonusForLevel(1))}</span></div>
      </aside>
    </div>
  );
}

function AbilityAssign({ method, scores, setScores, raceBonus, eff }: {
  method: "standard-array" | "point-buy"; scores: Record<AbilityKey, number>;
  setScores: (s: Record<AbilityKey, number>) => void; raceBonus: Record<string, number>; eff: Record<AbilityKey, number>;
}) {
  const used = ABILITY_KEYS.map((a) => scores[a]).filter((v) => v > 0);
  return (
    <div className="space-y-1.5">
      {ABILITY_KEYS.map((a) => (
        <div key={a} className="flex items-center gap-3">
          <span className="w-10 font-mono uppercase text-sm text-muted">{a}</span>
          {method === "standard-array" ? (
            <select value={scores[a] || ""} onChange={(e) => setScores({ ...scores, [a]: Number(e.target.value) })} className="bg-bg border border-border rounded-md px-2 py-1 text-sm">
              <option value="">—</option>
              {STANDARD_ARRAY.map((v) => <option key={v} value={v} disabled={used.includes(v) && scores[a] !== v}>{v}</option>)}
            </select>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => setScores({ ...scores, [a]: Math.max(8, scores[a] - 1) })} className="w-7 h-7 rounded border border-border">−</button>
              <span className="font-mono tnum w-6 text-center">{scores[a]}</span>
              <button disabled={pointBuyCost(scores[a] + 1) === Infinity} onClick={() => setScores({ ...scores, [a]: scores[a] + 1 })} className="w-7 h-7 rounded border border-border disabled:opacity-30">+</button>
            </div>
          )}
          <span className="text-xs text-faint">{raceBonus[a] ? `+${raceBonus[a]} race` : ""}</span>
          <span className="ml-auto font-mono tnum text-sm">→ {eff[a] || "—"} <span className="text-accent">{eff[a] ? sign(abilityMod(eff[a])) : ""}</span></span>
        </div>
      ))}
    </div>
  );
}

// ──────────────── SHEET ────────────────
function Sheet({ campaignId, id, onDeleted }: { campaignId?: string; id: string; onDeleted: () => void }) {
  const [c, setC] = useState<CharacterDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [saving, setSaving] = useState(false);

  function load() {
    fetch(`/api/characters/${id}`, { headers: authHeaders(campaignId) })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setC(d); setStatus("ok"); })
      .catch(() => setStatus("error"));
  }
  useEffect(load, [id, campaignId]);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch(`/api/characters/${id}`, { method: "PATCH", headers: authHeaders(campaignId), body: JSON.stringify(body) });
    if (res.ok) setC(await res.json());
    setSaving(false);
  }
  async function del() {
    if (!confirm("ลบตัวละครนี้?")) return;
    const res = await fetch(`/api/characters/${id}`, { method: "DELETE", headers: authHeaders(campaignId) });
    if (res.ok) onDeleted();
  }
  async function spellOp(action: string, spellSlug: string) {
    setSaving(true);
    const res = await fetch(`/api/characters/${id}/spells`, { method: "POST", headers: authHeaders(campaignId), body: JSON.stringify({ action, spellSlug }) });
    if (res.ok) setC(await res.json());
    setSaving(false);
  }
  const [pickerOpen, setPickerOpen] = useState(false);

  if (status === "loading") return <div className="text-muted py-12 text-center">กำลังโหลด…</div>;
  if (status === "error" || !c) return <Empty msg="ไม่พบตัวละครนี้ (หรือไม่มีสิทธิ์)" />;

  const overridden = (f: string) => c.overrides.includes(f);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-2xl">{c.name} {c.isNpc && <span className="text-xs text-arcane">NPC</span>}</h2>
          <p className="text-muted text-sm">{c.raceName} · {c.className}{c.subclassName ? ` (${c.subclassName})` : ""}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Lv</span>
          <button onClick={() => patch({ level: Math.max(1, c.level - 1) })} className="w-7 h-7 rounded border border-border">−</button>
          <span className="font-mono tnum w-6 text-center">{c.level}</span>
          <button onClick={() => patch({ level: Math.min(20, c.level + 1) })} className="w-7 h-7 rounded border border-border">+</button>
        </div>
      </div>

      {/* combat row */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="HP" value={`${c.currentHp}/${c.maxHp}`} note={overridden("maxHp") ? "แก้เอง" : "auto"} color="text-danger" />
        <Stat label="AC" value={c.ac} note={overridden("ac") ? "แก้เอง" : "auto"} />
        <Stat label="Prof" value={sign(c.proficiencyBonus)} note={overridden("proficiencyBonus") ? "แก้เอง" : "auto"} />
      </div>
      <div className="flex gap-2 text-sm">
        <button onClick={() => patch({ currentHp: Math.max(0, c.currentHp - 1) })} className="px-3 py-1 rounded border border-border text-danger">− HP</button>
        <button onClick={() => patch({ currentHp: Math.min(c.maxHp + c.tempHp, c.currentHp + 1) })} className="px-3 py-1 rounded border border-border text-success">+ HP</button>
        <span className="ml-auto text-faint text-xs self-center">Speed {c.speed} ft · Init {sign(c.initiative)}{saving ? " · บันทึก…" : ""}</span>
      </div>

      {/* abilities */}
      <div className="grid grid-cols-6 gap-1.5">{ABILITY_KEYS.map((a) => (
        <div key={a} className="bg-surface-raised border border-border rounded-lg p-2 text-center cursor-help" title={`${ABILITY_INFO[a].name} — ${ABILITY_INFO[a].desc}`}>
          <div className="text-[10px] text-faint uppercase">{a}</div>
          <div className="font-mono tnum text-xl">{c.abilities[a]}</div>
          <div className="font-mono tnum text-xs text-accent">{sign(c.abilityMods[a])}</div>
        </div>
      ))}</div>

      <div className="grid sm:grid-cols-2 gap-5">
        <Section title="Saving Throws">
          {ABILITY_KEYS.map((a) => {
            const s = c.saves[a];
            return <Row key={a} on={s.proficient} label={a.toUpperCase()} mod={s.mod} title={`${ABILITY_INFO[a].name} save — ${ABILITY_INFO[a].desc}`} />;
          })}
        </Section>
        <Section title="Skills">
          {Object.entries(c.skills).map(([sk, s]) => (
            <Row key={sk} on={s.proficient} label={sk} ab={SKILL_INFO[sk]?.ability.toUpperCase()} mod={s.mod} title={`${sk}${SKILL_INFO[sk] ? ` (${SKILL_INFO[sk].ability.toUpperCase()}) — ${SKILL_INFO[sk].desc}` : ""}`} />
          ))}
        </Section>
      </div>

      {c.spellSlots && (
        <Section title="Spell Slots">
          <div className="flex flex-wrap gap-2">{Object.entries(c.spellSlots).map(([lvl, n]) => (
            <span key={lvl} className="text-sm bg-arcane/10 border border-arcane/40 text-arcane rounded-lg px-3 py-1 font-mono tnum">Lv {lvl}: {n}</span>
          ))}</div>
        </Section>
      )}

      {c.spellSlots && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs text-faint uppercase tracking-wider">เวท (known / prepared)</h3>
            <button onClick={() => setPickerOpen(true)} className="text-sm text-accent hover:text-accent-hover flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> เพิ่มเวท</button>
          </div>
          {c.spells.length === 0 ? (
            <p className="text-faint text-sm">ยังไม่มีเวท — กดปุ่มเพิ่มเวทเพื่อเลือกจากคลังของคลาส</p>
          ) : (
            <ul className="space-y-1">{c.spells.map((sp) => (
              <li key={sp.slug} className="flex items-center gap-2 text-sm bg-surface-raised border border-border rounded-lg px-3 py-1.5">
                <span className="font-mono text-[10px] text-faint w-8">{sp.level === 0 ? "C" : `L${sp.level}`}</span>
                <span className="flex-1">{sp.name}</span>
                <button onClick={() => spellOp(sp.prepared ? "unprepare" : "prepare", sp.slug)}
                  className={`text-xs rounded px-2 py-0.5 border ${sp.prepared ? "border-arcane text-arcane bg-arcane/10" : "border-border text-faint"}`}>
                  {sp.prepared ? "● prepared" : "○ prepare"}
                </button>
                <button onClick={() => spellOp("remove", sp.slug)} className="text-faint hover:text-danger text-xs">✕</button>
              </li>
            ))}</ul>
          )}
        </section>
      )}

      {pickerOpen && <SpellPicker className={c.className} owned={new Set(c.spells.map((s) => s.slug))} onAdd={(slug) => spellOp("add", slug)} onClose={() => setPickerOpen(false)} />}

      <Section title="Features">
        <ul className="space-y-1.5">{c.features.map((f, i) => (
          <li key={`${f.name}-${i}`} className="text-sm">
            <span className="font-medium">{f.name}</span>
            <span className="text-faint text-xs"> · {f.source} · Lv {f.level}</span>
            {f.desc && <p className="text-muted text-xs mt-0.5 line-clamp-2">{f.desc}</p>}
          </li>
        ))}{c.features.length === 0 && <li className="text-faint text-sm">—</li>}</ul>
      </Section>

      {c.overrides.length > 0 && (
        <button onClick={() => patch({ resetAuto: c.overrides })} className="text-xs text-accent hover:text-accent-hover">↺ คืนค่าทั้งหมดเป็น auto ({c.overrides.length})</button>
      )}

      <div className="pt-4 border-t border-border">
        <button onClick={del} className="text-sm text-danger hover:opacity-80">ลบตัวละคร</button>
      </div>
    </div>
  );
}

// ──────────────── shared bits ────────────────
function PickGrid<T extends { slug: string }>({ items, sel, onPick, render }: { items: T[]; sel: string; onPick: (slug: string) => void; render: (item: T) => React.ReactNode }) {
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {items.map((it) => (
        <button key={it.slug} onClick={() => onPick(it.slug)} className={`text-left p-3 rounded-xl border ${sel === it.slug ? "border-accent bg-accent/10" : "border-border bg-surface-raised hover:border-accent/50"}`}>{render(it)}</button>
      ))}
    </div>
  );
}
function Empty({ msg }: { msg: string }) { return <div className="text-center py-8 border border-dashed border-border rounded-xl text-muted text-sm">{msg}</div>; }

interface SpellRow { slug: string; name: string; level: number; school: string; classes: string[] }
function SpellPicker({ className, owned, onAdd, onClose }: { className: string; owned: Set<string>; onAdd: (slug: string) => void; onClose: () => void }) {
  const [all, setAll] = useState<SpellRow[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => { fetch("/api/reference/spells").then((r) => r.json()).then(setAll).catch(() => setAll([])); }, []);
  const list = useMemo(() => {
    if (!all) return [];
    const cls = className.toLowerCase();
    const needle = q.trim().toLowerCase();
    return all
      .filter((s) => s.classes.some((c) => c.toLowerCase() === cls))
      .filter((s) => !needle || s.name.toLowerCase().includes(needle))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
      .slice(0, 120);
  }, [all, className, q]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-md max-h-[80dvh] flex flex-col rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display text-lg">เพิ่มเวท · {className}</h4>
          <button onClick={onClose} className="text-muted hover:text-text">✕</button>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="ค้นชื่อเวท…" className="w-full rounded-md bg-bg border border-border px-3 py-2 text-sm mb-3" />
        <div className="overflow-y-auto flex-1 space-y-1">
          {all === null ? <p className="text-muted text-sm py-4 text-center">กำลังโหลด…</p>
            : list.length === 0 ? <p className="text-faint text-sm py-4 text-center">ไม่พบเวท</p>
            : list.map((s) => {
                const has = owned.has(s.slug);
                return (
                  <button key={s.slug} disabled={has} onClick={() => onAdd(s.slug)}
                    className={`w-full text-left flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm border ${has ? "border-border opacity-40" : "border-border hover:border-accent/60"}`}>
                    <span className="font-mono text-[10px] text-faint w-8">{s.level === 0 ? "C" : `L${s.level}`}</span>
                    <span className="flex-1">{s.name}</span>
                    <span className="text-xs text-faint">{s.school}</span>
                    {has && <span className="text-[10px] text-success">มีแล้ว</span>}
                  </button>
                );
              })}
        </div>
      </div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 className="text-xs text-faint uppercase tracking-wider mb-2">{title}</h3>{children}</section>;
}
function Stat({ label, value, note, color }: { label: string; value: React.ReactNode; note?: string; color?: string }) {
  return (
    <div className="bg-surface-raised border border-border rounded-xl p-3 text-center">
      <div className="text-[10px] text-faint uppercase flex items-center justify-center gap-1">{label}{note && <span className={note === "auto" ? "text-faint" : "text-warning"}>· {note}</span>}</div>
      <div className={`font-mono tnum text-2xl ${color ?? ""}`}>{value}</div>
    </div>
  );
}
function Row({ on, label, ab, mod, title }: { on: boolean; label: string; ab?: string; mod: number; title?: string }) {
  return (
    <div className="flex items-center gap-2 cursor-help py-0.5" title={title}>
      <span className={on ? "text-text" : "text-faint"}>{on ? "●" : "○"}</span>
      <span className={on ? "font-semibold" : "text-muted"}>{label}</span>
      {ab && <span className="font-mono text-[10px] text-faint">{ab}</span>}
      <span className={`ml-auto font-mono tnum ${on ? "" : "text-faint"}`}>{sign(mod)}</span>
    </div>
  );
}

function sameMultiset(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const x = [...a].sort((m, n) => m - n), y = [...b].sort((m, n) => m - n);
  return x.every((v, i) => v === y[i]);
}
