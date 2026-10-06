// compareWithVerse with the stored Uthmani and IndoPak texts of each verse (quran_verse_scripts, quranpedia mushafs 2
// and 3), on the 23 verses of quran-scripts.json as 11 websites write them. The stored texts are in
// __fixtures__/quran-stored-scripts.json, so no network or database is needed.
import { describe, expect, it, vi } from "vitest";
import fixture from "./__fixtures__/quran-scripts.json";
import stored from "./__fixtures__/quran-stored-scripts.json";
import type { Claim } from "./claims";
import { compareWithVerse, type VerseHit, type VerseScriptText } from "./quranCheck";
import { STATES, verifyClaims, type VerifyDeps } from "./verify";

type Fx = { key: string; row: VerseHit; scripts: Record<string, string> };
const verses = (fixture as { verses: Fx[] }).verses;
const storedOf = (key: string) => (stored as { verses: { key: string; scripts: VerseScriptText[] }[] }).verses.find((v) => v.key === key)!.scripts;
const withStored = (f: Fx): VerseHit => ({ ...f.row, scripts: storedOf(f.key) });
/** The basmala alquran.cloud puts before a first verse is not part of the verse. */
const quoteOf = (f: Fx, script: string) => {
  const q = f.scripts[script];
  const toks = q.split(/\s+/);
  return f.row.ayah === 1 && f.key !== "1:1" && q.replace(/[^ء-ي]/g, "").startsWith("بسم") && toks.length > 4 ? toks.slice(4).join(" ") : q;
};
const letters = (t: string) => t.replace(/[^ء-يیٮ]/g, "");
const middleWord = (q: string) => {
  const idx = q.split(/\s+/).flatMap((t, i) => (letters(t) ? [i] : []));
  return idx[Math.floor(idx.length / 2)];
};
/** Uthmani with every mark removed (quran.com's «uthmani_simple»): not stored, so two verses whose letters differ from
 *  every stored text are not matched (2:164 «اختلف», 6:76 «رءا»). */
const MARKS_FREE_MISSES = ["2:164", "6:76"];
const SCRIPTS = Object.keys(verses[0].scripts);

describe("compareWithVerse with the stored scripts", () => {
  it.each(SCRIPTS)("accepts every verse as %s writes it", (script) => {
    const missed = verses.filter((f) => !compareWithVerse(quoteOf(f, script), withStored(f)).exact).map((f) => f.key);
    expect(missed).toEqual(script === "uthmani_simple" ? MARKS_FREE_MISSES : []);
  });

  it.each(SCRIPTS)("still reports a dropped and a changed word as %s writes it", (script) => {
    for (const f of verses) {
      const toks = quoteOf(f, script).split(/\s+/);
      const mid = middleWord(toks.join(" "));
      expect(compareWithVerse(toks.filter((_, i) => i !== mid).join(" "), withStored(f)).exact).toBe(false);
      const changed = [...toks];
      changed[mid] = "الكافرين";
      expect(compareWithVerse(changed.join(" "), withStored(f)).exact).toBe(false);
    }
  });

  it("names the script it compared with and shows the corrections in it", () => {
    const f = verses.find((v) => v.key === "2:43")!;
    const ok = compareWithVerse(f.scripts.indopak_nastaleeq, withStored(f));
    expect(ok).toMatchObject({ exact: true, script: "indopak" });
    // «الزكوة», the fourth word, changed to «الصدقة»: the correction is the IndoPak word.
    const toks = f.scripts.indopak_nastaleeq.split(/\s+/);
    toks[3] = "الصَّدَقَةَ";
    const wrong = compareWithVerse(toks.join(" "), withStored(f));
    expect(wrong.script).toBe("indopak");
    const indopakWord = storedOf("2:43").find((s) => s.script === "indopak")!.text.split(/\s+/)[3];
    expect(wrong.diffs).toEqual([{ op: "replaced", typed: "الصَّدَقَةَ", correct: indopakWord }]);
    expect(letters(indopakWord)).toBe("الزكوة");
  });

  it("decides a standard-spelling quote with the standard text, as before", () => {
    const f = verses.find((v) => v.key === "2:153")!;
    expect(compareWithVerse(f.scripts.imlaei, withStored(f)).script).toBeUndefined();
  });
});

const quran = (t: string): Claim => ({
  kind: "quran", textAsWritten: t, spanCheck: "exact", arabicSpan: t, query: t, queryIsTranslation: false,
  language: "ar", attributedTo: null, citedSource: null, warnings: [],
});
function deps(hits: VerseHit[], verseScripts: VerifyDeps["verseScripts"]): VerifyDeps {
  return {
    matchVerses: vi.fn(async () => hits),
    matchVersesInText: vi.fn(async () => hits),
    verseScripts,
    matchSayings: vi.fn(async () => []),
    lookupDorar: vi.fn(async () => ({ ok: true as const, results: [], origin: "live" as const })),
  };
}
const byKey = (keys: { surah: number; ayah: number }[]) => new Map(keys.map((k) => [`${k.surah}:${k.ayah}`, storedOf(`${k.surah}:${k.ayah}`)]));

describe("verifyClaims with the stored scripts", () => {
  const f = verses.find((v) => v.key === "2:43")!;
  const hit = { ...f.row, score: 0.9 };

  it("accepts an IndoPak quote and shows the verse in IndoPak", async () => {
    const [r] = await verifyClaims([quran(f.scripts.indopak_nastaleeq)], deps([hit], async (keys) => byKey(keys)));
    expect(r.state).toBe(STATES.verseOk);
    expect(r.verse?.text).toBe(storedOf("2:43").find((s) => s.script === "indopak")!.text);
  });

  it("compares with the standard text alone when the stored scripts cannot be read", async () => {
    const [r] = await verifyClaims([quran(f.scripts.indopak_nastaleeq)], deps([hit], async () => { throw new Error("HTTP 500"); }));
    expect(r.state).toBe(STATES.verseWrong);
    expect(r.verse?.wording?.script).toBeUndefined();
  });

  it("accepts an IndoPak block of several verses", async () => {
    const keys = ["112:1", "112:4"].map((k) => verses.find((v) => v.key === k)!);
    // 112:1 and 112:4 are the fixture's verses of al-Ikhlas; the block here is the two of them, which are not
    // consecutive, so each is a verse of its own.
    const quote = keys.map((k) => k.scripts.indopak_nastaleeq).join(" ");
    const rs = await verifyClaims([quran(quote)], deps(keys.map((k) => ({ ...k.row, score: 1 })), async (ks) => byKey(ks)));
    expect(rs.map((r) => [r.verse?.ayah, r.state])).toEqual([[1, STATES.verseOk], [4, STATES.verseOk]]);
  });
});
