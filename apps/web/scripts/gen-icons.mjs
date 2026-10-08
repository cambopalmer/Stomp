// Renders public/icon.svg to the PNG sizes a home-screen install needs.
// Run: node scripts/gen-icons.mjs  (uses Playwright's Chromium — no image libraries)
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync(new URL("../public/icon.svg", import.meta.url), "utf8");
const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const targets = [
  { name: "icon-192.png", size: 192, pad: 0 },
  { name: "icon-512.png", size: 512, pad: 0 },
  // maskable: Android crops to a circle/squircle — keep the glyph inside the 80% safe zone
  { name: "icon-maskable-512.png", size: 512, pad: 0.1 },
  { name: "apple-touch-icon.png", size: 180, pad: 0 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  const inner = Math.round(t.size * (1 - 2 * t.pad));
  await page.setContent(
    `<html><body style="margin:0;background:#4f46e5;display:grid;place-items:center;width:${t.size}px;height:${t.size}px">
      <div style="width:${inner}px;height:${inner}px">${svg.replace("<svg", `<svg width="${inner}" height="${inner}"`)}</div>
    </body></html>`,
  );
  await page.screenshot({ path: out(t.name), omitBackground: false });
  console.log("wrote", t.name);
}
await browser.close();
