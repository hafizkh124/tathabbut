// Renders a seeded sample of dataset prompts as chat-style screenshots, so the OCR path (/api/ocr → /api/verify) is
// evaluated too. These are RENDERED images (clean fonts, no compression artefacts): they test the path, not the hardest
// real screenshots — real ones collected from WhatsApp/Facebook should be added next to them.
//
//   npm i --no-save playwright-core @fontsource/noto-naskh-arabic
//   npx tsx eval/make-screenshots.ts             # → eval/screenshots/*.png and eval/sources/screenshots.json
//   npx tsx eval/build-dataset.ts                # adds them to dataset.json as category «ocr_screenshot»
//
// Chromium: set CHROMIUM_PATH, or the Playwright browser installed on the machine is used.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { rng } from "./build-dataset";
import type { EvalCategory, EvalPrompt } from "./types";

const DIR = __dirname;
const PLAN: Partial<Record<EvalCategory, number>> = {
  quran_exact: 8,
  quran_distorted: 8,
  quran_translation: 4,
  hadith_sahih: 6,
  hadith_weak: 4,
  circulating_saying: 6,
  no_source: 4,
  fiqh_personal: 4,
  multilingual: 4,
  multi_claim: 8,
};

const THEMES = [
  { bg: "#e5ddd5", bubble: "#ffffff", ink: "#111b21", meta: "#667781" },
  { bg: "#0b141a", bubble: "#202c33", ink: "#e9edef", meta: "#8696a0" },
  { bg: "#f0f2f5", bubble: "#ffffff", ink: "#050505", meta: "#65676b" },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function main() {
  let chromium: { launch: (o: object) => Promise<{ newPage: (o: object) => Promise<{ setContent: (h: string) => Promise<void>; locator: (s: string) => { screenshot: (o: object) => Promise<Buffer> } }>; close: () => Promise<void> }> };
  try {
    chromium = (await import("playwright-core" as string)).chromium;
  } catch {
    throw new Error("playwright-core is not installed: npm i --no-save playwright-core @fontsource/noto-naskh-arabic");
  }
  let font = "";
  try {
    const f = require.resolve("@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-400-normal.woff2");
    font = `@font-face{font-family:Naskh;src:url(data:font/woff2;base64,${readFileSync(f).toString("base64")}) format("woff2");}`;
  } catch {
    console.warn("@fontsource/noto-naskh-arabic not found: the system's Arabic font is used");
  }

  const data = JSON.parse(readFileSync(join(DIR, "dataset.json"), "utf8")) as EvalPrompt[];
  const r = rng(77);
  const chosen: EvalPrompt[] = [];
  for (const [cat, n] of Object.entries(PLAN) as Array<[EvalCategory, number]>) {
    const seen = new Set<string>();
    const pool = data.filter((p) => p.category === cat && !p.metadata?.conflict);
    const order = pool.map((p) => ({ p, k: r() })).sort((a, b) => a.k - b.k).map((x) => x.p);
    for (const p of order) {
      if (chosen.filter((c) => c.category === cat).length >= n) break;
      if (seen.has(p.group)) continue;
      seen.add(p.group);
      chosen.push(p);
    }
  }

  const exe = process.env.CHROMIUM_PATH ?? (existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 460, height: 900 }, deviceScaleFactor: 2 });
  mkdirSync(join(DIR, "screenshots"), { recursive: true });
  const list: Array<{ from: string; path: string }> = [];
  for (const [i, p] of chosen.entries()) {
    const t = THEMES[i % THEMES.length];
    const dir = p.language === "en" ? "ltr" : "rtl";
    const html = `<!doctype html><meta charset="utf-8"><style>${font}
      body{margin:0;background:${t.bg};font-family:Naskh,"Noto Naskh Arabic","DejaVu Sans",sans-serif}
      #shot{padding:18px 14px;width:432px;box-sizing:border-box;background:${t.bg}}
      .b{background:${t.bubble};color:${t.ink};border-radius:10px;padding:10px 12px 18px;font-size:${17 + (i % 3)}px;line-height:1.75;direction:${dir};white-space:pre-wrap;box-shadow:0 1px 0.5px rgba(0,0,0,.13);position:relative}
      .m{position:absolute;bottom:3px;${dir === "rtl" ? "left" : "right"}:10px;font-size:11px;color:${t.meta};font-family:sans-serif}
    </style><div id="shot"><div class="b">${esc(p.prompt)}<span class="m">${String(9 + (i % 12)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}</span></div></div>`;
    await page.setContent(html);
    const rel = `screenshots/${p.id}.png`;
    writeFileSync(join(DIR, rel), await page.locator("#shot").screenshot({ type: "png" }));
    list.push({ from: p.id, path: rel });
  }
  await browser.close();
  writeFileSync(join(DIR, "sources", "screenshots.json"), JSON.stringify(list, null, 1) + "\n");
  console.log(`rendered ${list.length} screenshots; now run npx tsx eval/build-dataset.ts`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
