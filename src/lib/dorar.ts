// الدرر السنية (dorar.net) client. Every field is reported exactly as Dorar states it —
// the narrator, the muhaddith, the source and the muhaddith's verdict. Tathabbut never
// writes a verdict of its own; classification of these verdicts happens later via grade_map.
// Parsing is ported from Al-Ulama Easy Editor (electron/agent/adapters/dorar.ts, AGPL-3.0).

const ENDPOINT = "https://dorar.net/dorar_api.json";
const TIMEOUT_MS = 12_000;

/** dorar.net sits behind Cloudflare; a bare fetch without browser headers is rejected. */
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ar,en;q=0.9",
  Referer: "https://dorar.net/",
};

export interface DorarResult {
  /** 1-based position in Dorar's answer */
  rank: number;
  matn: string;
  rawi?: string;
  muhaddith?: string;
  source?: string;
  /** page or number, as printed by Dorar */
  reference?: string;
  /** خلاصة حكم المحدث, verbatim */
  verdict?: string;
}

export type DorarLookup =
  | { ok: true; results: DorarResult[] }
  | { ok: false; error: "timeout" | "http" | "network" | "empty"; detail?: string };

const stripTags = (s: string): string =>
  s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const LABELS = ["الراوي", "المحدث", "المصدر", "الصفحة أو الرقم", "خلاصة حكم المحدث"] as const;

function field(info: string, label: (typeof LABELS)[number]): string | undefined {
  const others = LABELS.filter((l) => l !== label).join("|");
  const m = info.match(new RegExp(`${label}\\s*:\\s*([\\s\\S]*?)(?=\\s*(?:${others})\\s*:|$)`));
  const v = m?.[1]?.trim();
  return v && v !== "-" ? v : undefined;
}

/** Parse the HTML inside Dorar's `ahadith.result`. Pure, so it is unit-tested on a saved response. */
export function parseDorarHtml(html: string, limit = 15): DorarResult[] {
  const out: DorarResult[] = [];
  const pair =
    /<div[^>]*class="hadith"[^>]*>([\s\S]*?)<\/div>\s*(?:<[^>]*>\s*)*<div[^>]*class="hadith-info"[^>]*>([\s\S]*?)<\/div>/gi;
  let m: RegExpExecArray | null;
  while ((m = pair.exec(html)) !== null && out.length < limit) {
    const matn = stripTags(m[1]).replace(/^\d+\s*-\s*/, "").replace(/\s+\.$/, ".").trim();
    if (matn.length < 5) continue;
    const info = stripTags(m[2]);
    out.push({
      rank: out.length + 1,
      matn,
      rawi: field(info, "الراوي"),
      muhaddith: field(info, "المحدث"),
      source: field(info, "المصدر"),
      reference: field(info, "الصفحة أو الرقم"),
      verdict: field(info, "خلاصة حكم المحدث"),
    });
  }
  return out;
}

export async function searchDorar(text: string, limit = 15): Promise<DorarLookup> {
  const query = text.trim();
  if (!query) return { ok: false, error: "empty" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT}?skey=${encodeURIComponent(query)}`, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: "http", detail: String(res.status) };
    const data = (await res.json()) as { ahadith?: { result?: string } };
    const results = parseDorarHtml(data?.ahadith?.result ?? "", limit);
    return results.length ? { ok: true, results } : { ok: false, error: "empty" };
  } catch (err) {
    if (controller.signal.aborted) return { ok: false, error: "timeout" };
    return { ok: false, error: "network", detail: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}
