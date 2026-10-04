import { createTurathClient, type TurathClient } from "nusus/turath";
import { adaptTurathPassages, MAX_TURATH_PASSAGE_CHARS, type TurathLookupOutcome } from "./hadithMatch";

export const TURATH_TIMEOUT_MS = 10_000;
export const MAX_TURATH_PASSAGES = 10;

const turathClient = createTurathClient({ timeout: TURATH_TIMEOUT_MS });

/** Create a bounded, unfiltered live lookup. A timeout or provider error is evidence-unavailable, not a grade. */
export function createTurathLookup(client: Pick<TurathClient, "retrieve"> = turathClient) {
  return async (query: string): Promise<TurathLookupOutcome> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TURATH_TIMEOUT_MS);
    try {
      const context = await client.retrieve(query, {
        maxPassages: MAX_TURATH_PASSAGES,
        maxCharsPerPassage: MAX_TURATH_PASSAGE_CHARS,
        signal: controller.signal,
      });
      return { status: "success", references: adaptTurathPassages(context.passages) };
    } catch {
      return { status: "unavailable", references: [] };
    } finally {
      clearTimeout(timer);
    }
  };
}

export const lookupTurath = createTurathLookup();
