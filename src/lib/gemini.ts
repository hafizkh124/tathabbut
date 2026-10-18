// Minimal server-only Gemini client (REST, no SDK): JSON answers that follow a schema, with a short timeout,
// one retry on a transient failure, then the fallback model. Checked against the live API on 2026-10-03:
// gemini-3.8-flash answers in ~2.5 s with thinkingLevel "low" (the default thinking takes ~5.7 s for the same output;
// "minimal" is refused by that model); gemini-2.5-flash takes thinkingBudget instead.

const API = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiImage {
  mimeType: string;
  /** base64, without the data: prefix */
  data: string;
}

export interface GenerateOptions {
  /** OpenAPI-style schema in Gemini's format (type: "OBJECT", …). */
  schema: object;
  images?: GeminiImage[];
  model?: string;
  fallbackModel?: string;
  timeoutMs?: number;
}

/** Token counts Gemini reports for one call (usageMetadata); used by the evaluation to measure cost. */
export interface GeminiUsage {
  promptTokens: number;
  outputTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
}

export interface GenerateResult<T> {
  data: T;
  model: string;
  ms: number;
  usage?: GeminiUsage;
}

/** Which free-tier quota a 429 hit: the model's requests per minute (wait and retry) or per day (out until the reset). */
export type QuotaKind = "minute" | "day";

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly quota?: QuotaKind,
    /** seconds Google asks us to wait (RetryInfo), when it says */
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

/** Reads a 429's body: which quota (QuotaFailure's quotaId, e.g. "GenerateRequestsPerDayPerProjectPerModel-FreeTier")
 *  and how long to wait (RetryInfo's retryDelay, e.g. "43s"). Unknown when the body says neither. */
export function quotaOf(body: string): { quota?: QuotaKind; retryAfter?: number } {
  let details: Array<{ violations?: Array<{ quotaId?: string }>; retryDelay?: string }> = [];
  try {
    details = (JSON.parse(body) as { error?: { details?: typeof details } }).error?.details ?? [];
  } catch {
    return {};
  }
  const ids = details.flatMap((d) => d.violations ?? []).map((v) => v.quotaId ?? "");
  const quota = ids.some((id) => /PerDay/i.test(id)) ? "day" : ids.some((id) => /PerMinute/i.test(id)) ? "minute" : undefined;
  const delay = details.map((d) => d.retryDelay).find(Boolean);
  const retryAfter = delay ? Math.ceil(parseFloat(delay)) : undefined;
  return { ...(quota ? { quota } : {}), ...(retryAfter !== undefined && Number.isFinite(retryAfter) ? { retryAfter } : {}) };
}

// Models whose daily quota is spent, until when (this instance's memory): they are skipped instead of asked again on
// every check. Looked at again after an hour, in case the quota was reset or raised.
const outForTheDay = new Map<string, number>();
const DAY_OUT_MS = 60 * 60 * 1000;
/** The longest wait for a minute's quota to free up before giving up: the person is still looking at the screen. */
const MAX_MINUTE_WAIT_S = 20;

type Fetch = typeof fetch;

/** Thinking control differs between model generations. */
function thinkingFor(model: string): object {
  return /^gemini-2\./.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: "low" };
}

const transient = (status: number | undefined) => status === undefined || status === 429 || status >= 500;

async function once<T>(model: string, prompt: string, opts: GenerateOptions, key: string, f: Fetch): Promise<{ data: T; usage?: GeminiUsage }> {
  const parts: object[] = (opts.images ?? []).map((img) => ({ inline_data: { mime_type: img.mimeType, data: img.data } }));
  parts.push({ text: prompt });
  let res: Response;
  try {
    res = await f(`${API}/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: opts.schema,
          temperature: 0,
          thinkingConfig: thinkingFor(model),
        },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
      cache: "no-store",
    });
  } catch (err) {
    throw new GeminiError(`network: ${(err as Error).message}`);
  }
  if (!res.ok) {
    const text = await res.text();
    const q = res.status === 429 ? quotaOf(text) : {};
    throw new GeminiError(`HTTP ${res.status}: ${text.slice(0, 200)}`, res.status, q.quota, q.retryAfter);
  }
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number };
  };
  const u = body.usageMetadata;
  const usage: GeminiUsage | undefined = u
    ? {
        promptTokens: u.promptTokenCount ?? 0,
        outputTokens: u.candidatesTokenCount ?? 0,
        thoughtsTokens: u.thoughtsTokenCount ?? 0,
        totalTokens: u.totalTokenCount ?? (u.promptTokenCount ?? 0) + (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
      }
    : undefined;
  const text = (body.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  try {
    return { data: JSON.parse(text) as T, usage };
  } catch {
    throw new GeminiError(`not JSON: ${text.slice(0, 120)}`, 502);
  }
}

/** The fallback models, in order: GEMINI_FALLBACK_MODEL may name several, comma-separated. On the free tier each model has
 *  its own daily quota, so every extra model is more checks a day before the AI is out. */
export const fallbackModels = (value: string | undefined): string[] =>
  (value ?? "gemini-2.5-flash").split(",").map((m) => m.trim()).filter(Boolean);

/**
 * Asks for JSON. Order of attempts: model, model again (after a pause), then each fallback model — retrying only transient
 * failures. On the free tier a 429 says which quota is spent: a model out for the day is skipped from then on; a model
 * busy for the minute is not asked again at once, but if every model is busy the call waits for the soonest one (up to
 * MAX_MINUTE_WAIT_S) and tries it once more. The error that ends it carries the quota, so the page can say "try in a
 * minute" or "try tomorrow".
 */
export async function generateJson<T>(prompt: string, opts: GenerateOptions, deps: { fetch?: Fetch; sleep?: (ms: number) => Promise<void>; now?: () => number } = {}): Promise<GenerateResult<T>> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set");
  const f = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = deps.now ?? Date.now;
  const model = opts.model ?? process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
  const fallbacks = fallbackModels(opts.fallbackModel ?? process.env.GEMINI_FALLBACK_MODEL);
  const attempts = [model, model, ...fallbacks].filter((m, i, a) => i < 2 || (m !== a[0] && a.indexOf(m) === i));
  const available = (m: string) => (outForTheDay.get(m) ?? 0) <= now();

  let last: GeminiError | undefined;
  const busy = new Map<string, number>(); // models busy for the minute, and how long Google said to wait
  const tryModel = async (m: string): Promise<GenerateResult<T> | null> => {
    const t0 = now();
    try {
      const { data, usage } = await once<T>(m, prompt, opts, key, f);
      return { data, model: m, ms: now() - t0, ...(usage ? { usage } : {}) };
    } catch (err) {
      last = err instanceof GeminiError ? err : new GeminiError(String(err));
      if (last.quota === "day") outForTheDay.set(m, now() + DAY_OUT_MS);
      if (last.quota === "minute") busy.set(m, last.retryAfter ?? MAX_MINUTE_WAIT_S);
      if (!transient(last.status)) throw last;
      return null;
    }
  };

  for (const [i, m] of attempts.entries()) {
    if (!available(m) || busy.has(m)) continue;
    if (i === 1) await sleep(1_000);
    const r = await tryModel(m);
    if (r) return r;
  }
  // every model was busy for the minute, or out for the day: wait for the soonest busy one, if it is soon enough
  const soonest = [...busy].filter(([m]) => available(m)).sort((a, b) => a[1] - b[1])[0];
  if (soonest && soonest[1] <= MAX_MINUTE_WAIT_S) {
    await sleep(soonest[1] * 1000);
    busy.delete(soonest[0]);
    const r = await tryModel(soonest[0]);
    if (r) return r;
  }
  if (attempts.every((m) => !available(m))) throw new GeminiError(last?.message ?? "every model is out of quota for the day", 429, "day");
  if (busy.size > 0) throw new GeminiError(last?.message ?? "every model is busy", 429, "minute", Math.min(...busy.values()));
  throw last ?? new GeminiError("no attempt made");
}

/** For tests: forget which models were out for the day. */
export const resetQuotaMemory = () => outForTheDay.clear();
