// A signature on a retrieved Turath excerpt or a retrieved similar expression, checked by /api/translate.
// Only server-selected source text can be translated; arbitrary client text is never signed.
// The key never leaves the server: a dedicated one when set, else a secret the deployment already has.
import { createHmac, timingSafeEqual } from "node:crypto";

export const signingKey = (): string | null => process.env.TRANSLATE_SIGNING_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.GEMINI_API_KEY || null;

/** The signature of `text`, or undefined when the server has no key (then nothing is translated). */
export function signExcerpt(text: string, key: string | null = signingKey()): string | undefined {
  return key ? createHmac("sha256", key).update(text, "utf8").digest("hex") : undefined;
}

export function verifyExcerpt(text: string, signature: unknown, key: string | null = signingKey()): boolean {
  if (typeof signature !== "string" || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = signExcerpt(text, key);
  return expected !== undefined && timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}
