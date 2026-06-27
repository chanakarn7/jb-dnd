// scripts/gen-bloodsalt-campaign.mjs
// Generates "เกลือสีเลือด (Bloodsalt)" — a fresh, ready-to-play Arc 1 campaign.
// Solo party: Thorin (Fighter, lvl 1). DM-side NPCs, Arc 1 quests, lore journal,
// pre-built encounters, and the Arc 1 boss stat block.
// Uses ONLY real SRD slugs (FK-backed spellSlug/itemSlug verified to exist).
// Run: node scripts/gen-bloodsalt-campaign.mjs
import { writeFileSync } from "node:fs";

const J = (o) => JSON.stringify(o);

function char(over) {
  return {
    isNpc: false,
    subraceSlug: null, subclassSlug: null, backgroundSlug: null,
    abilityMethod: "standard-array",
    proficiencyBonus: 2,
    tempHp: 0, speed: 30, initiative: 0,
    spellSlotsJson: J({}), spellSlotsUsedJson: J({}),
    conditionsJson: J([]), overridesJson: J([]),
    currencyJson: J({ gp: 15, sp: 0, cp: 0 }),
    notes: null, spells: [], items: [],
    ...over,
  };
}

// ---- NPC companion: Thorin, the veteran caravan guard ----------------------
// isNpc: true → DM-controlled companion (shows the "NPC" tag, doesn't occupy a
// player slot). The player creates their OWN character live in a 2nd tab.
const thorin = char({
  isNpc: true,
  name: "ธอริน หินเหล็ก",
  raceSlug: "dwarf", subraceSlug: "hill-dwarf",
  classSlug: "fighter", subclassSlug: null, // subclass (Champion) chosen at lvl 3
  backgroundSlug: "soldier",
  level: 1,
  str: 15, dex: 13, con: 16, int: 8, wis: 13, cha: 10,
  baseAbilitiesJson: J({ str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 }),
  proficiencyBonus: 2,
  maxHp: 13, currentHp: 13, ac: 18, speed: 25, initiative: 1,
  savesJson: J({ str: true, dex: false, con: true, int: false, wis: false, cha: false }),
  skillsJson: J({ Athletics: true, Intimidation: true, Perception: true, Survival: true }),
  currencyJson: J({ gp: 15, sp: 0, cp: 0 }),
  notes: "อดีตยามคุ้มกันคาราวานที่หายไปแถวหนองน้ำเค็มฮอลโลว์ไบรน์ กลับมาตามหาความจริง — มุ่งสายแชมเปี้ยน (เลือกซับคลาสตอนเลเวล 3)",
  items: [
    { itemSlug: "chain-mail", quantity: 1, equipped: true, attuned: false },
    { itemSlug: "shield", quantity: 1, equipped: true, attuned: false },
    { itemSlug: "battleaxe", quantity: 1, equipped: true, attuned: false },
    { itemSlug: "handaxe", quantity: 2, equipped: false, attuned: false },
    { itemSlug: "potion-of-healing", quantity: 2, equipped: false, attuned: false },
  ],
});

// ---- Arc 1 boss stat block (used in the final encounter) -------------------
const brotherVael = char({
  isNpc: true,
  name: "บราเดอร์เวล (หัวหน้าลัทธิ)",
  raceSlug: "human", subraceSlug: null,
  classSlug: "cleric", subclassSlug: null,
  backgroundSlug: "acolyte",
  level: 4,
  str: 11, dex: 14, con: 13, int: 12, wis: 16, cha: 15,
  baseAbilitiesJson: J({ str: 11, dex: 14, con: 13, int: 12, wis: 16, cha: 15 }),
  proficiencyBonus: 2,
  maxHp: 33, currentHp: 33, ac: 13, initiative: 2,
  savesJson: J({ str: false, dex: false, con: false, int: false, wis: true, cha: true }),
  skillsJson: J({ Deception: true, Persuasion: true, Religion: true }),
  spellSlotsJson: J({ 1: 4, 2: 3 }),
  spellSlotsUsedJson: J({ 1: 0, 2: 0 }),
  conditionsJson: J([]),
  currencyJson: J({ gp: 0, sp: 0, cp: 0 }),
  notes: "บอสปิด Arc 1 — นักบวชใจดีจอมปลอม ผู้ปลุก 'ภูตเกลือ'. ใช้ bless เสริมทาส, sacred-flame โจมตี, cure-wounds รักษาตัว",
  spells: [
    { spellSlug: "guidance", known: true, prepared: true },
    { spellSlug: "sacred-flame", known: true, prepared: true },
    { spellSlug: "bless", known: true, prepared: true },
    { spellSlug: "cure-wounds", known: true, prepared: true },
    { spellSlug: "shield", known: true, prepared: true },
  ],
  items: [
    { itemSlug: "scale-mail", quantity: 1, equipped: true, attuned: false },
    { itemSlug: "mace", quantity: 1, equipped: true, attuned: false },
  ],
});

// ---- story: Arc 1 quests + lore journal ------------------------------------
const story = {
  sessions: [], // fresh campaign — nothing played yet; recaps logged after each session

  quests: [
    {
      name: "ตามหาคอล",
      description: "คอล คนงานเหมืองหนุ่มหายตัวไปกลางดึก มารา พี่สาวของเขาขอร้องให้กลุ่มออกตามหา เบาะแสล่าสุดอยู่ในเหมืองชั้นบน",
      giverName: "มารา",
      status: "active",
      objectivesJson: J([
        { text: "พูดคุยกับมาราที่โรงเตี๊ยมเกลือป่น", checked: false },
        { text: "สำรวจเหมืองชั้นบน หาร่องรอยของคอล", checked: false },
        { text: "ค้นหาที่มาของผลึกเกลือสีแดง", checked: false },
      ]),
      reward: "50 gp และความไว้วางใจของชาวเมือง",
    },
    {
      name: "เสียงกระซิบใต้เหมือง",
      description: "คนงานได้ยินเสียงกระซิบจากใต้ดิน เกลือกลายเป็นสีเลือด มีบางอย่างผิดปกติอย่างร้ายแรงในส่วนลึกของเหมือง",
      giverName: null,
      status: "active",
      objectivesJson: J([
        { text: "สืบหาความหมายของสัญลักษณ์ 'ดวงตาร่ำไห้'", checked: false },
        { text: "คุยกับแม่เฒ่าซีลีน คนทรงประจำเมือง", checked: false },
      ]),
      reward: null,
    },
    {
      name: "ความลับของฟอร์แมน",
      description: "ฟอร์แมนการ์ริคปกปิดเรื่องคนหาย ทำไม? เขารู้อะไรที่ไม่ยอมบอก",
      giverName: null,
      status: "active",
      objectivesJson: J([
        { text: "หาหลักฐานว่าการ์ริคปกปิดอะไร", checked: false },
        { text: "เปิดโปงข้อตกลงระหว่างการ์ริคกับลัทธิ", checked: false },
      ]),
      reward: null,
    },
    {
      name: "หยุดพิธีดวงตาร่ำไห้",
      description: "[Arc 1 Climax] บราเดอร์เวลกำลังทำพิธีปลุกภูตเกลือในห้องผนึกที่ลึกที่สุดของเหมือง ต้องหยุดให้ทันก่อนผนึกแตก",
      giverName: null,
      status: "active",
      objectivesJson: J([
        { text: "ดิ่งลงสู่ปล่องที่ลึกที่สุด", checked: false },
        { text: "ขัดขวางพิธีของบราเดอร์เวล", checked: false },
        { text: "เอาตัวรอดออกมาจากห้องผนึก", checked: false },
      ]),
      reward: "ระดับ 4 + ปมเปิด Arc 2: ภูตเกลือ 'รู้จัก' พวกเจ้าแล้ว",
    },
  ],

  npcs: [
    { name: "มารา", role: "ผู้ว่าจ้าง / จุดเริ่มเรื่อง", faction: "ชาวเมือง", notes: "พี่สาวของคอลคนงานที่หาย จริงใจ สิ้นหวัง — เป็นหน้าต่างแรกสู่ปริศนา", isAlive: true },
    { name: "คอล", role: "ผู้สูญหาย", faction: "คนงานเหมือง", notes: "น้องชายของมารา — TWIST: ยังไม่ตาย แต่ถูกห่อด้วยเกลือแดง กำลังถูกแปลงเป็นทาส", isAlive: true },
    { name: "ฟอร์แมนการ์ริค", role: "ผู้ต้องสงสัย", faction: "เจ้าของเหมือง", notes: "ปิดข่าวคนหายเพื่อให้เหมืองเดินต่อ — แลกคนงาน 'พวกเร่ร่อน' กับลัทธิเพื่อรักษากำไร เชื่อว่าไม่มีใครเดือดร้อน", isAlive: true },
    { name: "บราเดอร์เวล", role: "ศัตรูหลัก (บอส Arc 1)", faction: "ลัทธิดวงตาร่ำไห้", notes: "นักบวชหน้าใหม่ใจดีจอมปลอม ชักชวนคนสิ้นหวังเข้าลัทธิ เป้าหมาย: ปลุกภูตเกลือที่ผู้ก่อตั้งเมืองผนึกไว้", isAlive: true },
    { name: "แม่เฒ่าซีลีน", role: "ผู้รู้ตำนาน", faction: "ชาวเมือง", notes: "คนทรงประจำเมือง รู้เรื่องการผนึกภูตเกลือ แต่หวาดกลัวเกินกว่าจะพูดตรงๆ — ต้องเกลี้ยกล่อม", isAlive: true },
  ],

  journal: [
    {
      title: "[DM] ตำนานการผนึก",
      content: "เมื่อ 200 ปีก่อน ผู้ก่อตั้งฮอลโลว์ไบรน์ค้นพบ 'ภูตเกลือ' — สิ่งมีชีวิตโบราณที่หลับใหลใต้หนองน้ำเค็ม พวกเขาผนึกมันไว้ด้วยพิธีกรรมและสร้างเมืองทับเพื่อเฝ้า แต่ผนึกกำลังอ่อนลง และนี่เป็นเพียงจุดเดียวจากหลายจุดทั่วแผ่นดิน",
    },
    {
      title: "[DM] ลัทธิดวงตาร่ำไห้",
      content: "บราเดอร์เวลและสาวกเชื่อว่าภูตเกลือคือเทพที่แท้จริง การปลุกมันจะนำ 'การชำระล้าง' มาสู่โลก พวกเขาแปลงคนที่หายไปเป็นทาส (ห่อด้วยเกลือแดง) เพื่อเป็นพลังป้อนพิธี สัญลักษณ์: ดวงตาที่หลั่งน้ำตาเป็นเกลือ",
    },
    {
      title: "[DM] TWIST กลาง Arc",
      content: "คนที่หายไป 'ยังไม่ตาย' — ถูกห่อด้วยเกลือแดงในรังใต้เหมือง กำลังแปลงร่างช้าๆ ถ้าหยุดพิธีได้ทัน บางคน (รวมคอล) อาจช่วยกลับมาได้ ถ้าช้าไป พวกเขากลายเป็นทาสถาวร — ใช้ตัดสินใจทางศีลธรรมของผู้เล่น",
    },
  ],
};

// ---- pre-built encounters (drop straight into the combat tracker) ----------
const encounters = [
  {
    name: "ซุ่มโจมตีในเหมืองชั้นบน (ครั้งที่ 1)",
    status: "active",
    round: 1,
    combatants: [
      { type: "character", name: "ธอริน หินเหล็ก", monsterSlug: null, initiative: 12, initiativeOrder: 0, maxHp: 13, currentHp: 13, conditionsJson: J([]), removed: false },
      { type: "monster", name: "กอบลิน #1", monsterSlug: "goblin", initiative: 14, initiativeOrder: 1, maxHp: 7, currentHp: 7, conditionsJson: J([]), removed: false },
      { type: "monster", name: "กอบลิน #2", monsterSlug: "goblin", initiative: 10, initiativeOrder: 2, maxHp: 7, currentHp: 7, conditionsJson: J([]), removed: false },
      { type: "monster", name: "กอบลิน #3", monsterSlug: "goblin", initiative: 8, initiativeOrder: 3, maxHp: 7, currentHp: 7, conditionsJson: J([]), removed: false },
    ],
  },
  {
    name: "บอส Arc 1 — ห้องผนึก",
    status: "active",
    round: 1,
    combatants: [
      { type: "character", name: "ธอริน หินเหล็ก", monsterSlug: null, initiative: 11, initiativeOrder: 0, maxHp: 13, currentHp: 13, conditionsJson: J([]), removed: false },
      { type: "monster", name: "บราเดอร์เวล", monsterSlug: null, initiative: 13, initiativeOrder: 1, maxHp: 33, currentHp: 33, conditionsJson: J([]), removed: false },
      { type: "monster", name: "ผู้พิทักษ์เกลือ", monsterSlug: "bugbear", initiative: 9, initiativeOrder: 2, maxHp: 27, currentHp: 27, conditionsJson: J([]), removed: false },
      { type: "monster", name: "ทาสเกลือ #1", monsterSlug: "zombie", initiative: 6, initiativeOrder: 3, maxHp: 22, currentHp: 22, conditionsJson: J([]), removed: false },
      { type: "monster", name: "ทาสเกลือ #2", monsterSlug: "zombie", initiative: 5, initiativeOrder: 4, maxHp: 22, currentHp: 22, conditionsJson: J([]), removed: false },
    ],
  },
];

// ---- assemble --------------------------------------------------------------
const data = {
  version: "1",
  exportedAt: new Date().toISOString(),
  campaign: { name: "เกลือสีเลือด (Bloodsalt)" },
  players: [
    { displayName: "Dungeon Master", role: "dm", character: null },
  ],
  npcCharacters: [thorin, brotherVael],
  story,
  encounters,
};

const out = "bloodsalt-campaign.json";
writeFileSync(out, JSON.stringify(data, null, 2), "utf8");
console.log(`✓ wrote ${out}`);
console.log(`  NPC companion: Thorin (Fighter lvl 1) · boss stat block: Brother Vael`);
console.log(`  quests: ${story.quests.length} · NPCs: ${story.npcs.length} · journal: ${story.journal.length} · encounters: ${encounters.length}`);
