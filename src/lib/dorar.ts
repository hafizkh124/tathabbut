// الدرر السنية (dorar.net) client. Every field is reported exactly as Dorar states it —
// the narrator, the muhaddith, the source and the muhaddith's verdict. Tathabbut never
// writes a verdict of its own; classification of these verdicts is src/lib/gradeMap.ts.

const ENDPOINT = "https://dorar.net/dorar_api.json";
/** One call. Dorar usually answers in 1-3 s; the live figures of 2026-11-23 showed two checks at 17 s, which is exactly
 *  two calls that each hung for the old 8 s, plus the pause between them. */
const TIMEOUT_MS = 6_000;
/** A call that has not answered by now gets a second, identical call beside it; the first good answer wins and the
 *  other is dropped. Only the slow ones (a few in a hundred) cost Dorar a second request. */
const HEDGE_MS = 2_500;
/** Everything one search may take, the retry included, so a bad moment of Dorar costs the person at most about this. */
const DEADLINE_MS = 9_000;
/** A retry that has less than this left is not worth starting. */
const MIN_RETRY_MS = 2_000;

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
  const started = Date.now();
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) {
      // the pause counts too: a retry that could not start with MIN_RETRY_MS left after it is not begun at all
      if (DEADLINE_MS - (Date.now() - started) - RETRY_DELAY_MS * attempt < MIN_RETRY_MS) break;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
    last = await hedged(query, limit, extra, Math.min(TIMEOUT_MS, DEADLINE_MS - (Date.now() - started)));
    // Only transient failures are worth another call. An empty answer counts as one: Dorar returns its 15 nearest
    // results even for an invented text (checked 2026-10-03), so an empty page is a glitch of Dorar or the relay
    // (2026-10-19: the same query came back empty, then with 15 results a moment later).
    const transient =
      !last.ok &&
      (last.error === "network" || last.error === "timeout" || last.error === "empty" || (last.error === "http" && Number(last.detail) >= 500));
    if (!transient) return last;
  }
  return last;
}

/** One call; if it is slow, a second beside it. Resolves with the first good answer, or, when none is good, with the
 *  last failure once both are over. */
async function hedged(query: string, limit: number, extra: string, timeoutMs: number): Promise<DorarLookup> {
  const stop = new AbortController();
  const first = fetchOnce(query, limit, extra, timeoutMs, stop.signal);
  let hedgeTimer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<"slow">((resolve) => {
    hedgeTimer = setTimeout(() => resolve("slow"), HEDGE_MS);
  });
  const quick = await Promise.race([first, slow]);
  clearTimeout(hedgeTimer);
  if (quick !== "slow") return quick;

  const second = fetchOnce(query, limit, extra, timeoutMs, stop.signal);
  const winner = await new Promise<DorarLookup>((resolve) => {
    let failures = 0;
    let lastFailure: DorarLookup = { ok: false, error: "timeout" };
    for (const call of [first, second]) {
      call.then((r) => {
        if (r.ok) return resolve(r);
        lastFailure = r;
        if (++failures === 2) resolve(lastFailure);
      });
    }
  });
  stop.abort(); // the one still running is no longer needed
  return winner;
}

async function fetchOnce(query: string, limit: number, extra = "", timeoutMs = TIMEOUT_MS, outer?: AbortSignal): Promise<DorarLookup> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onOuter = () => controller.abort();
  outer?.addEventListener("abort", onOuter);
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
    outer?.removeEventListener("abort", onOuter);
  }
}
