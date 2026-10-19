// The book a post names for its hadith («رواه الحاكم في المستدرك», «مستدرک حاکم», «سنن ابوداؤد 4944»), found among
// Dorar's narrations, so the one the person asked about is shown first (team lead, 2026-10-19). The overall state is
// not touched: it still comes from all the narrations (verify.ts → summarizeGrades).
import { normalizeArabic } from "./arabic";
import type { GradedNarration } from "./hadithMatch";

/** Urdu letters folded to their Arabic forms, then the usual Arabic folding: «مستدرک حاکم» → «مستدرك حاكم». */
const fold = (s: string) =>
  normalizeArabic(
    s
      .replace(/[کڪ]/g, "ك")
      .replace(/[یےۍ]/g, "ي")
      .replace(/[ہۀھ]/g, "ه")
      .replace(/ۃ/g, "ة")
      .replace(/ؤ/g, "و")
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)),
  );

interface Book {
  /** how a post names it (folded text) */
  cited: RegExp;
  /** the book's own names in Dorar's source field (folded, matched as a substring) */
  sources: string[];
  /** a verdict book on it (al-Albani's «صحيح/ضعيف …»): taken only when the book itself is not among the results */
  verdictBooks?: string[];
}

const BOOKS: Book[] = [
  { cited: /مستدرك|الحاكم|حاكم/, sources: ["المستدرك"] },
  { cited: /بخاري/, sources: ["صحيح البخاري"] },
  { cited: /(^|[\s،,.:(«])(صحيح )?مسلم($|[\s،,.:)»\d])/, sources: ["صحيح مسلم"] },
  { cited: /ترمذي/, sources: ["سنن الترمذي", "جامع الترمذي"], verdictBooks: ["صحيح الترمذي", "ضعيف الترمذي"] },
  { cited: /داود|داوود/, sources: ["سنن ابي داود"], verdictBooks: ["صحيح ابي داود", "ضعيف ابي داود"] },
  { cited: /نسائي/, sources: ["سنن النسائي", "السنن الكبري للنسائي"], verdictBooks: ["صحيح النسائي", "ضعيف النسائي"] },
  { cited: /ماجه|ماجة/, sources: ["سنن ابن ماجه", "سنن ابن ماجة"], verdictBooks: ["صحيح ابن ماجه", "ضعيف ابن ماجه"] },
  { cited: /مسند احمد|الامام احمد|(^|\s)احمد($|\s|\d)/, sources: ["مسند احمد"] },
  { cited: /ابن حبان/, sources: ["صحيح ابن حبان"] },
  { cited: /ابن خزيمه|ابن خزيمة/, sources: ["صحيح ابن خزيمه"] },
  { cited: /طبراني/, sources: ["المعجم الكبير", "المعجم الاوسط", "المعجم الصغير"] },
  { cited: /بيهقي/, sources: ["السنن الكبري للبيهقي", "شعب الايمان", "دلائل النبوه"] },
  { cited: /دارمي/, sources: ["سنن الدارمي"] },
  { cited: /بزار/, sources: ["البحر الزخار", "مسند البزار"] },
  { cited: /موطا|مالك/, sources: ["الموطا"] },
];

/** The hadith number a post gives with the book («ترمذی 2645», «المستدرك (1/123)» gives none), if any. */
function citedNumber(cited: string): string | null {
  return fold(cited).match(/(?<![\d/])(\d{1,6})(?![\d/])/)?.[1] ?? null;
}

/**
 * The narration of the book the post names, from the narrations shown (the accepted ones first, then the weaker
 * variants), or null when that book is not among them. Several of one book: the one with the number the post gives,
 * else the first in the ranked order.
 */
export function citedNarration<N extends GradedNarration>(cited: string | null | undefined, lists: N[][]): N | null {
  if (!cited?.trim()) return null;
  const c = fold(cited);
  const book = BOOKS.find((b) => b.cited.test(c));
  if (!book) return null;
  const all = lists.flat();
  const of = (names: string[]) => all.filter((n) => names.some((name) => fold(n.source ?? "").includes(fold(name))));
  const own = of(book.sources);
  const pool = own.length ? own : of(book.verdictBooks ?? []);
  if (!pool.length) return null;
  const num = citedNumber(cited);
  return (num && pool.find((n) => fold(n.reference ?? "").replace(/\D/g, "") === num)) || pool[0];
}

/** Whether the post names a book this module knows, so «not among the results» can be said of it. */
export const isKnownBook = (cited: string | null | undefined): boolean => Boolean(cited?.trim() && BOOKS.some((b) => b.cited.test(fold(cited))));
