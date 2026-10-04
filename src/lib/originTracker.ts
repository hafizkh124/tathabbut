// Origin Tracker: Finds the earliest indexed public appearances and circulation history
// of viral religious claims / spurious texts using Gemini with Google Search Grounding.
// Strictly observes ethical guidelines: reports public digital traces without defamatory accusations against individuals.

import { GeminiError } from "./gemini";

const API = "https://generativelanguage.googleapis.com/v1beta/models";

export interface EarliestRecord {
  estimatedDate?: string;
  sourcePlatform?: string;
  sourceUrl?: string;
  snippet?: string;
}

export interface GroundingSource {
  title: string;
  url: string;
}

export interface OriginReport {
  query: string;
  earliestRecord: EarliestRecord;
  spreadPattern: string;
  summary: string;
  lang: OriginLang;
  groundingSources: GroundingSource[];
  disclaimer: string;
  model?: string;
}

export type OriginLang = "ar" | "en" | "ur";

const LANG_NAME: Record<OriginLang, string> = { ar: "Arabic", en: "English", ur: "Urdu" };

const TEXT: Record<OriginLang, { disclaimer: string; date: string; platform: string; spread: string; summary: string }> = {
  ur: {
    disclaimer:
      "تنبیہ: یہ معلومات انٹرنیٹ پر عوامی طور پر دستیاب ریکارڈز اور سرچ انڈیکس کے تجزیے پر مبنی ہیں۔ سوشل میڈیا پر گردش کرنے والے پیغامات کی پہلی اصل حتمی طور پر طے کرنا تکنیکی طور پر ممکن نہیں ہوتا۔ یہ نتائج صرف آگاہی اور تحقیق میں مدد کے لیے ہیں۔",
    date: "معلوم نہیں",
    platform: "انٹرنیٹ فورمز اور ویب سائٹس",
    spread: "سوشل میڈیا اور میسجنگ ایپس پر گردش",
    summary: "انٹرنیٹ پر عوامی ریکارڈز کے جائزے کے مطابق یہ تحریر مختلف فورمز اور پیغامات میں گردش کرتی رہی ہے۔",
  },
  ar: {
    disclaimer:
      "تنبيه: هذه المعلومات مبنية على تحليل السجلات العامة المتاحة على الإنترنت وفهارس البحث. لا يمكن تقنيًا تحديد الأصل الأول لرسائل مواقع التواصل بشكل قاطع. النتائج للتوعية والمساعدة على البحث فقط.",
    date: "غير معروف",
    platform: "المنتديات والمواقع الإلكترونية",
    spread: "تداول على وسائل التواصل وتطبيقات المراسلة",
    summary: "بحسب مراجعة السجلات العامة على الإنترنت، ظل هذا النص يتداول في منتديات ورسائل متعددة.",
  },
  en: {
    disclaimer:
      "Note: this is based on publicly available records and search indexes. It is technically impossible to settle the true first source of a message circulating on social media. The results are for awareness and research support only.",
    date: "Unknown",
    platform: "Internet forums and websites",
    spread: "Circulation on social media and messaging apps",
    summary: "According to public internet records, this text has been circulating in various forums and messages.",
  },
};

interface GeminiGroundingResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: {
        web?: {
          uri?: string;
          title?: string;
        };
      }[];
    };
  }[];
}

export interface OriginTrackerDeps {
  /** Language of the report; defaults to Urdu. */
  lang?: OriginLang;
  fetch?: typeof fetch;
  apiKey?: string;
  model?: string;
}

/** Extracts the JSON block from text response */
export function extractJsonFromText<T>(text: string): T | null {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*\})/);
    const toParse = jsonMatch ? jsonMatch[1] : text;
    return JSON.parse(toParse) as T;
  } catch {
    return null;
  }
}

/**
 * Searches for the digital provenance / earliest public traces of a viral claim or misquote.
 */
export async function trackClaimOrigin(claimText: string, deps: OriginTrackerDeps = {}): Promise<OriginReport> {
  const key = deps.apiKey ?? process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set");

  const lang: OriginLang = deps.lang && deps.lang in TEXT ? deps.lang : "ur";
  const tx = TEXT[lang];
  const f = deps.fetch ?? fetch;
  const model = deps.model ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  const prompt = `You are a digital fact-checking and provenance researcher specializing in Islamic circulating texts, chain messages, and viral posts.
Analyze the earliest digital traces, public forums, websites, blogs, or social media circulation of the following text:

"${claimText}"

Investigate:
1. When did this specific wording, claim, or chain message first start appearing publicly on the internet (estimated year or date)?
2. What kind of public platform, forum, or website is the earliest indexed public trace?
3. How was it typically spread (e.g. email chain letter, WhatsApp forward, online discussion forum, blog, fake quote image)?
4. A concise, neutral summary in clear ${LANG_NAME[lang]} explaining the earliest known digital circulation, without accusing any specific private individual or defamatory naming.

Return ONLY a valid JSON object with the following fields. Write every field value in ${LANG_NAME[lang]} (except sourceUrl):
{
  "estimatedDate": "e.g. around 2008, or 2012",
  "sourcePlatform": "e.g. Islamic forums / blog / email chain letters",
  "sourceUrl": "e.g. earliest public URL if known, or leave empty",
  "snippet": "a short quote or introduction",
  "spreadPattern": "e.g. WhatsApp forward / forum circulation",
  "summary": "a detailed yet concise summary of when and how this text started circulating on the internet"
}`;

  let res: Response;
  try {
    res = await f(`${API}/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          temperature: 0.1,
        },
      }),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
  } catch (err) {
    throw new GeminiError(`network: ${(err as Error).message}`);
  }

  if (!res.ok) {
    throw new GeminiError(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status);
  }

  const data = (await res.json()) as GeminiGroundingResponse;
  const candidate = data.candidates?.[0];
  const partsText = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("\n");

  // Collect grounding sources
  const groundingSources: GroundingSource[] = [];
  const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
  for (const chunk of chunks) {
    if (chunk.web?.uri && chunk.web?.title) {
      groundingSources.push({
        title: chunk.web.title,
        url: chunk.web.uri,
      });
    }
  }

  // Parse structured data
  const parsed = extractJsonFromText<{
    estimatedDate?: string;
    sourcePlatform?: string;
    sourceUrl?: string;
    snippet?: string;
    spreadPattern?: string;
    summary?: string;
  }>(partsText);

  const earliestRecord: EarliestRecord = {
    estimatedDate: parsed?.estimatedDate ?? tx.date,
    sourcePlatform: parsed?.sourcePlatform ?? tx.platform,
    sourceUrl: parsed?.sourceUrl || groundingSources[0]?.url,
    snippet: parsed?.snippet ?? "",
  };

  const spreadPattern = parsed?.spreadPattern ?? tx.spread;
  const summary = parsed?.summary || (partsText.length > 50 ? partsText.slice(0, 300) : tx.summary);

  return {
    query: claimText,
    earliestRecord,
    spreadPattern,
    summary,
    lang,
    groundingSources: groundingSources.slice(0, 5),
    disclaimer: tx.disclaimer,
    model,
  };
}
