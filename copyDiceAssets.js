// copyDiceAssets.js — run after npm install to copy @3d-dice/dice-box static assets to /public.
// Called by postinstall: safe to fail silently if package not yet installed.
const { cpSync, mkdirSync, existsSync } = require("fs");
const { join } = require("path");

const src = join(__dirname, "node_modules/@3d-dice/dice-box/dist/assets");
const dest = join(__dirname, "public/assets/dice-box");
const distSrc = join(__dirname, "node_modules/@3d-dice/dice-box/dist");

if (!existsSync(src)) {
  console.log("⚠ @3d-dice/dice-box assets not found — skipping copy");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });

// Copy assets (ammo wasm + themes)
cpSync(src, dest, { recursive: true });

// Copy worker JS files needed at runtime
const workers = ["world.offscreen.min.js", "world.onscreen.min.js", "Dice.min.js"];
for (const f of workers) {
  const s = join(distSrc, f);
  if (existsSync(s)) cpSync(s, join(dest, f));
}

console.log("✔ Dice-box assets copied to public/assets/dice-box/");
