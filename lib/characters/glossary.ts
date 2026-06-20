// File: lib/characters/glossary.ts
// Static 5e glossary (SRD 5.1, CC-BY-4.0). The 6 ability scores and 18 skills are
// a FIXED canonical set — not user-editable — so their explanatory text lives here
// (no DB table / migration). Shown as helper text in the character wizard + tooltips
// on the sheet. See docs/modules/characters/SA_BLUEPRINT.md §4.1.

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export const ABILITY_KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

export const ABILITY_INFO: Record<AbilityKey, { name: string; desc: string }> = {
  str: { name: "Strength", desc: "พลังกายดิบ — โจมตีระยะประชิด, ยก/ลาก/แบกของ, กระโดด และทักษะ Athletics" },
  dex: { name: "Dexterity", desc: "ความคล่องแคล่ว — กำหนด AC, initiative, อาวุธระยะไกล/finesse และ Acrobatics/Stealth/Sleight of Hand" },
  con: { name: "Constitution", desc: "ความอึดและพลังชีวิต — กำหนด HP สูงสุด, ความทนทาน และ save รักษา concentration เวท" },
  int: { name: "Intelligence", desc: "เหตุผลและความจำ — เวทของ Wizard และ Arcana/History/Investigation/Nature/Religion" },
  wis: { name: "Wisdom", desc: "การรับรู้และสัญชาตญาณ — เวทของ Cleric/Druid และ Perception/Insight/Medicine/Survival/Animal Handling" },
  cha: { name: "Charisma", desc: "พลังบุคลิกและการโน้มน้าว — เวทของ Bard/Sorcerer/Warlock และ Persuasion/Deception/Intimidation/Performance" },
};

export const SKILL_INFO: Record<string, { ability: AbilityKey; desc: string }> = {
  Athletics: { ability: "str", desc: "ปีนป่าย ว่ายน้ำ กระโดด ปล้ำ/ผลักศัตรู" },
  Acrobatics: { ability: "dex", desc: "ทรงตัว ตีลังกา หลุดจากการจับ บนพื้นลื่น/แคบ" },
  "Sleight of Hand": { ability: "dex", desc: "ล้วงกระเป๋า ซ่อนของในมือ มือไว" },
  Stealth: { ability: "dex", desc: "ย่องเงียบ ซ่อนตัวให้พ้นสายตา" },
  Arcana: { ability: "int", desc: "ความรู้เรื่องเวทมนตร์ สัญลักษณ์ และระนาบ" },
  History: { ability: "int", desc: "ความรู้เหตุการณ์ในอดีต อาณาจักร สงคราม" },
  Investigation: { ability: "int", desc: "หาเบาะแส อนุมานจากร่องรอย ค้นรายละเอียด" },
  Nature: { ability: "int", desc: "ความรู้เรื่องภูมิประเทศ พืช สัตว์ อากาศ" },
  Religion: { ability: "int", desc: "ความรู้เรื่องเทพ พิธีกรรม ลัทธิ" },
  "Animal Handling": { ability: "wis", desc: "ควบคุม/สงบสัตว์ อ่านอารมณ์สัตว์" },
  Insight: { ability: "wis", desc: "อ่านเจตนา จับโกหก ดูภาษากายคน" },
  Medicine: { ability: "wis", desc: "ปฐมพยาบาล วินิจฉัยอาการป่วย" },
  Perception: { ability: "wis", desc: "สังเกตสิ่งรอบตัวด้วยประสาทสัมผัส" },
  Survival: { ability: "wis", desc: "ตามรอย หาทาง ล่าสัตว์ เอาตัวรอดในป่า" },
  Deception: { ability: "cha", desc: "โกหกอย่างแนบเนียน ปลอมตัว/ปลอมเจตนา" },
  Intimidation: { ability: "cha", desc: "ข่มขู่ด้วยคำพูดหรือท่าที" },
  Performance: { ability: "cha", desc: "แสดง ร้อง เล่นดนตรี สร้างความบันเทิง" },
  Persuasion: { ability: "cha", desc: "โน้มน้าวด้วยเหตุผล มารยาท ไมตรี" },
};

// skill name -> governing ability (derived; used by the rules engine for skill mods)
export const SKILL_ABILITY: Record<string, AbilityKey> = Object.fromEntries(
  Object.entries(SKILL_INFO).map(([k, v]) => [k, v.ability]),
);
