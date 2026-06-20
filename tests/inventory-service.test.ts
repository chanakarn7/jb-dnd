import { describe, it, expect, vi, beforeEach } from "vitest";

// Inventory service tests (Sprint 3 QA).
// Mocks: lib/db (Prisma), lib/characters/charRepo (findInCampaign),
//        lib/characters/service (canWrite), lib/inventory/repo.
// No DB is touched — deterministic unit tests only.

const dbMock = vi.hoisted(() => ({
  item: { findUnique: vi.fn(), findMany: vi.fn() },
  characterItem: { findFirst: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
  character: { findFirst: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));
const charRepoMock = vi.hoisted(() => ({ findInCampaign: vi.fn() }));
const charServiceMock = vi.hoisted(() => ({ canWrite: vi.fn() }));
const repoMock = vi.hoisted(() => ({
  listItems: vi.fn(), findItem: vi.fn(), upsertItem: vi.fn(),
  updateItem: vi.fn(), removeItem: vi.fn(), getCurrencyRaw: vi.fn(), setCurrency: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: dbMock }));
vi.mock("@/lib/characters/charRepo", () => charRepoMock);
vi.mock("@/lib/characters/service", () => charServiceMock);
vi.mock("@/lib/inventory/repo", () => repoMock);

import { addItem, setItemFields, removeItem, setCurrency, toInventoryView } from "@/lib/inventory/service";
import type { Session } from "@/lib/characters/service";

const session: Session = { sessionId: "s1", campaignId: "c1", role: "player" };
const dmSession: Session = { sessionId: "dm1", campaignId: "c1", role: "dm" };

const char = { id: "char1", campaignId: "c1", ownerSessionId: "s1", isNpc: false };
const charOther = { id: "char2", campaignId: "c1", ownerSessionId: "s2", isNpc: false };

beforeEach(() => {
  vi.clearAllMocks();
  charRepoMock.findInCampaign.mockResolvedValue(char);
  charServiceMock.canWrite.mockReturnValue(true);
  repoMock.getCurrencyRaw.mockResolvedValue("{}");
  repoMock.listItems.mockResolvedValue([]);
  dbMock.item.findMany.mockResolvedValue([]);
  dbMock.character.findFirst.mockResolvedValue({ currencyJson: "{}" });
});

// ── addItem ────────────────────────────────────────────────────────────
describe("addItem", () => {
  it("returns forbidden when canWrite false (edge 5.5)", async () => {
    charServiceMock.canWrite.mockReturnValue(false);
    const res = await addItem(session, "char1", { itemSlug: "longsword" });
    expect(res).toEqual({ error: "forbidden" });
  });

  it("returns not_found when itemSlug not in SRD (edge 5.3)", async () => {
    dbMock.item.findUnique.mockResolvedValue(null);
    const res = await addItem(session, "char1", { itemSlug: "nonexistent" });
    expect(res).toEqual({ error: "not_found" });
  });

  it("returns invalid_quantity for qty=0 (edge 5.4)", async () => {
    dbMock.item.findUnique.mockResolvedValue({ slug: "longsword" });
    const res = await addItem(session, "char1", { itemSlug: "longsword", quantity: 0 });
    expect(res).toEqual({ error: "invalid_quantity" });
  });

  it("returns invalid_quantity for negative qty", async () => {
    dbMock.item.findUnique.mockResolvedValue({ slug: "longsword" });
    const res = await addItem(session, "char1", { itemSlug: "longsword", quantity: -3 });
    expect(res).toEqual({ error: "invalid_quantity" });
  });

  it("upserts item and returns inventory view on success (edge 5.13 stacking)", async () => {
    dbMock.item.findUnique.mockResolvedValue({ slug: "arrow" });
    repoMock.upsertItem.mockResolvedValue({});
    repoMock.listItems.mockResolvedValue([{ id: "ci1", itemSlug: "arrow", quantity: 40, equipped: false, attuned: false, characterId: "char1" }]);
    dbMock.item.findMany.mockResolvedValue([{ slug: "arrow", name: "Arrow", type: "adventuring-gear", rarity: "mundane", requiresAttunement: false, propertiesJson: "{}" }]);
    const res = await addItem(session, "char1", { itemSlug: "arrow", quantity: 20 });
    expect(repoMock.upsertItem).toHaveBeenCalledWith("c1", "char1", "arrow", 20);
    expect("error" in res).toBe(false);
    if (!("error" in res)) {
      expect(res.items[0].name).toBe("Arrow");
      expect(res.items[0].quantity).toBe(40); // returned from listItems mock
    }
  });

  it("cross-campaign character → not_found (edge 5.10)", async () => {
    charRepoMock.findInCampaign.mockResolvedValue(null);
    const res = await addItem(session, "char-other-campaign", { itemSlug: "longsword" });
    expect(res).toEqual({ error: "not_found" });
  });
});

// ── setItemFields ─────────────────────────────────────────────────────
describe("setItemFields — attunement", () => {
  const attunableItem = { requiresAttunement: true };
  const normalItem = { requiresAttunement: false };

  beforeEach(() => {
    // Default: item exists in this character's inventory, not yet attuned
    repoMock.findItem.mockResolvedValue({ id: "ci1", characterId: "char1", itemSlug: "cloak-of-elvenkind", attuned: false, equipped: false, quantity: 1 });
    // $transaction runs callback with stub tx
    dbMock.$transaction.mockImplementation(async (cb: (tx: typeof dbMock) => unknown) => cb(dbMock));
    dbMock.item.findUnique.mockResolvedValue(attunableItem);
    dbMock.characterItem.count.mockResolvedValue(0); // 0 attuned by default
    dbMock.characterItem.update.mockResolvedValue({});
  });

  it("attune non-attunable item → 422 not_attunable (edge 5.1)", async () => {
    dbMock.item.findUnique.mockResolvedValue(normalItem);
    const res = await setItemFields(session, "char1", "ci1", { attuned: true });
    expect(res).toEqual({ error: "not_attunable" });
  });

  it("attune 4th item when 3 already attuned → 422 attunement_limit (edge 5.2)", async () => {
    dbMock.characterItem.count.mockResolvedValue(3); // 3 already attuned
    const res = await setItemFields(session, "char1", "ci1", { attuned: true });
    expect(res).toEqual({ error: "attunement_limit" });
  });

  it("attune succeeds when count=2 (cap enforced in tx — edge 5.11)", async () => {
    dbMock.characterItem.count.mockResolvedValue(2);
    repoMock.listItems.mockResolvedValue([{ id: "ci1", itemSlug: "cloak-of-elvenkind", quantity: 1, equipped: false, attuned: true, characterId: "char1" }]);
    dbMock.item.findMany.mockResolvedValue([{ slug: "cloak-of-elvenkind", name: "Cloak of Elvenkind", type: "wondrous-item", rarity: "uncommon", requiresAttunement: true, propertiesJson: "{}" }]);
    const res = await setItemFields(session, "char1", "ci1", { attuned: true });
    expect("error" in res).toBe(false);
    expect(dbMock.characterItem.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ attuned: true }) }));
  });

  it("unattune is idempotent even if already not attuned (edge 5.12)", async () => {
    repoMock.findItem.mockResolvedValue({ id: "ci1", characterId: "char1", itemSlug: "x", attuned: false, equipped: false, quantity: 1 });
    repoMock.updateItem.mockResolvedValue({});
    const res = await setItemFields(session, "char1", "ci1", { attuned: false });
    expect("error" in res).toBe(false);
    expect(repoMock.updateItem).toHaveBeenCalled();
  });

  it("already attuned + attuned=true is idempotent (no cap error)", async () => {
    repoMock.findItem.mockResolvedValue({ id: "ci1", characterId: "char1", itemSlug: "x", attuned: true, equipped: false, quantity: 1 });
    repoMock.updateItem.mockResolvedValue({});
    const res = await setItemFields(session, "char1", "ci1", { attuned: true });
    // Should not enter the cap-check transaction branch; just update idempotently
    expect("error" in res).toBe(false);
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("setItemFields — quantity / equip / authz", () => {
  beforeEach(() => {
    repoMock.findItem.mockResolvedValue({ id: "ci1", characterId: "char1", itemSlug: "arrow", attuned: false, equipped: false, quantity: 5 });
    repoMock.updateItem.mockResolvedValue({});
  });

  it("quantity=0 → 422 invalid_quantity (edge 5.4)", async () => {
    const res = await setItemFields(session, "char1", "ci1", { quantity: 0 });
    expect(res).toEqual({ error: "invalid_quantity" });
  });

  it("quantity negative → invalid_quantity", async () => {
    const res = await setItemFields(session, "char1", "ci1", { quantity: -1 });
    expect(res).toEqual({ error: "invalid_quantity" });
  });

  it("equip toggle is accepted and forwarded to repo", async () => {
    repoMock.listItems.mockResolvedValue([]);
    const res = await setItemFields(session, "char1", "ci1", { equipped: true });
    expect("error" in res).toBe(false);
    expect(repoMock.updateItem).toHaveBeenCalledWith("ci1", { equipped: true });
  });

  it("canWrite false → 403 (edge 5.5)", async () => {
    charServiceMock.canWrite.mockReturnValue(false);
    const res = await setItemFields(session, "char1", "ci1", { equipped: true });
    expect(res).toEqual({ error: "forbidden" });
  });

  it("item belongs to different character → not_found", async () => {
    repoMock.findItem.mockResolvedValue({ id: "ci1", characterId: "char2", itemSlug: "x", attuned: false, equipped: false, quantity: 1 });
    const res = await setItemFields(session, "char1", "ci1", { equipped: true });
    expect(res).toEqual({ error: "not_found" });
  });
});

// ── removeItem ────────────────────────────────────────────────────────
describe("removeItem", () => {
  beforeEach(() => {
    repoMock.findItem.mockResolvedValue({ id: "ci1", characterId: "char1", itemSlug: "torch", attuned: false, equipped: false, quantity: 1 });
    repoMock.removeItem.mockResolvedValue({});
    repoMock.listItems.mockResolvedValue([]); // edge 5.6: last item → empty list
  });

  it("removes and returns empty inventory (edge 5.6)", async () => {
    const res = await removeItem(session, "char1", "ci1");
    expect("error" in res).toBe(false);
    if (!("error" in res)) expect(res.items).toHaveLength(0);
    expect(repoMock.removeItem).toHaveBeenCalledWith("c1", "ci1");
  });

  it("canWrite false → 403", async () => {
    charServiceMock.canWrite.mockReturnValue(false);
    expect(await removeItem(session, "char1", "ci1")).toEqual({ error: "forbidden" });
  });

  it("item belongs to different character → not_found", async () => {
    repoMock.findItem.mockResolvedValue({ id: "ci1", characterId: "char2", itemSlug: "x", attuned: false, equipped: false, quantity: 1 });
    expect(await removeItem(session, "char1", "ci1")).toEqual({ error: "not_found" });
  });
});

// ── setCurrency ───────────────────────────────────────────────────────
describe("setCurrency", () => {
  beforeEach(() => {
    repoMock.setCurrency.mockResolvedValue({});
  });

  it("saves normalized currency and returns it", async () => {
    const res = await setCurrency(session, "char1", { gp: 50 });
    expect("error" in res).toBe(false);
    if (!("error" in res)) {
      expect(res.currency).toEqual({ pp: 0, gp: 50, ep: 0, sp: 0, cp: 0 });
      expect(repoMock.setCurrency).toHaveBeenCalledWith("c1", "char1", JSON.stringify({ pp: 0, gp: 50, ep: 0, sp: 0, cp: 0 }));
    }
  });

  it("negative value → 422 invalid_currency (edge 5.7)", async () => {
    const res = await setCurrency(session, "char1", { gp: -10 });
    expect(res).toEqual({ error: "invalid_currency" });
  });

  it("float value → invalid_currency", async () => {
    const res = await setCurrency(session, "char1", { gp: 1.5 });
    expect(res).toEqual({ error: "invalid_currency" });
  });

  it("canWrite false → 403", async () => {
    charServiceMock.canWrite.mockReturnValue(false);
    const res = await setCurrency(session, "char1", { gp: 10 });
    expect(res).toEqual({ error: "forbidden" });
  });
});

// ── toInventoryView — graceful ref miss ────────────────────────────────
describe("toInventoryView", () => {
  it("handles missing item slug gracefully — missingRef=true (edge 5.15)", async () => {
    repoMock.listItems.mockResolvedValue([{ id: "ci1", itemSlug: "deleted-slug", quantity: 1, equipped: false, attuned: false, characterId: "char1" }]);
    dbMock.item.findMany.mockResolvedValue([]); // slug not in SRD anymore
    const view = await toInventoryView("c1", "char1");
    expect(view.items[0].missingRef).toBe(true);
    expect(view.items[0].name).toBe("deleted-slug"); // shows slug as fallback
  });

  it("parses malformed propertiesJson gracefully (edge 5.8)", async () => {
    repoMock.listItems.mockResolvedValue([{ id: "ci1", itemSlug: "dagger", quantity: 1, equipped: false, attuned: false, characterId: "char1" }]);
    dbMock.item.findMany.mockResolvedValue([{ slug: "dagger", name: "Dagger", type: "weapon", rarity: "mundane", requiresAttunement: false, propertiesJson: "NOT_JSON" }]);
    const view = await toInventoryView("c1", "char1");
    // Should not throw; item still appears with no weight/cost
    expect(view.items[0].name).toBe("Dagger");
    expect(view.items[0].weight).toBeUndefined();
  });
});
