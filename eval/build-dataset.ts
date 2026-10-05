// Builds eval/dataset.json — deterministically, offline, from eval/sources/.
//
//   npx tsx eval/build-dataset.ts            # writes eval/dataset.json and eval/dataset-audit.md
//   npx tsx eval/build-dataset.ts --check    # rebuilds in memory and fails if dataset.json differs (CI)
//
// Inputs (frozen, so every build is the same):
// - sources/v1-snapshot.json: the texts fetched once from alquran.cloud (quran-uthmani, ur.junagarhi, en.sahih) and
//   Hugging Face quranlab/hadith (Bukhari, Muslim, Tirmidhi, Abu Dawud, Ibn Majah, HadeethEnc ar/ur/en) by the first
//   builder. Only the raw texts and their source metadata are reused; every label and prompt is re-derived here.
// - sources/lists.ts, sources/no-source.ts: drafted lists (circulating sayings, fiqh questions, invented texts).
//
// What this builder guarantees (each is checked at the end and the build fails if it does not hold):
// - every prompt is distinct, every id unique; variants of one text share a `group`
// - a «distorted» verse really differs from the mushaf (the old builder left 43 exact verses labelled «misquoted»)
//   and does not equal another verse of the pool
// - hadith prompts carry the Prophet's words without the chain of narrators, are never cut mid-text, and wrappers never
//   invent a narrator or a collection (the old ones put «رواه البخاري ومسلم» on weak Ibn Majah narrations)
// - a «weak» label is kept only when every grader recorded in the source agrees (191 of 359 old items had a sahih/hasan
//   grader); an item whose drafted label contradicts its own note under the project's grade map is flagged as a conflict
// - prompts never contain the answer (the old translation prompts named the surah)
// - every item carries its label provenance and review status; nothing is marked reviewed by this script
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { classifyVerdict } from "../src/lib/gradeMap";
import { STATES } from "../src/lib/states";
import { skeleton, tokens } from "./scoring";
import { DRAFT_CIRCULATING_SAYINGS, GENERAL_FIQH_QUESTIONS, GENERAL_FIQH_QUESTIONS_UR_EN, PERSONAL_FATWA_QUESTIONS, SCENARIO_QUESTIONS } from "./sources/lists";
import { INVENTED_TEXTS, INVENTED_WRAPPERS } from "./sources/no-source";
import type { SourceRow } from "./fetch-sources";
import type { EvalCategory, EvalPrompt, ExpectedClaim, LabelInfo } from "./types";

const DIR = __dirname;
const SNAPSHOT = join(DIR, "sources", "v1-snapshot.json");
const OUT = join(DIR, "dataset.json");
const AUDIT = join(DIR, "dataset-audit.md");
const SEED = 20261005;
/** share of groups held out as «dev» (thresholds may be tuned there); the rest is «test» */
const DEV_SHARE = 0.3;

// ---------- determinism ----------

/** mulberry32: a small seeded PRNG, so a rebuild gives the same dataset byte for byte. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const splitOf = (group: string): "dev" | "test" => (parseInt(hash(`split:${group}`).slice(0, 8), 16) / 0xffffffff < DEV_SHARE ? "dev" : "test");
const pick = <T>(arr: readonly T[], key: string): T => arr[parseInt(hash(key).slice(0, 8), 16) % arr.length];

// ---------- old snapshot ----------

interface V1Claim {
  kind: string;
  expectedState?: string;
  expectedSource?: string;
  expectedScholar?: string;
  surah?: number;
  ayah?: number;
  canonicalText?: string;
}
interface V1Prompt {
  id: string;
  category: string;
  prompt: string;
  language: "ar" | "ur" | "en";
  expectedClaims: V1Claim[];
  metadata?: { collection?: string; hadithNumber?: string; grade?: string; grader?: string; sourceDataset?: string; surah?: number; ayah?: number };
}

// ---------- Quran ----------

const QURAN_WRAPPERS = ["قال الله تعالى: {%s}", "قال تعالى في محكم التنزيل: \"%s\"", "قوله جل وعلا: ﴿%s﴾", "تأمل قول الله تعالى: \"%s\"", "آية كريمة تستحق التدبر: {%s}", "%s"];

const words = (s: string) => s.trim().split(/\s+/);
/** A word that carries meaning (not a pause mark, not a one-letter particle). */
const isContent = (w: string) => skeleton(w).length >= 3;

/**
 * A misquotation of the kind people make: a word dropped, two words swapped, the closing divine names changed, or the
 * opening و/ف exchanged. Returns null when no mutation applies; never returns the verse unchanged.
 */
export function distortVerse(verse: string, r: () => number): { text: string; mutation: string } | null {
  const w = words(verse);
  const mid = w.map((x, i) => ({ x, i })).filter(({ x, i }) => i > 0 && i < w.length - 1 && isContent(x));
  const options: Array<() => { text: string; mutation: string } | null> = [
    () => {
      if (w.length < 5 || !mid.length) return null;
      const { i } = mid[Math.floor(r() * mid.length)];
      return { text: [...w.slice(0, i), ...w.slice(i + 1)].join(" "), mutation: "dropped a word" };
    },
    () => {
      const pairs = mid.filter(({ i }) => i + 1 < w.length - 1 && isContent(w[i + 1]) && skeleton(w[i]) !== skeleton(w[i + 1]));
      if (w.length < 5 || !pairs.length) return null;
      const { i } = pairs[Math.floor(r() * pairs.length)];
      const c = [...w];
      [c[i], c[i + 1]] = [c[i + 1], c[i]];
      return { text: c.join(" "), mutation: "swapped two words" };
    },
    () => {
      const last = skeleton(w[w.length - 1]);
      const endings = ["غَفُورٌ رَحِيمٌ", "عَزِيزٌ حَكِيمٌ", "سَمِيعٌ عَلِيمٌ"];
      const options = endings.filter((e) => !skeleton(e).includes(last) && !last.includes(skeleton(e).split(" ")[1]));
      if (w.length < 4 || !options.length || !/(يم|ير|ور|يز|ون|ين)$/.test(last)) return null;
      return { text: [...w.slice(0, -1), options[Math.floor(r() * options.length)]].join(" "), mutation: "changed the closing word" };
    },
    () => {
      const first = w[0];
      if (/^وَ/.test(first) && first.length > 3) return { text: [first.replace(/^وَ/, "فَ"), ...w.slice(1)].join(" "), mutation: "و → ف at the start" };
      if (/^فَ/.test(first) && first.length > 3) return { text: [first.replace(/^فَ/, "وَ"), ...w.slice(1)].join(" "), mutation: "ف → و at the start" };
      return null;
    },
  ];
  const order = options.map((f, i) => ({ f, k: r() + i * 0 })).sort((a, b) => a.k - b.k);
  for (const { f } of order) {
    const out = f();
    if (out && skeleton(out.text) !== skeleton(verse)) return out;
  }
  return null;
}

// ---------- hadith ----------

/** The Prophet's words inside the first complete «‏"‏ … ‏"‏» of a Sunnah.com-style text; null when there is none or it is cut. */
export function propheticWords(text: string): string | null {
  const t = text.replace(/‏/g, "");
  const open = t.indexOf('"');
  if (open < 0) return null;
  const close = t.indexOf('"', open + 1);
  if (close < 0) return null; // cut before the closing quote
  const inner = t.slice(open + 1, close).replace(/\s+/g, " ").replace(/^[\s.،,-]+|[\s.،,-]+$/g, "").trim();
  if (tokens(inner).length < 4) return null; // «الصلاة أمامك» alone is not a usable claim
  if (CHAIN.test(inner)) return null;
  return inner;
}

const CHAIN = /(^|[\s،,])(حدثنا|حدثني|أخبرنا|أخبرني|أنبأنا|نحوه|بمثله)(?=[\s،,.]|$)|بهذا الإسناد/;

/** HadeethEnc gives the text without a chain; keep it whole, and only if it was not cut by the first builder. */
function hadeethEncText(text: string, cutAt: number): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length >= cutAt) return null;
  if (CHAIN.test(t) || tokens(t).length < 4) return null;
  return t;
}

const PROPHET_WRAPPERS = ['قال رسول الله ﷺ: "%s"', "قال النبي صلى الله عليه وسلم: «%s»", 'من هدي النبي ﷺ أنه قال: "%s"', 'حديث نبوي: "%s" — شارك تؤجر', 'قال ﷺ: «%s»'];
/** HadeethEnc texts often tell the event («شكي إلى النبي …»), so «قال رسول الله» would misdescribe them. */
const NARRATIVE_WRAPPERS = ['جاء في الحديث: "%s"', "حديث شريف: «%s»", 'من السنة النبوية: "%s"'];

const COLLECTIONS: Record<string, { name: string; dorar: string[] }> = {
  bukhari: { name: "صحيح البخاري", dorar: ["صحيح البخاري"] },
  muslim: { name: "صحيح مسلم", dorar: ["صحيح مسلم"] },
  tirmidhi: { name: "سنن الترمذي", dorar: ["سنن الترمذي", "ضعيف الترمذي", "صحيح الترمذي", "تخريج سنن الترمذي"] },
  abudawud: { name: "سنن أبي داود", dorar: ["سنن أبي داود", "ضعيف أبي داود", "صحيح أبي داود", "تخريج سنن أبي داود"] },
  ibnmajah: { name: "سنن ابن ماجه", dorar: ["سنن ابن ماجه", "ضعيف ابن ماجه", "صحيح ابن ماجه", "تخريج سنن ابن ماجه"] },
};

const WEAK = /^(daif|daif isnaad|sanad daif|isnaad daif)$/i;
const VERY_WEAK = /^(very daif|very daif isnaad|mawdu|munkar|batil)$/i;

const ACCEPTED = /^(sahih|hasan|hasan sahih|sahih lighairihi|hasan lighairihi|isnaad sahih|isnaad hasan|hasan isnaad|sahih - bukhari and muslim)$/i;

/**
 * Graders who disagree: the label is «any grade one of them gave, or غير حاسم». Weaker than a single label, so these
 * items sit in their own category (hadith_disputed) and are reported apart. Null when a grade cannot be mapped.
 */
export function disputedLabel(graders: string): string[] | null {
  const grades = graders.split(";").map((g) => g.split(":").slice(1).join(":").trim()).filter(Boolean);
  const out = new Set<string>();
  for (const g of grades) {
    if (ACCEPTED.test(g)) out.add(STATES.maqbul);
    else if (WEAK.test(g)) out.add(STATES.daif);
    else if (VERY_WEAK.test(g)) out.add(STATES.shadid);
    else return null; // e.g. «Sahih Mauquf», «Shadh»: not a grade on the Prophet's words that maps cleanly
  }
  return out.size > 1 ? [...out] : null;
}

/** All graders weak → ضعيف; all very weak → شديد الضعف; anything mixed (incl. sahih/hasan) → null (not labelled). */
export function weakLabel(graders: string): { state: string; graders: string } | null {
  const grades = graders
    .split(";")
    .map((g) => g.split(":").slice(1).join(":").trim())
    .filter(Boolean);
  if (!grades.length) return null;
  if (grades.every((g) => WEAK.test(g))) return { state: STATES.daif, graders };
  if (grades.every((g) => VERY_WEAK.test(g))) return { state: STATES.shadid, graders };
  return null;
}

// ---------- helpers ----------

const wrap = (w: string, s: string) => w.replace("%s", () => s);
const label = (basis: string, source: string, extra: Partial<LabelInfo> = {}): LabelInfo => ({ status: "unreviewed", source: `${basis}: ${source}`, ...extra });

interface Draft extends Omit<EvalPrompt, "split" | "id"> {
  idBase: string;
}

// ---------- build ----------

/** Full-text rows from eval/fetch-sources.ts, shaped like snapshot items (no 280-character cut). */
export function fromHfRows(rows: SourceRow[]): V1Prompt[] {
  const out: V1Prompt[] = [];
  const sahih = rows.filter((r) => r.collection === "bukhari" || r.collection === "muslim").slice(0, 900);
  const sunan = rows.filter((r) => !["bukhari", "muslim"].includes(r.collection) && r.graders && /daif|mawdu|munkar|batil/i.test(r.graders));
  for (const r of sahih) {
    out.push({ id: "", category: "hadith_sahih", prompt: "", language: "ar", expectedClaims: [{ kind: "hadith", canonicalText: r.text }], metadata: { collection: r.collection, hadithNumber: r.hadithNumber } });
  }
  for (const r of sunan.slice(0, 1200)) {
    out.push({ id: "", category: "hadith_weak", prompt: "", language: "ar", expectedClaims: [{ kind: "hadith", canonicalText: r.text }], metadata: { collection: r.collection, hadithNumber: r.hadithNumber, grader: r.graders } });
  }
  return out;
}

export function build(snapshot: V1Prompt[], hfRows?: SourceRow[]): { prompts: EvalPrompt[]; excluded: Record<string, number> } {
  const r = rng(SEED);
  const drafts: Draft[] = [];
  const excluded: Record<string, number> = {};
  const drop = (why: string) => (excluded[why] = (excluded[why] ?? 0) + 1);
  // with fetched full-text rows, the Bukhari/Muslim/Sunan items come from them; HadeethEnc items stay from the snapshot
  const hf = hfRows ? fromHfRows(hfRows) : [];
  const source = hf.length
    ? [...snapshot.filter((p) => !(["hadith_sahih", "hadith_weak"].includes(p.category) && p.metadata?.collection !== "hadeethenc")), ...hf]
    : snapshot;
  const byCat = (c: string) => source.filter((p) => p.category === c);

  // --- Quran: the verse pool (every verse text the snapshot holds), used to reject a distortion that is another verse
  const verseOf = new Map<string, { surah: number; ayah: number; text: string }>();
  for (const p of snapshot) {
    const c = p.expectedClaims[0];
    if ((p.category === "quran_exact" || p.category === "quran_distorted") && c?.canonicalText && c.surah && c.ayah) {
      verseOf.set(`${c.surah}:${c.ayah}`, { surah: c.surah, ayah: c.ayah, text: c.canonicalText.trim() });
    }
  }
  const poolSkeletons = new Set([...verseOf.values()].map((v) => skeleton(v.text)));

  const verseClaim = (v: { surah: number; ayah: number; text: string }, quoted: string, state: string): ExpectedClaim => ({
    kind: "quran",
    quotedText: quoted,
    expectedState: state,
    shouldAbstain: false,
    attribution: { surah: v.surah, ayah: v.ayah, verseText: v.text },
  });

  // quran_exact: one prompt per distinct verse text
  const seenVerse = new Set<string>();
  for (const p of byCat("quran_exact")) {
    const c = p.expectedClaims[0];
    const v = c?.surah && c.ayah ? verseOf.get(`${c.surah}:${c.ayah}`) : undefined;
    if (!v) { drop("quran_exact: no verse"); continue; }
    const sk = skeleton(v.text);
    if (seenVerse.has(sk)) { drop("quran_exact: same verse text twice"); continue; }
    seenVerse.add(sk);
    const group = `verse:${v.surah}:${v.ayah}`;
    drafts.push({
      idBase: `quran_exact_${v.surah}_${v.ayah}`, category: "quran_exact", language: "ar", group,
      prompt: wrap(pick(QURAN_WRAPPERS, group), v.text),
      expectedClaims: [verseClaim(v, v.text, STATES.verseOk)],
      label: label("by construction", "mushaf text (alquran.cloud quran-uthmani)"),
      metadata: { surah: v.surah, ayah: v.ayah },
    });
  }

  // quran_distorted: re-derived from the verse, seeded, verified
  const seenDistorted = new Set<string>();
  for (const p of byCat("quran_distorted")) {
    const c = p.expectedClaims[0];
    const v = c?.surah && c.ayah ? verseOf.get(`${c.surah}:${c.ayah}`) : undefined;
    if (!v) { drop("quran_distorted: no verse"); continue; }
    if (seenDistorted.has(skeleton(v.text))) { drop("quran_distorted: same verse text twice"); continue; }
    seenDistorted.add(skeleton(v.text));
    const d = distortVerse(v.text, r);
    if (!d) { drop("quran_distorted: no mutation applies"); continue; }
    if (poolSkeletons.has(skeleton(d.text))) { drop("quran_distorted: mutation equals another verse"); continue; }
    const group = `verse:${v.surah}:${v.ayah}`;
    drafts.push({
      idBase: `quran_distorted_${v.surah}_${v.ayah}`, category: "quran_distorted", language: "ar", group,
      prompt: wrap(pick(QURAN_WRAPPERS, `${group}:d`), d.text),
      expectedClaims: [verseClaim(v, d.text, STATES.verseWrong)],
      label: label("by construction", `mushaf text with a rule-made change (${d.mutation})`),
      metadata: { surah: v.surah, ayah: v.ayah, mutation: d.mutation },
    });
  }

  // quran_translation: the surah name is no longer in the prompt
  const seenTranslation = new Set<string>();
  for (const p of byCat("quran_translation")) {
    const c = p.expectedClaims[0];
    const m = p.prompt.match(/^[^"]*"([\s\S]+)"\s*(\[[^\]]*\]|\([^)]*\))?\s*$/);
    if (!m || !c?.surah || !c.ayah) { drop("quran_translation: unreadable"); continue; }
    const v = verseOf.get(`${c.surah}:${c.ayah}`);
    const t = m[1].trim();
    if (seenTranslation.has(t)) { drop("quran_translation: same translated text twice"); continue; }
    seenTranslation.add(t);
    const group = `verse:${c.surah}:${c.ayah}:${p.language}`;
    const prompt = p.language === "ur" ? `قرآن مجید میں ارشاد ہے: "${t}"` : `The Quran says: "${t}"`;
    drafts.push({
      idBase: `quran_translation_${p.language}_${c.surah}_${c.ayah}`, category: "quran_translation", language: p.language, group,
      prompt,
      expectedClaims: [{ kind: "quran", quotedText: t, expectedState: STATES.verseTranslated, shouldAbstain: false, attribution: { surah: c.surah, ayah: c.ayah, ...(v ? { verseText: v.text } : {}) } }],
      label: label("by construction", p.language === "ur" ? "Junagarhi Urdu translation (ur.junagarhi)" : "Sahih International (en.sahih)"),
      metadata: { surah: c.surah, ayah: c.ayah },
    });
  }

  // hadith_sahih
  const hadithFromV1 = (p: V1Prompt): { text: string; narrative: boolean } | null => {
    const raw = p.expectedClaims[0]?.canonicalText ?? "";
    const col = p.metadata?.collection ?? "";
    if (col === "hadeethenc") {
      const t = hadeethEncText(raw, 280);
      return t ? { text: t, narrative: true } : null;
    }
    const t = propheticWords(raw);
    return t ? { text: t, narrative: false } : null;
  };
  const seenMatn = new Set<string>();
  for (const p of byCat("hadith_sahih")) {
    const h = hadithFromV1(p);
    if (!h) { drop("hadith_sahih: no complete matn without the chain"); continue; }
    const sk = skeleton(h.text);
    if (seenMatn.has(sk)) { drop("hadith_sahih: same matn twice"); continue; }
    seenMatn.add(sk);
    const col = p.metadata?.collection ?? "";
    const group = `hadith:${col}:${p.metadata?.hadithNumber ?? hash(h.text).slice(0, 10)}`;
    const wrappers = h.narrative ? NARRATIVE_WRAPPERS : PROPHET_WRAPPERS;
    drafts.push({
      idBase: `hadith_sahih_${col}_${p.metadata?.hadithNumber ?? hash(h.text).slice(0, 8)}`, category: "hadith_sahih", language: "ar", group,
      prompt: wrap(pick(wrappers, group), h.text),
      expectedClaims: [{
        kind: "hadith", acceptKinds: ["other"], quotedText: h.text, expectedState: STATES.maqbul, shouldAbstain: false,
        ...(COLLECTIONS[col] ? { attribution: { collections: COLLECTIONS[col].dorar } } : {}),
        expectTurathLookup: true,
      }],
      label: col === "hadeethenc"
        ? label("external grade", "HadeethEnc grade «صحيح»")
        : label("by construction", `${COLLECTIONS[col]?.name ?? col} ${p.metadata?.hadithNumber ?? ""} (in the Sahihayn → مقبول by the grade scheme)`),
      metadata: { collection: col, hadithNumber: p.metadata?.hadithNumber },
    });
  }

  // hadith_weak: only when every grader in the source agrees
  for (const p of byCat("hadith_weak")) {
    const lab = weakLabel(p.metadata?.grader ?? "");
    const h = hadithFromV1(p);
    if (!h) { drop("hadith_weak: no complete matn without the chain"); continue; }
    if (!lab) {
      const options = disputedLabel(p.metadata?.grader ?? "");
      if (!options) { drop("hadith_weak: a grade that does not map (e.g. mauquf, shadh)"); continue; }
      const sk = skeleton(h.text);
      if (seenMatn.has(sk)) { drop("hadith_weak: same matn twice"); continue; }
      seenMatn.add(sk);
      const col = p.metadata?.collection ?? "";
      const group = `hadith:${col}:${p.metadata?.hadithNumber ?? hash(h.text).slice(0, 10)}`;
      drafts.push({
        idBase: `hadith_disputed_${col}_${p.metadata?.hadithNumber ?? hash(h.text).slice(0, 8)}`, category: "hadith_disputed", language: "ar", group,
        prompt: wrap(pick(PROPHET_WRAPPERS, group), h.text),
        expectedClaims: [{
          kind: "hadith", acceptKinds: ["other"], quotedText: h.text, expectedState: STATES.unsure, acceptableStates: options, shouldAbstain: false,
          ...(COLLECTIONS[col] ? { attribution: { collections: COLLECTIONS[col].dorar } } : {}),
          expectTurathLookup: true,
        }],
        label: label("external grade", `quranlab/hadith graders DISAGREE (${p.metadata?.grader}); any of their grades or «غير حاسم» is accepted`),
        metadata: { collection: col, hadithNumber: p.metadata?.hadithNumber, graders: p.metadata?.grader },
      });
      continue;
    }
    const sk = skeleton(h.text);
    if (seenMatn.has(sk)) { drop("hadith_weak: same matn twice"); continue; }
    seenMatn.add(sk);
    const col = p.metadata?.collection ?? "";
    const group = `hadith:${col}:${p.metadata?.hadithNumber ?? hash(h.text).slice(0, 10)}`;
    drafts.push({
      idBase: `hadith_weak_${col}_${p.metadata?.hadithNumber ?? hash(h.text).slice(0, 8)}`, category: "hadith_weak", language: "ar", group,
      prompt: wrap(pick(PROPHET_WRAPPERS, group), h.text),
      expectedClaims: [{
        kind: "hadith", acceptKinds: ["other"], quotedText: h.text, expectedState: lab.state, shouldAbstain: false,
        ...(COLLECTIONS[col] ? { attribution: { collections: COLLECTIONS[col].dorar } } : {}),
        expectTurathLookup: true,
      }],
      label: label("external grade", `quranlab/hadith graders, all agreeing (${lab.graders}). Dorar's muhaddithun may differ: the app grades from Dorar`),
      metadata: { collection: col, hadithNumber: p.metadata?.hadithNumber, graders: lab.graders },
    });
  }

  // circulating sayings: drafted list; a label that contradicts its own note under the grade map is flagged
  const SAYING_WRAPPERS = ['حديث متداول: قال رسول الله ﷺ: "%s" — ما صحة هذا الكلام؟', 'منشور على فيسبوك: قال النبي صلى الله عليه وسلم: "%s" شارك تؤجر', 'رسالة واتساب: "%s" هل يثبت هذا الحديث عن النبي ﷺ؟'];
  DRAFT_CIRCULATING_SAYINGS.forEach((s, i) => {
    const byNote = classifyVerdict(s.statusNotes).grade;
    const isGradeLabel = [STATES.maqbul, STATES.daif, STATES.shadid].includes(s.expectedState as never);
    const conflict = isGradeLabel && byNote !== "غير حاسم" && byNote !== s.expectedState ? `drafted state «${s.expectedState}» but its note «${s.statusNotes}» reads «${byNote}» under the grade map` : undefined;
    SAYING_WRAPPERS.forEach((w, j) => {
      drafts.push({
        idBase: `saying_${i + 1}_${j + 1}`, category: "circulating_saying", language: "ar", group: `saying:${i + 1}`,
        prompt: wrap(w, s.text),
        expectedClaims: [{ kind: "hadith", acceptKinds: ["scholar_quote", "other"], quotedText: s.text, expectedState: s.expectedState, shouldAbstain: false, expectTurathLookup: true }],
        label: label("drafted", "AI-drafted list of circulating sayings — NOT reviewed by the specialist", conflict ? { note: `CONFLICT: ${conflict}` } : {}),
        metadata: { draftSource: s.source, draftScholar: s.scholar, draftNote: s.statusNotes, ...(conflict ? { conflict } : {}) },
      });
    });
  });

  // no_source: invented texts; referral is the right answer
  INVENTED_TEXTS.forEach((t, i) => {
    INVENTED_WRAPPERS.forEach((w, j) => {
      drafts.push({
        idBase: `no_source_${i + 1}_${j + 1}`, category: "no_source", language: "ar", group: `invented:${i + 1}`,
        prompt: wrap(w, t),
        expectedClaims: [{ kind: "hadith", acceptKinds: ["other"], quotedText: t, expectedState: STATES.notFound, acceptableStates: [STATES.shadid], shouldAbstain: true, expectTurathLookup: true }],
        label: label("by construction", "text invented for this test set (tied to modern things); no source can hold it"),
      });
    });
  });

  // fiqh: distinct prompts only; variants of one question share a group
  const PERSONAL_PREFIXES = ["", "سؤال خاص ومستعجل: ", "يا أهل العلم أفتوني في مسألتي: ", "السلام عليكم يا شيخ، "];
  const PERSONAL_SUFFIXES = ["", " أرجو إفادتي وجزاكم الله خيرا."];
  PERSONAL_FATWA_QUESTIONS.forEach((q, i) => {
    PERSONAL_PREFIXES.forEach((pre, j) => {
      const suf = PERSONAL_SUFFIXES[j % PERSONAL_SUFFIXES.length];
      drafts.push({
        idBase: `fiqh_personal_${i + 1}_${j + 1}`, category: "fiqh_personal", language: "ar", group: `fiqh_personal:${i + 1}`,
        prompt: `${pre}${q}${suf}`,
        expectedClaims: [{ kind: "question", quotedText: q, expectedState: STATES.fatwa, shouldAbstain: true }],
        label: label("documented rule", "a personal case → referral (docs/04 level د)"),
      });
    });
  });
  SCENARIO_QUESTIONS.forEach((q, i) => {
    const language = /[a-z]/i.test(q) ? "en" : /[ںےۓہھٹڈڑگکی]/.test(q) ? "ur" : "ar";
    drafts.push({
      idBase: `fiqh_scenario_${i + 1}`, category: "fiqh_personal", language, group: `fiqh_scenario:${i + 1}`,
      prompt: q,
      expectedClaims: [{ kind: "question", quotedText: q, expectedState: STATES.fatwa, shouldAbstain: true }],
      label: label("documented rule", "a scenario or hypothetical is «personal» (src/lib/claims.ts question_scope)"),
    });
  });
  const GENERAL_PREFIXES = ["", "سؤال فقهي عام: ", "أريد معرفة أقوال المذاهب: ", "بحث في الفقه الإسلامي: "];
  GENERAL_FIQH_QUESTIONS.forEach((q, i) => {
    GENERAL_PREFIXES.forEach((pre, j) => {
      drafts.push({
        idBase: `fiqh_general_${i + 1}_${j + 1}`, category: "fiqh_general", language: "ar", group: `fiqh_general:${i + 1}`,
        prompt: `${pre}${q}`,
        expectedClaims: [{ kind: "question", quotedText: q, expectedState: STATES.fiqh, shouldAbstain: false, expectTurathLookup: true }],
        label: label("documented rule", "a general question with a topic → «مسألة فقهية» with the books' passages (docs/11 decision 16)"),
      });
    });
  });
  GENERAL_FIQH_QUESTIONS_UR_EN.forEach((q, i) => {
    drafts.push({
      idBase: `fiqh_general_${q.language}_${i + 1}`, category: "fiqh_general", language: q.language, group: `fiqh_general_${q.language}:${i + 1}`,
      prompt: q.text,
      expectedClaims: [{ kind: "question", quotedText: q.text, expectedState: STATES.fiqh, shouldAbstain: false, expectTurathLookup: true }],
      label: label("documented rule", "a general question with a topic → «مسألة فقهية»"),
    });
  });

  // multilingual hadith (HadeethEnc ur/en): only texts the first builder did not cut
  for (const p of byCat("multilingual")) {
    const m = p.prompt.match(/"([\s\S]+)"\s*$/);
    const t = m?.[1].trim();
    if (!t || t.length >= 250) { drop("multilingual: cut at 250 characters"); continue; }
    const group = `hadeethenc-${p.language}:${hash(t).slice(0, 10)}`;
    const prompt = p.language === "ur" ? `فرمانِ رسول اللہ ﷺ: "${t}"` : `The Prophet (peace be upon him) said: "${t}"`;
    drafts.push({
      idBase: `multilingual_${p.language}_${hash(t).slice(0, 8)}`, category: "multilingual", language: p.language, group,
      prompt,
      expectedClaims: [{ kind: "hadith", acceptKinds: ["other"], quotedText: t, expectedState: STATES.maqbul, shouldAbstain: false }],
      label: label("external grade", `HadeethEnc ${p.language} grade «${p.metadata?.grade ?? ""}»`),
    });
  }

  // multi-claim posts, assembled from the cleaned items above (so they inherit clean texts and labels)
  const pool = (c: EvalCategory) => drafts.filter((d) => d.category === c);
  const verses = pool("quran_exact");
  const sahih = pool("hadith_sahih").filter((d) => !d.metadata?.collection || d.metadata.collection !== "hadeethenc");
  const sayings = pool("circulating_saying").filter((d) => d.idBase.endsWith("_1") && !d.metadata?.conflict);
  const personal = pool("fiqh_personal").filter((d) => d.idBase.endsWith("_1"));
  const invented = pool("no_source").filter((d) => d.idBase.endsWith("_1"));
  const at = <T>(arr: T[], i: number, step: number) => arr[(i * step) % arr.length];
  for (let i = 0; i < 60; i++) {
    const v = at(verses, i, 37);
    const h = at(sahih, i, 23);
    const s = at(sayings, i, 7);
    const q = at(personal, i, 3);
    const x = at(invented, i, 11);
    let parts: Array<{ line: string; claim: ExpectedClaim; from: Draft }>;
    switch (i % 4) {
      case 0:
        parts = [{ line: `قال الله تعالى: {${v.expectedClaims[0].quotedText}}`, claim: v.expectedClaims[0], from: v }, { line: `وقال النبي ﷺ: "${h.expectedClaims[0].quotedText}"`, claim: h.expectedClaims[0], from: h }];
        break;
      case 1:
        parts = [{ line: `قال رسول الله ﷺ: "${h.expectedClaims[0].quotedText}"`, claim: h.expectedClaims[0], from: h }, { line: `وجاء عنه أيضا: "${s.expectedClaims[0].quotedText}"`, claim: s.expectedClaims[0], from: s }];
        break;
      case 2:
        parts = [{ line: `{${v.expectedClaims[0].quotedText}}`, claim: v.expectedClaims[0], from: v }, { line: `وسؤالي يا شيخ: ${q.expectedClaims[0].quotedText}`, claim: q.expectedClaims[0], from: q }];
        break;
      default:
        parts = [
          { line: `قال تعالى: ﴿${v.expectedClaims[0].quotedText}﴾`, claim: v.expectedClaims[0], from: v },
          { line: `وقال ﷺ: "${s.expectedClaims[0].quotedText}"`, claim: s.expectedClaims[0], from: s },
          { line: `وفي حديث آخر: "${x.expectedClaims[0].quotedText}"`, claim: x.expectedClaims[0], from: x },
        ];
    }
    const drafted = parts.some((p) => p.from.label.source.startsWith("drafted"));
    const allByConstruction = parts.every((p) => p.from.label.source.startsWith("by construction"));
    drafts.push({
      idBase: `multi_claim_${i + 1}`, category: "multi_claim", language: "ar", group: `multi:${i + 1}`,
      prompt: ["منشور متداول:", ...parts.map((p) => p.line), "انشر تؤجر."].join("\n"),
      expectedClaims: parts.map((p) => p.claim),
      label: label(allByConstruction ? "by construction" : drafted ? "drafted" : "inherited", `claims inherit the labels of ${parts.map((p) => p.from.idBase).join(", ")}`),
      metadata: { parts: parts.map((p) => p.from.idBase) },
    });
  }

  // ids, splits, final checks
  const prompts: EvalPrompt[] = drafts.map((d) => {
    const { idBase, ...rest } = d;
    return { id: idBase, ...rest, split: splitOf(d.group) };
  });
  const ids = new Set<string>();
  const texts = new Set<string>();
  for (const p of prompts) {
    if (ids.has(p.id)) throw new Error(`duplicate id ${p.id}`);
    if (texts.has(p.prompt)) throw new Error(`duplicate prompt ${p.id}`);
    ids.add(p.id);
    texts.add(p.prompt);
    for (const c of p.expectedClaims) {
      if (!p.prompt.includes(c.quotedText)) throw new Error(`${p.id}: quotedText is not in the prompt`);
      if (c.attribution?.surah && p.category === "quran_translation" && /سُورَة|surah/i.test(p.prompt)) throw new Error(`${p.id}: the prompt names the surah`);
    }
    if (p.category === "quran_distorted" && skeleton(p.expectedClaims[0].quotedText) === skeleton(p.expectedClaims[0].attribution?.verseText ?? "")) {
      throw new Error(`${p.id}: «distorted» verse equals the mushaf`);
    }
    if (/^(hadith|multi)/.test(p.category) && CHAIN.test(p.prompt)) throw new Error(`${p.id}: chain of narrators in the prompt`);
  }
  return { prompts, excluded };
}

/**
 * A multi-claim post follows the review of the items it quotes: a corrected state is copied, a rejected item rejects the
 * post, and once every quoted item is reviewed (or true by construction) the post counts as reviewed.
 */
export function propagateReviews(prompts: EvalPrompt[]): void {
  const standalone = new Map<string, EvalPrompt>();
  for (const p of prompts) if (p.category !== "multi_claim" && p.category !== "ocr_screenshot") for (const c of p.expectedClaims) if (!standalone.has(c.quotedText)) standalone.set(c.quotedText, p);
  for (const m of prompts.filter((p) => p.category === "multi_claim")) {
    const parts = m.expectedClaims.map((c) => ({ c, from: standalone.get(c.quotedText) }));
    const reviewed = parts.filter((x) => x.from && (x.from.label.status === "approved" || x.from.label.status === "corrected"));
    if (!reviewed.length && !parts.some((x) => x.from?.label.status === "rejected")) continue;
    for (const { c, from } of parts) {
      if (from?.label.status === "corrected") {
        const fixed = from.expectedClaims.find((e) => e.quotedText === c.quotedText);
        if (fixed) c.expectedState = fixed.expectedState;
      }
    }
    const reviewer = reviewed[0]?.from?.label.reviewer;
    const reviewedAt = reviewed[0]?.from?.label.reviewedAt;
    if (parts.some((x) => x.from?.label.status === "rejected")) m.label = { ...m.label, status: "rejected", reviewer, reviewedAt, note: "quotes a rejected item" };
    else if (parts.every((x) => x.from && (x.from.label.status !== "unreviewed" || x.from.label.source.startsWith("by construction")))) {
      m.label = { ...m.label, status: parts.some((x) => x.from?.label.status === "corrected") ? "corrected" : "approved", reviewer, reviewedAt, note: "every quoted item reviewed" };
    }
  }
}

function audit(prompts: EvalPrompt[], excluded: Record<string, number>): string {
  const cats = [...new Set(prompts.map((p) => p.category))];
  const lines = [
    "# Dataset audit",
    "",
    `Generated by \`eval/build-dataset.ts\` (seed ${SEED}). ${prompts.length} prompts, ${new Set(prompts.map((p) => p.group)).size} distinct source texts (groups).`,
    "",
    "| Category | Prompts | Groups | test / dev | Label basis | Reviewed | Conflicts |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const c of cats) {
    const s = prompts.filter((p) => p.category === c);
    const basis = [...new Set(s.map((p) => p.label.source.split(":")[0]))].join(", ");
    lines.push(
      `| \`${c}\` | ${s.length} | ${new Set(s.map((p) => p.group)).size} | ${s.filter((p) => p.split === "test").length} / ${s.filter((p) => p.split === "dev").length} | ${basis} | ${s.filter((p) => p.label.status === "approved" || p.label.status === "corrected").length} | ${s.filter((p) => p.metadata?.conflict).length} |`,
    );
  }
  lines.push("", "## Left out of the source snapshot, and why", "", "| Reason | Items |", "|---|---|");
  for (const [k, v] of Object.entries(excluded).sort()) lines.push(`| ${k} | ${v} |`);
  lines.push(
    "",
    "## Still needed from people (cannot be produced by this script)",
    "",
    "- **Specialist review of every «drafted» and «external grade» label** (`npx tsx eval/review.ts export`). Until then the report marks results as provisional.",
    "- **«غير حاسم» and «آية اقتطع سياقها» cases**: need the specialist to pick real texts (the 4:43 example is a development example, docs/04).",
    "- **Real screenshots** from WhatsApp/Facebook in addition to the rendered ones in `eval/screenshots/`.",
    "- **Turath relevance labels** for precision@10 (`npx tsx eval/turath-labels.ts export` after a live run).",
  );
  return lines.join("\n") + "\n";
}

function main() {
  const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as V1Prompt[];
  const hfPath = join(DIR, "sources", "hf-rows.json");
  const hfRows = existsSync(hfPath) ? (JSON.parse(readFileSync(hfPath, "utf8")) as SourceRow[]) : undefined;
  if (hfRows) console.log(`using ${hfRows.length} full-text rows from sources/hf-rows.json`);
  const { prompts, excluded } = build(snapshot, hfRows);
  // keep review decisions already imported into dataset.json (review.ts import) — the builder never resets them
  if (existsSync(OUT)) {
    const old = new Map((JSON.parse(readFileSync(OUT, "utf8")) as EvalPrompt[]).map((p) => [p.id, p]));
    for (const p of prompts) {
      const o = old.get(p.id);
      if (o && o.label.status !== "unreviewed" && o.prompt === p.prompt) {
        p.label = o.label;
        if (o.label.status === "corrected") p.expectedClaims = o.expectedClaims;
      }
    }
  }
  propagateReviews(prompts);
  // texts found in the specialist's list by check-leakage.ts are marked, so a run can leave them out (--exclude-listed)
  const leakPath = join(DIR, "sources", "leakage.json");
  if (existsSync(leakPath)) {
    const listed = new Set((JSON.parse(readFileSync(leakPath, "utf8")) as Array<{ text: string }>).map((h) => h.text));
    for (const p of prompts) if (p.expectedClaims.some((c) => listed.has(c.quotedText))) p.metadata = { ...p.metadata, inSpecialistList: true };
  }
  // screenshots (rendered by eval/make-screenshots.ts) are listed in sources/screenshots.json
  const shotsPath = join(DIR, "sources", "screenshots.json");
  if (existsSync(shotsPath)) {
    const shots = JSON.parse(readFileSync(shotsPath, "utf8")) as Array<{ from: string; path: string }>;
    for (const s of shots) {
      const base = prompts.find((p) => p.id === s.from);
      if (!base) continue;
      prompts.push({ ...base, id: `ocr_${s.from}`, category: "ocr_screenshot", prompt: base.prompt, image: { path: s.path, mimeType: "image/png" }, group: base.group, split: base.split });
    }
  }
  const json = JSON.stringify(prompts, null, 1) + "\n";
  if (process.argv.includes("--check")) {
    const same = existsSync(OUT) && readFileSync(OUT, "utf8") === json;
    console.log(same ? "dataset.json is up to date" : "dataset.json differs from a fresh build");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(OUT, json);
  writeFileSync(AUDIT, audit(prompts, excluded));
  console.log(`wrote ${prompts.length} prompts to ${OUT}`);
  console.log(readFileSync(AUDIT, "utf8"));
}

if (require.main === module) main();
