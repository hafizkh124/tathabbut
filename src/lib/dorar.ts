// الدرر السنية (dorar.net) client. Every field is reported exactly as Dorar states it —
// the narrator, the muhaddith, the source and the muhaddith's verdict. Tathabbut never
// writes a verdict of its own; classification of these verdicts is src/lib/gradeMap.ts.

const ENDPOINT = "https://dorar.net/dorar_api.json";
const TIMEOUT_MS = 8_000;

/** We identify ourselves honestly. Checked 2026-10-03: the endpoint answers this UA without any browser disguise. */
const HEADERS: Record<string, string> = {
  "User-Agent": "Tathabbut/0.1 (+https://github.com/hafizkh124/tathabbut)",
  "Accept-Language": "ar,en;q=0.9",
};

/** The endpoint answered 500 once on a first burst of calls and 200 on the retry. */
const RETRIES = 1;
const RETRY_DELAY_MS = 1_500;

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

/** Dorar book ids (checked 2026-10-04): s[]=6216 returns only Sahih al-Bukhari, s[]=3088 only Sahih Muslim. */
export const SAHIHAYN_BOOKS = ["6216", "3088"];

export async function searchDorar(text: string, limit = 15, opts: { books?: string[] } = {}): Promise<DorarLookup> {
  const query = text.trim();
  if (!query) return { ok: false, error: "empty" };
  const extra = (opts.books ?? []).filter((b) => /^\d{1,6}$/.test(b)).map((b) => `&s[]=${b}`).join("");

  let last: DorarLookup = { ok: false, error: "network" };
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    last = await fetchOnce(query, limit, extra);
    // Only transient failures are worth another call; an answer (even an empty one) is final.
    const transient =
      !last.ok && (last.error === "network" || last.error === "timeout" || (last.error === "http" && Number(last.detail) >= 500));
    if (!transient) return last;
  }
  return last;
}

async function fetchOnce(query: string, limit: number, extra = ""): Promise<DorarLookup> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // dorar.net answers 403 to Vercel's IPs. When a relay is configured the call goes through it instead
    // (the Cloudflare Worker in worker/dorar-relay.mjs); it hands back Dorar's own JSON, so everything below is unchanged.
    const relayUrl = process.env.DORAR_RELAY_URL?.replace(/\/+$/, "");
    const relayKey = process.env.DORAR_RELAY_KEY;
    const useRelay = Boolean(relayUrl && relayKey);
    const res = await fetch(
      (useRelay ? `${relayUrl}/dorar?skey=` : `${ENDPOINT}?skey=`) + encodeURIComponent(query) + extra,
      {
        headers: useRelay ? { "x-relay-key": relayKey as string } : HEADERS,
        signal: controller.signal,
        cache: "no-store",
      },
    );
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
