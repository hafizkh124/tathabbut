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
/** A model that did not answer in time is left out for a minute (this instance's memory): on 2026-10-19 the 3.8 and 3.7
 *  Flash models hung for 30 s+ while the others answered in 1-2 s, and asking each slow one again spent the whole
 *  function. One call waits at most CALL_MS; all the models of one request together at most BUDGET_MS, under Vercel's
 *  60 s limit. */
const slowUntil = new Map<string, number>();
const SLOW_OUT_MS = 60 * 1000;
const CALL_MS = 15_000;
const BUDGET_MS = 45_000;
const MIN_CALL_MS = 3_000;

type Fetch = typeof fetch;

/** Thinking control differs between model generations. */
function thinkingFor(model: string): object {
  return /^gemini-2\./.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: "low" };
}

const transient = (status: number | undefined) => status === undefined || status === 429 || status >= 500;

/** Gemma (open models served by the same API, with a far larger free daily quota) takes no JSON mode or schema, and of
 *  the thinking settings only thinkingLevel "minimal" (without it Gemma 4 thinks ~700 tokens: 12-20 s instead of ~1.3 s,
 *  checked 2026-10-19). The schema goes into the prompt instead, and the JSON is read out of the reply. */
export const isGemma = (model: string) => /^gemma-/.test(model);

/** The JSON object in a reply that may wrap it in a code fence or a sentence. */
export function jsonIn(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1];
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

/** Other providers with an OpenAI-style chat API, named in the model lists with a prefix ("ifm:IFM/K2-Horizon-375B-A23B",
 *  "groq:openai/gpt-oss-120b"), so they join the same fallback chain with their own free quotas. They read no pictures,
 *  so a picture skips them; the schema goes into the prompt and JSON mode is asked for. */
const PROVIDERS: Record<string, { url: () => string | undefined; key: () => string | undefined }> = {
  ifm: { url: () => process.env.IFM_BASE_URL && `${process.env.IFM_BASE_URL.replace(/\/$/, "")}/chat/completions`, key: () => process.env.IFM_API_KEY },
  groq: { url: () => "https://api.groq.com/openai/v1/chat/completions", key: () => process.env.GROQ_API_KEY },
};

export function providerOf(model: string): { provider: string; name: string } | null {
  const m = model.match(/^(\w+):(.+)$/);
  return m && PROVIDERS[m[1]] ? { provider: m[1], name: m[2] } : null;
}

const schemaPrompt = (prompt: string, schema: object) =>
  `${prompt}\n\nReply with one JSON object only, no other text, that follows this schema:\n${JSON.stringify(schema)}`;

async function onceChat<T>(provider: string, name: string, prompt: string, opts: GenerateOptions, f: Fetch): Promise<{ data: T; usage?: GeminiUsage }> {
  const p = PROVIDERS[provider];
  const url = p.url();
  const key = p.key();
  // 501 (not this one): the chain moves on, even from the first model, when this provider is not set up here or cannot
  // read a picture
  if (!url || !key) throw new GeminiError(`${provider}: not configured`, 501);
  if (opts.images?.length) throw new GeminiError(`${provider}: reads no pictures`, 501);
  let res: Response;
  try {
    res = await f(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: name, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "user", content: schemaPrompt(prompt, opts.schema) }] }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
      cache: "no-store",
    });
  } catch (err) {
    throw new GeminiError(`network: ${(err as Error).message}`);
  }
  if (!res.ok) {
    const text = await res.text();
    // a 429 that names a daily limit (Groq: "requests per day (RPD)", "tokens per day (TPD)") is out for the day; any
    // other 429 is the minute's, with the wait the provider sends in Retry-After
    const quota: QuotaKind | undefined = res.status === 429 ? (/per day|\bRPD\b|\bTPD\b/i.test(text) ? "day" : "minute") : undefined;
    const wait = Math.ceil(parseFloat(res.headers.get("retry-after") ?? ""));
    throw new GeminiError(`HTTP ${res.status}: ${text.slice(0, 200)}`, res.status, quota, Number.isFinite(wait) ? wait : undefined);
  }
  const body = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } };
  };
  const u = body.usage;
  const usage: GeminiUsage | undefined = u
    ? {
        promptTokens: u.prompt_tokens ?? 0,
        outputTokens: (u.completion_tokens ?? 0) - (u.completion_tokens_details?.reasoning_tokens ?? 0),
        thoughtsTokens: u.completion_tokens_details?.reasoning_tokens ?? 0,
        totalTokens: u.total_tokens ?? 0,
      }
    : undefined;
  const text = body.choices?.[0]?.message?.content ?? "";
  try {
    return { data: JSON.parse(jsonIn(text)) as T, usage };
  } catch {
    throw new GeminiError(`not JSON: ${text.slice(0, 120)}`, 502);
  }
}

async function once<T>(model: string, prompt: string, opts: GenerateOptions, key: string, f: Fetch): Promise<{ data: T; usage?: GeminiUsage }> {
  const other = providerOf(model);
  if (other) return onceChat<T>(other.provider, other.name, prompt, opts, f);
  const gemma = isGemma(model);
  const parts: object[] = (opts.images ?? []).map((img) => ({ inline_data: { mime_type: img.mimeType, data: img.data } }));
  parts.push({
    text: gemma ? schemaPrompt(prompt, opts.schema) : prompt,
  });
  let res: Response;
  try {
    res = await f(`${API}/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: gemma
          ? { temperature: 0, thinkingConfig: { thinkingLevel: "minimal" } }
          : {
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
    return { data: JSON.parse(gemma ? jsonIn(text) : text) as T, usage };
  } catch {
    throw new GeminiError(`not JSON: ${text.slice(0, 120)}`, 502);
  }
}

/** The fallback models, in order: GEMINI_FALLBACK_MODELS (or the older GEMINI_FALLBACK_MODEL) may name several,
 *  comma-separated. On the free tier each model has its own quota, so every extra model is more checks before the AI is out. */
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
  const fallbacks = fallbackModels(opts.fallbackModel ?? (process.env.GEMINI_FALLBACK_MODELS || process.env.GEMINI_FALLBACK_MODEL));
  const attempts = [model, model, ...fallbacks].filter((m, i, a) => i < 2 || (m !== a[0] && a.indexOf(m) === i));
  const available = (m: string) => (outForTheDay.get(m) ?? 0) <= now() && (slowUntil.get(m) ?? 0) <= now();
  const started = now();
  const left = () => BUDGET_MS - (now() - started);

  let last: GeminiError | undefined;
  const busy = new Map<string, number>(); // models busy for the minute, and how long Google said to wait
  const tryModel = async (m: string): Promise<GenerateResult<T> | null> => {
    const t0 = now();
    try {
      const { data, usage } = await once<T>(m, prompt, { ...opts, timeoutMs: Math.min(opts.timeoutMs ?? CALL_MS, left()) }, key, f);
      return { data, model: m, ms: now() - t0, ...(usage ? { usage } : {}) };
    } catch (err) {
      last = err instanceof GeminiError ? err : new GeminiError(String(err));
      if (last.quota === "day") outForTheDay.set(m, now() + DAY_OUT_MS);
      if (last.quota === "minute") busy.set(m, last.retryAfter ?? MAX_MINUTE_WAIT_S);
      if (last.status === undefined && /timeout|abort/i.test(last.message)) slowUntil.set(m, now() + SLOW_OUT_MS);
      if (transient(last.status)) return null;
      // a fallback model the API does not know (404) or will not take this request from (400, e.g. a setting that model
      // lacks): the next model is tried; an unknown one is left out for the hour. The main model's 400 is the request's.
      if (m !== model && (last.status === 404 || last.status === 400)) {
        console.warn(`gemini: fallback model ${m} failed with ${last.status}; trying the next one`);
        if (last.status === 404) outForTheDay.set(m, now() + DAY_OUT_MS);
        return null;
      }
      throw last;
    }
  };

  for (const [i, m] of attempts.entries()) {
    if (left() < MIN_CALL_MS) break;
    if (!available(m) || busy.has(m)) continue;
    if (i === 1) await sleep(1_000);
    const r = await tryModel(m);
    if (r) return r;
  }
  // every model was busy for the minute, or out for the day: wait for the soonest busy one, if it is soon enough
  const soonest = [...busy].filter(([m]) => available(m)).sort((a, b) => a[1] - b[1])[0];
  if (soonest && soonest[1] <= MAX_MINUTE_WAIT_S && left() - soonest[1] * 1000 >= MIN_CALL_MS) {
    await sleep(soonest[1] * 1000);
    busy.delete(soonest[0]);
    const r = await tryModel(soonest[0]);
    if (r) return r;
  }
  if (attempts.every((m) => (outForTheDay.get(m) ?? 0) > now())) throw new GeminiError(last?.message ?? "every model is out of quota for the day", 429, "day");
  // nothing answered in time (slow models, or the budget ran out): the page says it is busy, try in a minute
  if (busy.size === 0 && (left() < MIN_CALL_MS || attempts.some((m) => (slowUntil.get(m) ?? 0) > now())))
    throw new GeminiError(last?.message ?? "every model is slow", 429, "minute", 60);
  if (busy.size > 0) throw new GeminiError(last?.message ?? "every model is busy", 429, "minute", Math.min(...busy.values()));
  throw last ?? new GeminiError("no attempt made");
}

/** For tests: forget which models were out for the day. */
export const resetQuotaMemory = () => {
  outForTheDay.clear();
  slowUntil.clear();
};
