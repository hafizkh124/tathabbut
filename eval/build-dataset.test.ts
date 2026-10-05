import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STATES } from "../src/lib/states";
import { disputedLabel, distortVerse, propheticWords, rng, splitOf, weakLabel } from "./build-dataset";
import { skeleton } from "./scoring";
import type { EvalPrompt } from "./types";

describe("distortVerse", () => {
  it("never returns the verse unchanged (the old builder left 43 exact verses labelled «misquoted»)", () => {
    const verses = [
      "أَلَمْ تَعْلَمْ أَنَّ ٱللَّهَ لَهُۥ مُلْكُ ٱلسَّمَٰوَٰتِ وَٱلْأَرْضِ وَمَا لَكُم مِّن دُونِ ٱللَّهِ مِن وَلِىٍّۢ وَلَا نَصِيرٍ",
      "يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوٓا۟ أَنفِقُوا۟ مِن طَيِّبَٰتِ مَا كَسَبْتُمْ",
      "وَكَيْفَ تَأْخُذُونَهُۥ وَقَدْ أَفْضَىٰ بَعْضُكُمْ إِلَىٰ بَعْضٍۢ",
      "إِنَّ ٱللَّهَ غَفُورٌ رَّحِيمٌ",
    ];
    const r = rng(1);
    for (const v of verses) for (let i = 0; i < 20; i++) {
      const d = distortVerse(v, r);
      if (d) expect(skeleton(d.text)).not.toBe(skeleton(v));
    }
  });
  it("is deterministic for a seed", () => {
    const v = "وَقُل لِّعِبَادِى يَقُولُوا۟ ٱلَّتِى هِىَ أَحْسَنُ ۚ إِنَّ ٱلشَّيْطَٰنَ يَنزَغُ بَيْنَهُمْ";
    expect(distortVerse(v, rng(5))).toEqual(distortVerse(v, rng(5)));
  });
});

describe("propheticWords", () => {
  it("takes the Prophet's words without the chain", () => {
    const t = 'حدثنا علي بن محمد، حدثنا وكيع، عن ثوبان، قال قال رسول الله ـ صلى الله عليه وسلم ـ ‏ "‏ لا يزيد في العمر إلا البر ولا يرد القدر إلا الدعاء ‏"‏ ‏.‏';
    expect(propheticWords(t)).toBe("لا يزيد في العمر إلا البر ولا يرد القدر إلا الدعاء");
  });
  it("refuses a text cut before its closing quote, and a chain-only fragment", () => {
    expect(propheticWords('حدثنا أبو كريب ... قال رسول الله ‏"‏ م')).toBeNull();
    expect(propheticWords("وحدثنا قتيبة بن سعيد، بهذا الإسناد ولم يذكر")).toBeNull();
  });
});

describe("grader labels", () => {
  it("weak only when every grader says weak", () => {
    expect(weakLabel("Al-Albani: Daif; Zubair Ali Zai: Daif")?.state).toBe(STATES.daif);
    expect(weakLabel("Ahmad Muhammad Shakir: Sahih; Al-Albani: Daif")).toBeNull();
    expect(weakLabel("Al-Albani: Mawdu; Zubair Ali Zai: Very Daif")?.state).toBe(STATES.shadid);
  });
  it("disagreeing graders give a set of accepted states", () => {
    expect(disputedLabel("Ahmad Muhammad Shakir: Sahih; Al-Albani: Daif")?.sort()).toEqual([STATES.maqbul, STATES.daif].sort());
  });
});

// dataset.json holds third-party texts and is not published (see README); these checks run where it has been built.
const DATASET = join(__dirname, "dataset.json");
describe.skipIf(!existsSync(DATASET))("the built dataset", () => {
  const data = (existsSync(DATASET) ? JSON.parse(readFileSync(DATASET, "utf8")) : []) as EvalPrompt[];
  it("has distinct prompts and ids", () => {
    expect(new Set(data.filter((p) => !p.image).map((p) => p.prompt)).size).toBe(data.filter((p) => !p.image).length);
    expect(new Set(data.map((p) => p.id)).size).toBe(data.length);
  });
  it("uses the app's claim kinds only", () => {
    const kinds = new Set(data.flatMap((p) => p.expectedClaims.map((c) => c.kind)));
    for (const k of kinds) expect(["hadith", "quran", "scholar_quote", "question", "other"]).toContain(k);
  });
  it("quotes every expected claim verbatim in its prompt", () => {
    for (const p of data) for (const c of p.expectedClaims) expect(p.prompt.includes(c.quotedText), p.id).toBe(true);
  });
  it("never marks a label as reviewed by itself", () => {
    expect(data.every((p) => p.label.status === "unreviewed" || p.label.reviewer)).toBe(true);
  });
  it("keeps all wordings of one text in the same split", () => {
    for (const p of data) expect(p.split).toBe(splitOf(p.group));
  });
  it("has no chain of narrators and names no surah in translation prompts", () => {
    for (const p of data) {
      if (p.category.startsWith("hadith")) expect(/(^|\s)(حدثنا|أخبرنا)\s/.test(p.prompt), p.id).toBe(false);
      if (p.category === "quran_translation") expect(/سُورَة|surah/i.test(p.prompt), p.id).toBe(false);
    }
  });
});
