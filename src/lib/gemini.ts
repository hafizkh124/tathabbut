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

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

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
  if (!res.ok) throw new GeminiError(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status);
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

/** Asks for JSON. Order of attempts: model, model again (after a pause), fallback model — retrying only transient failures. */
export async function generateJson<T>(prompt: string, opts: GenerateOptions, deps: { fetch?: Fetch; sleep?: (ms: number) => Promise<void> } = {}): Promise<GenerateResult<T>> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set");
  const f = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const model = opts.model ?? process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
  const fallback = opts.fallbackModel ?? process.env.GEMINI_FALLBACK_MODEL ?? "gemini-2.5-flash";
  const attempts = [model, model, fallback].filter((m, i, a) => i < 2 || m !== a[0]);

  let last: GeminiError | undefined;
  for (const [i, m] of attempts.entries()) {
    if (i === 1) await sleep(1_000);
    const t0 = Date.now();
    try {
      const { data, usage } = await once<T>(m, prompt, opts, key, f);
      return { data, model: m, ms: Date.now() - t0, ...(usage ? { usage } : {}) };
    } catch (err) {
      last = err instanceof GeminiError ? err : new GeminiError(String(err));
      if (!transient(last.status)) throw last;
    }
  }
  throw last ?? new GeminiError("no attempt made");
}
