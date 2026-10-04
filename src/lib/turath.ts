import { adaptTurathPassages, MAX_TURATH_PASSAGE_CHARS, type TurathLookupOutcome, type TurathReference } from "./hadithMatch";
import rulingBookIds from "../data/turathRulingBooks.json";
import { searchTurath, type TurathSearchOptions, type TurathSearchResult } from "./turathApi";
import { isSameText } from "./turathMatch";
import { SCOPES, type TurathLookupKind } from "./turathScope";

/** One deadline for the whole lookup (specialist's decision, 2026-10-05: 5 s, so the screen never lags on the books). */
export const TURATH_TIMEOUT_MS = 5_000;
export const MAX_TURATH_PASSAGES = 10;

/** Books that judge hadith (the specialist's list): a passage from one is tagged so the reader reads its wording. */
const RULING_BOOKS = new Set<string>((rulingBookIds as Array<string | number>).map(String));

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
    try {
      const searches = await Promise.allSettled(
        SCOPES[kind].map(async (category) => {
          const found = await search(query, { categoryId: category.id, maxPassages: MAX_TURATH_PASSAGES, maxChars: MAX_TURATH_PASSAGE_CHARS, signal: controller.signal });
          return adaptTurathPassages(found.passages, category).filter((r) => isSameText(query, r.excerpt));
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
          references.push(RULING_BOOKS.has(ref.bookId) ? { ...ref, rulingBook: true } : ref);
        }
      }
      return {
        status: "success",
        references: references.slice(0, MAX_TURATH_PASSAGES),
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
