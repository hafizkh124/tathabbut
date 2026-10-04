import { adaptTurathPassages, MAX_TURATH_PASSAGE_CHARS, type TurathLookupOutcome, type TurathReference } from "./hadithMatch";
import { searchTurath, type TurathSearchOptions, type TurathSearchResult } from "./turathApi";
import { isSameText } from "./turathMatch";
import { LOOKUP_LIMITS, SCOPES, type TurathLookupKind } from "./turathScope";

/** One deadline for the whole lookup (specialist's decision, 2026-10-05: 5 s, so the screen never lags on the books). */
export const TURATH_TIMEOUT_MS = 5_000;
export const MAX_TURATH_PASSAGES = 10;

const UNAVAILABLE: TurathLookupOutcome = { status: "unavailable", references: [] };

export type TurathSearch = (query: string, options: TurathSearchOptions) => Promise<TurathSearchResult>;

/**
 * A bounded, category-scoped live lookup. One search per category (Turath allows one category per search), all in
 * parallel under one deadline; a passage is kept only when it holds the asked text (isSameText). A timeout or provider
 * error is "evidence unavailable", never a grade; if only some searches fail the result is flagged `partial`.
 */
export function createTurathLookup(search: TurathSearch = searchTurath) {
  return async (query: string, kind: TurathLookupKind): Promise<TurathLookupOutcome> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TURATH_TIMEOUT_MS);
    const limits = LOOKUP_LIMITS[kind];
    try {
      const searches = await Promise.allSettled(
        SCOPES[kind].map(async (category) => {
          const found = await search(query, { categoryId: category.id, maxPassages: limits.fetch, maxChars: MAX_TURATH_PASSAGE_CHARS, signal: controller.signal });
          const refs = adaptTurathPassages(found.passages, category);
          const holds = (r: TurathReference) => isSameText(query, r.excerpt);
          // a text must be in the passage; for a topic those that hold it come first, then Turath's own order
          return (limits.strict ? refs.filter(holds) : [...refs.filter(holds), ...refs.filter((r) => !holds(r))]).slice(0, limits.keep);
        }),
      );

      const succeeded = searches.filter((s): s is PromiseFulfilledResult<TurathReference[]> => s.status === "fulfilled");
      if (!succeeded.length) return UNAVAILABLE;

      const seen = new Set<string>();
      const references: TurathReference[] = [];
      for (const { value } of succeeded) {
        for (const ref of value) {
          const key = ref.pageLocator?.internalPage !== undefined ? `${ref.bookId}:${ref.pageLocator.internalPage}` : `${ref.bookId}:${ref.excerpt.slice(0, 60)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          references.push(ref);
        }
      }
      return {
        status: "success",
        references: references.slice(0, limits.total),
        ...(succeeded.length < searches.length ? { partial: true as const } : {}),
      };
    } catch {
      return UNAVAILABLE;
    } finally {
      clearTimeout(timer);
    }
  };
}

export const lookupTurath = createTurathLookup();
