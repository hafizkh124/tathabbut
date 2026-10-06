// A direct client for Turath's public search (api.turath.io), replacing the nusus SDK (specialist's decision, 2026-10-05:
// no third-party package, every request and parse in our own code, like dorar.ts).
//
// What the API gives (checked live, 2026-10-05): GET /search?q=&ver=3&page=&cat_id= → { count, data: [hit] }, 20 hits a
// page, each { book_id, author_id?, cat_id?, meta: "<json string>", snip, text }. The hit's `text` is the whole page, with
// <em> marks round the searched words; once the tags are removed it equals what /page returns (8 of 8 compared), so no
// second request per hit is needed. Turath accepts ONE category per search.
import { cleanTurathText, findPhrase } from "./turathText";

export const TURATH_API = "https://api.turath.io/";
const USER_AGENT = "Tathabbut/0.1 (+https://github.com/hafizkh124/tathabbut)";

export interface TurathPassage {
  book: { id: string; title: string };
  author?: { id?: string; name?: string };
  /** Turath's own category id of the book, as the hit reports it */
  categoryId?: string;
  location: { internalPage?: number; printedPage?: number; volume?: string };
  /** The page text cleaned of markup and cut to at most `maxChars`, around the asked phrase when it is long. */
  text: string;
  url: string;
  citation: string;
  /** 0 = the best match, in Turath's own order */
  rank: number;
  totalMatches: number;
  truncated: boolean;
}

export interface TurathSearchOptions {
  categoryId: string;
  maxPassages: number;
  maxChars: number;
  signal?: AbortSignal;
  fetch?: typeof fetch;
}

export interface TurathSearchResult {
  passages: TurathPassage[];
  totalMatches: number;
  /** the spelling that finally found something, when the asked one found nothing */
  effectiveQuery?: string;
}

export class TurathError extends Error {
  constructor(
    readonly code: "HTTP_ERROR" | "INVALID_RESPONSE" | "INVALID_ARGUMENT",
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "TurathError";
  }
}

// ---------- helpers ----------

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Turath marks the searched words with <em> and breaks lines with <br>; neither belongs in a passage. */
const plain = (s: string) => s.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/?[a-z][^>]*>/gi, "");

/** The same query written the way Turath's index may hold it, tried only when the asked spelling finds nothing. */
export function searchVariants(query: string): string[] {
  const normalized = query
    .normalize("NFC")
    .replace(/ٰ/g, "ا")
    .replace(/\p{M}/gu, "")
    .replace(/[إآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const variants = [normalized];
  if (/[ءؤئ]/.test(normalized)) variants.push(...["ء", "ؤ", "ئ"].map((h) => normalized.replace(/[ءؤئ]/g, h)));
  return [...new Set(variants)].filter((v) => v && v !== query);
}

/** `text` cut to `max` characters around the position [index, index+length), snapped to a word edge; never splits a surrogate pair. */
function windowAround(text: string, index: number, length: number, max: number): string {
  let start = index;
  if (length < max) {
    start = Math.max(0, index - Math.floor((max - length) / 2));
    start = Math.min(start, Math.max(0, text.length - max));
  }
  if (start > 0 && start < index) {
    const edge = text.slice(start, index).search(/\s/);
    if (edge >= 0 && edge < 40) start += edge + 1;
  }
  if (start > 0 && /[\uDC00-\uDFFF]/.test(text[start]) && /[\uD800-\uDBFF]/.test(text[start - 1])) start += 1;
  return text.slice(start, start + max).replace(/[\uD800-\uDBFF]$/, "");
}

/** At most `max` characters of the page: all of it when short; else the stretch round the asked phrase, round the first
 *  word Turath marked, or, failing both, the start of the page. */
export function boundExcerpt(text: string, max: number, query: string, snip?: string): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  const phrase = findPhrase(text, query);
  if (phrase) return { text: windowAround(text, phrase[0], phrase[1] - phrase[0], max), truncated: true };
  const marked = snip?.match(/<em\b[^>]*>([\s\S]*?)<\/em>/i)?.[1];
  const needle = marked ? cleanTurathText(plain(marked)).trim() : "";
  const at = needle.length >= 3 ? text.indexOf(needle) : -1;
  if (at >= 0) return { text: windowAround(text, at, needle.length, max), truncated: true };
  return { text: text.slice(0, max).replace(/[\uD800-\uDBFF]$/, ""), truncated: true };
}

const sourceUrl = (bookId: string, page?: number) => `https://app.turath.io/book/${bookId}${page !== undefined ? `?page=${page}` : ""}`;

function citation(p: { book: { id: string; title: string }; author?: { name?: string }; location: TurathPassage["location"] }): string {
  const parts: string[] = [];
  if (p.author?.name) parts.push(p.author.name);
  parts.push(p.book.title);
  if (p.location.volume) parts.push(`ج ${p.location.volume}`);
  if (p.location.printedPage !== undefined) parts.push(`ص ${p.location.printedPage}`);
  if (p.location.internalPage !== undefined) parts.push(`صفحة تراث ${p.location.internalPage}`);
  parts.push(`تراث ${p.book.id}`);
  return parts.join("، ");
}

/** One raw hit as a passage, or null when it lacks what a citation needs (book id, book name, text). */
function toPassage(raw: unknown, rank: number, totalMatches: number, query: string, maxChars: number): TurathPassage | null {
  if (!isRecord(raw) || typeof raw.book_id !== "number" || typeof raw.meta !== "string" || typeof raw.text !== "string") return null;
  let meta: unknown;
  try {
    meta = JSON.parse(raw.meta);
  } catch {
    return null;
  }
  if (!isRecord(meta) || typeof meta.book_name !== "string") return null;

  const book = { id: String(raw.book_id), title: meta.book_name };
  const author = typeof raw.author_id === "number" || typeof meta.author_name === "string" ? { ...(typeof raw.author_id === "number" ? { id: String(raw.author_id) } : {}), ...(typeof meta.author_name === "string" ? { name: meta.author_name } : {}) } : undefined;
  const location: TurathPassage["location"] = {
    ...(typeof meta.page_id === "number" ? { internalPage: meta.page_id } : {}),
    ...(typeof meta.page === "number" ? { printedPage: meta.page } : {}),
    ...(typeof meta.vol === "string" ? { volume: meta.vol } : {}),
  };
  const bounded = boundExcerpt(cleanTurathText(plain(raw.text)), maxChars, query, typeof raw.snip === "string" ? raw.snip : undefined);
  return {
    book,
    ...(author ? { author } : {}),
    ...(typeof raw.cat_id === "number" ? { categoryId: String(raw.cat_id) } : {}),
    location,
    text: bounded.text,
    url: sourceUrl(book.id, location.internalPage),
    citation: citation({ book, author, location }),
    rank,
    totalMatches,
    truncated: bounded.truncated,
  };
}

// ---------- the request ----------

async function searchOnce(q: string, categoryId: string, f: typeof fetch, signal?: AbortSignal): Promise<{ count: number; data: unknown[] }> {
  const url = new URL("search", TURATH_API);
  url.searchParams.set("q", q);
  url.searchParams.set("ver", "3");
  url.searchParams.set("page", "1");
  url.searchParams.set("cat_id", categoryId);
  const res = await f(url, { headers: { accept: "application/json", "user-agent": USER_AGENT }, signal, cache: "no-store" });
  if (!res.ok) throw new TurathError("HTTP_ERROR", `Turath search failed with HTTP ${res.status}`, res.status);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new TurathError("INVALID_RESPONSE", "Turath returned invalid JSON");
  }
  if (!isRecord(json) || typeof json.count !== "number" || !Array.isArray(json.data)) throw new TurathError("INVALID_RESPONSE", "Turath returned an invalid search response");
  return { count: json.count, data: json.data };
}

/**
 * The best `maxPassages` pages of one category that match `query`, in Turath's own order, each cut to `maxChars`.
 * A page of results holds 20 hits, so one request is enough for up to 20 passages.
 */
export async function searchTurath(query: string, options: TurathSearchOptions): Promise<TurathSearchResult> {
  if (!query.trim()) throw new TurathError("INVALID_ARGUMENT", "query must not be empty");
  if (!/^[1-9]\d*$/.test(options.categoryId)) throw new TurathError("INVALID_ARGUMENT", "categoryId must be a positive integer");
  if (!Number.isInteger(options.maxPassages) || options.maxPassages < 1 || options.maxPassages > 20) throw new TurathError("INVALID_ARGUMENT", "maxPassages must be between 1 and 20");
  const f = options.fetch ?? globalThis.fetch;

  let effectiveQuery = query;
  let response = await searchOnce(effectiveQuery, options.categoryId, f, options.signal);
  if (response.count === 0) {
    for (const variant of searchVariants(query)) {
      const candidate = await searchOnce(variant, options.categoryId, f, options.signal);
      if (candidate.count === 0) continue;
      effectiveQuery = variant;
      response = candidate;
      break;
    }
  }

  const passages = response.data
    .slice(0, options.maxPassages)
    .map((hit, rank) => toPassage(hit, rank, response.count, query, options.maxChars))
    .filter((p): p is TurathPassage => p !== null);
  return { passages, totalMatches: response.count, ...(effectiveQuery !== query ? { effectiveQuery } : {}) };
}
