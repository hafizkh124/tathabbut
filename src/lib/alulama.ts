// العلماء (alulama.org): its questions and answers, read from its WordPress REST API and kept in our database
// (migration 014) so a visitor's question can be matched to them. Only the text the site publishes is copied: the title, the
// question, the start of the answer, the shaikh named under it, and the link back. Nothing here writes an opinion of ours.
import { foldUrdu } from "./arabic";
import { restHeaders, type RestConfig } from "./supabaseRest";

export const ALULAMA_ORIGIN = "https://alulama.org";
/** The question-and-answer categories: سوالات و جوابات 7191, فتاوی 14, فتاوى 18, Fatwas 12, أسئلة وأجوبة 7193. */
export const FATWA_CATEGORIES = [7191, 14, 18, 12, 7193] as const;
export const SYNC_USER_AGENT = "Tathabbut-sync/1.0 (+https://tathabbut.alulama.org)";
/** The answer is kept this long (the card shows less; the link has the rest). */
export const SNIPPET_CHARS = 500;
/** Only this much of the question is folded into the search text (it is not kept as such). */
export const QUESTION_CHARS = 400;

export type AlulamaKind = "fatwa" | "hadith_ruling";

/** What the WordPress API sends for one post (the fields asked for in POST_FIELDS). */
export interface WpPost {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  link: string;
  date?: string;
  modified?: string;
  categories?: number[];
}
export const POST_FIELDS = "id,title,content,link,date,modified,categories";

/** A row of alulama_posts. */
export interface AlulamaRow {
  id: number;
  kind: AlulamaKind;
  number: number | null;
  title: string;
  title_clean: string;
  answer_snippet: string;
  answerers: string[];
  link: string;
  published: string | null;
  modified: string | null;
  categories: number[];
  search_text: string;
}

/** What a match gives back (match_alulama). */
export interface AlulamaHit {
  id: number;
  kind: AlulamaKind;
  number: number | null;
  title: string;
  answer_snippet: string;
  answerers: string[];
  link: string;
  published: string | null;
  score: number;
}

// ---------- text ----------

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", hellip: "…", ndash: "–", mdash: "—" };
export const decodeEntities = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });

/** HTML to plain lines: a block or a line break ends a line; every tag is dropped, never rendered. */
export function htmlLines(html: string): string[] {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\s*br\s*\/?\s*>|<\/\s*(p|div|h[1-6]|li|blockquote|tr)\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** The folded form used to match: Urdu keyboard letters and Arabic spellings one way, no marks, no punctuation. The four
 *  words Arabic spells with a waw for the long a (صلوة، زكوة، حيوة، مشكوة) are read as Urdu spells them (صلاۃ، زکاۃ…). */
export function foldText(s: string): string {
  return foldUrdu(s)
    .replace(/(^|\s)(ص|ز|ح|مش)(ل|ك|ي)وه(?=\s|$)/g, (_, a: string, b: string, c: string) => `${a}${b}${c}اه`)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Words with their place in the text and their folded form (a word that folds to nothing is left out). */
export function foldedWords(text: string): { start: number; end: number; folded: string }[] {
  const out: { start: number; end: number; folded: string }[] = [];
  for (const m of text.matchAll(/\S+/g)) {
    const folded = foldText(m[0]);
    if (folded) out.push({ start: m.index!, end: m.index! + m[0].length, folded });
  }
  return out;
}

// ---------- the greetings around a question ----------

const GREETING_START = /^(?:وعليكم السلام|السلام عليكم)(?:(?: و)? و?رحمه الله)?(?:(?: و)? و?بركاته)?/;
const GREETING_LINE = /^(?:جزاكم الله(?: خيرا| احسن الجزاء)?(?: كثيرا)?|محترم(?: شيخ| مفتي| علماء كرام)?(?: صاحب)?|شيخ صاحب|مفتي صاحب|احسن الله اليكم|بارك الله فيكم|جزاك الله خيرا)$/;

/** A line without the greeting it opens with («السلام علیکم و رحمۃ اللہ وبرکاتہ …»); empty when that was all it said. */
export function withoutGreeting(line: string): string {
  const ws = foldedWords(line);
  const joined = ws.map((w) => w.folded).join(" ");
  if (GREETING_LINE.test(joined)) return "";
  const m = GREETING_START.exec(joined);
  if (!m) return line;
  const used = m[0].split(" ").length;
  return used >= ws.length ? "" : line.slice(ws[used].start).replace(/^[\s,.،!:;؛\-–—]+/, "");
}

// ---------- one post ----------

/** «فضیلۃ الشیخ عبد الوکیل ناصر حفظہ اللہ»: a short line that ends with the blessing the site puts after a shaikh's name. */
const isAnswerer = (line: string) => line.length <= 90 && /(?:حفظہ اللہ|حفظه الله|رحمہ اللہ|رحمه الله|حفظہ اللّٰہ|حفظه اللّٰه)\s*[.۔]?$/.test(line);
const QUESTION_HEAD = /^سوال\s*[:：]?\s*(\d+)?\s*[:：]?$/;
const ANSWER_HEAD = /^جواب\s*[:：]?$/;

/** A title or question that asks about a hadith or an athar («حدیث کا حکم», «کیا اس کی سند صحیح ہے؟», a quoted Arabic text). */
export function isHadithRuling(title: string): boolean {
  // «اہلِ حدیث» and «قرآن و حدیث کی روشنی میں» name a group or a source, not a text being asked about
  const t = title.trim().replace(/اہلِ?\s*حدیث|ا[ہھ]ل\s*حدیث|قرآن\s*(?:و|اور)?\s*(?:سنت|حدیث)/g, " ");
  const arabicQuote = /["“«”‘][^"”»]*[ء-ي]{2,}\s+[ء-ي]{2,}/.test(t);
  const assessed = /(?:حکم|صحت|صحیح|ضعیف|موضوع|سند|درجہ|حقیقت|ثبوت|وضاحت|ثابت|تحقیق|تخریج|محدثین|کہہ سکتے|ہے؟|ہے\?)/.test(t);
  if (/(?:^|\s)(?:حدیث|احادیث|روایت|اثر|آثار)(?:\s|$|[؟?،:])/.test(t) && assessed) return true;
  return arabicQuote && assessed;
}

const clip = (s: string, n: number): string => {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const at = cut.lastIndexOf(" ");
  return (at > n * 0.6 ? cut.slice(0, at) : cut).trim();
};

/** One WordPress post as a row, or null when there is no question or no answer in it (nothing to show). */
export function toRow(wp: WpPost): AlulamaRow | null {
  const title = decodeEntities(wp.title?.rendered ?? "").replace(/\s+/g, " ").trim();
  if (!title || !wp.link) return null;
  const lines = htmlLines(wp.content?.rendered ?? "");

  let number: number | null = null;
  let q: string[] = [];
  let a: string[] = [];
  const qi = lines.findIndex((l) => QUESTION_HEAD.test(l));
  const ai = lines.findIndex((l, i) => i > qi && ANSWER_HEAD.test(l));
  if (qi >= 0 && ai > qi) {
    const n = QUESTION_HEAD.exec(lines[qi])?.[1];
    number = n ? parseInt(n, 10) : null;
    q = lines.slice(qi + 1, ai);
    a = lines.slice(ai + 1);
  } else {
    // older posts: «سوال: … جواب: …» on one line
    const one = lines.join("\n").match(/سوال\s*[:：]?\s*(\d+)?\s*[:：]?\s*([\s\S]*?)\n?\s*جواب\s*[:：]?\s*([\s\S]*)/);
    if (one) {
      number = one[1] ? parseInt(one[1], 10) : null;
      q = one[2].split("\n");
      a = one[3].split("\n");
    } else {
      a = lines;
    }
  }

  const answerers: string[] = [];
  for (const l of lines) if (isAnswerer(l) && !answerers.includes(l)) answerers.push(l);
  // the first answer: up to the first shaikh's name, or to a second question
  const firstAnswer: string[] = [];
  for (const l of a) {
    if (isAnswerer(l) || QUESTION_HEAD.test(l)) break;
    firstAnswer.push(l);
  }

  const question = q.map(withoutGreeting).filter(Boolean).join(" ").trim();
  const answer = firstAnswer.map(withoutGreeting).filter(Boolean).join(" ").trim();
  if (!answer) return null;
  const kind: AlulamaKind = isHadithRuling(title) ? "hadith_ruling" : "fatwa";
  return {
    id: wp.id,
    kind,
    number,
    title,
    title_clean: foldText(title),
    answer_snippet: clip(answer, SNIPPET_CHARS),
    answerers,
    link: wp.link,
    published: wp.date ? `${wp.date}${/[zZ]|[+-]\d\d:?\d\d$/.test(wp.date) ? "" : "+00:00"}` : null,
    modified: wp.modified ? `${wp.modified}${/[zZ]|[+-]\d\d:?\d\d$/.test(wp.modified) ? "" : "+00:00"}` : null,
    categories: wp.categories ?? [],
    search_text: foldText(`${title} ${clip(question, QUESTION_CHARS)}`),
  };
}

// ---------- the WordPress API ----------

type Fetch = typeof fetch;

export interface PageOptions {
  page: number;
  perPage?: number;
  /** only posts changed after this time (ISO, no zone: the site's own clock) */
  modifiedAfter?: string;
  /** the posts' ids only (for finding what was deleted) */
  idsOnly?: boolean;
}

/** One page of posts in the Q&A categories, oldest change first, so a sync that stops halfway can start again where it stopped. */
export async function fetchPosts(opts: PageOptions, f: Fetch = fetch): Promise<{ posts: WpPost[]; totalPages: number; total: number }> {
  const q = new URLSearchParams({
    categories: FATWA_CATEGORIES.join(","),
    per_page: String(opts.perPage ?? 100),
    page: String(opts.page),
    orderby: "modified",
    order: "asc",
    _fields: opts.idsOnly ? "id" : POST_FIELDS,
  });
  if (opts.modifiedAfter) q.set("modified_after", opts.modifiedAfter);
  const res = await f(`${ALULAMA_ORIGIN}/wp-json/wp/v2/posts?${q}`, { headers: { "User-Agent": SYNC_USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(30_000), cache: "no-store" });
  // asking for a page past the end is HTTP 400 («rest_post_invalid_page_number»): there is nothing more
  if (res.status === 400) return { posts: [], totalPages: 0, total: 0 };
  if (!res.ok) throw new Error(`alulama.org: HTTP ${res.status}`);
  return {
    posts: (await res.json()) as WpPost[],
    totalPages: Number(res.headers.get("X-WP-TotalPages") ?? 0),
    total: Number(res.headers.get("X-WP-Total") ?? 0),
  };
}

// ---------- our table ----------

const REST = (cfg: RestConfig, path: string) => `${cfg.url.replace(/\/+$/, "")}/rest/v1/${path}`;

/** Inserts or updates rows by id. Throws on a refusal, so a sync never says it finished when it did not. */
export async function upsertRows(cfg: RestConfig, rows: AlulamaRow[], f: Fetch = fetch): Promise<void> {
  if (!rows.length) return;
  const res = await f(REST(cfg, "alulama_posts?on_conflict=id"), {
    method: "POST",
    headers: { ...restHeaders(cfg.key), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`alulama_posts upsert: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
}

export async function deleteIds(cfg: RestConfig, ids: number[], f: Fetch = fetch): Promise<void> {
  if (!ids.length) return;
  const res = await f(REST(cfg, `alulama_posts?id=in.(${ids.join(",")})`), { method: "DELETE", headers: restHeaders(cfg.key), signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`alulama_posts delete: HTTP ${res.status}`);
}

export async function storedIds(cfg: RestConfig, f: Fetch = fetch): Promise<number[]> {
  const ids: number[] = [];
  for (let from = 0; ; from += 1000) {
    const res = await f(REST(cfg, "alulama_posts?select=id&order=id.asc"), { headers: { ...restHeaders(cfg.key), Range: `${from}-${from + 999}`, "Range-Unit": "items" }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`alulama_posts ids: HTTP ${res.status}`);
    const part = (await res.json()) as { id: number }[];
    ids.push(...part.map((r) => r.id));
    if (part.length < 1000) return ids;
  }
}

export async function getState<T>(cfg: RestConfig, key: string, f: Fetch = fetch): Promise<T | null> {
  const res = await f(REST(cfg, `sync_state?key=eq.${encodeURIComponent(key)}&select=value`), { headers: restHeaders(cfg.key), signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`sync_state: HTTP ${res.status}`);
  const rows = (await res.json()) as { value: T }[];
  return rows[0]?.value ?? null;
}

export async function setState(cfg: RestConfig, key: string, value: object, f: Fetch = fetch): Promise<void> {
  const res = await f(REST(cfg, "sync_state?on_conflict=key"), {
    method: "POST",
    headers: { ...restHeaders(cfg.key), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`sync_state set: HTTP ${res.status}`);
}

/** Which of these post ids are still published on the site (one request for up to 100). */
export async function existingIds(ids: number[], f: Fetch = fetch): Promise<Set<number>> {
  const found = new Set<number>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const q = new URLSearchParams({ include: chunk.join(","), per_page: "100", _fields: "id" });
    const res = await f(`${ALULAMA_ORIGIN}/wp-json/wp/v2/posts?${q}`, { headers: { "User-Agent": SYNC_USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(30_000), cache: "no-store" });
    if (!res.ok) throw new Error(`alulama.org: HTTP ${res.status}`);
    for (const p of (await res.json()) as { id: number }[]) found.add(p.id);
  }
  return found;
}
