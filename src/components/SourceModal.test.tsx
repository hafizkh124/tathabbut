import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SourceModal } from "./SourceModal";

describe("SourceModal — Turath references", () => {
  it("renders cited passages, book metadata, page locators, and source links", () => {
    const html = renderToStaticMarkup(<SourceModal
      isOpen
      onClose={() => undefined}
      data={{
        title: "مراجع الحديث",
        kind: "hadith",
        arabicText: "نص الحديث",
        turathDetails: {
          status: "success",
          references: [{
            excerpt: "ذكره العلماء مع بيان علته",
            citation: "كتاب العلل، 2/84",
            book: { id: "42", title: "كتاب العلل" },
            author: { name: "الإمام" },
            bookId: "42",
            pageLocator: { internalPage: 17, printedPage: 84, volume: "2" },
            url: "https://app.turath.io/book/42/17",
            provenance: { query: "نص الحديث", rank: 1, totalMatches: 1, truncated: false, contextPages: { before: 0, after: 0 }, retrievedVia: "search-hit" },
          }],
        },
      }}
    />);

    expect(html).toContain("ذكره العلماء مع بيان علته");
    expect(html).toContain("كتاب العلل");
    expect(html).toContain("معرّف الصفحة الداخلي في تراث: 17");
    expect(html).toContain("الصفحة المطبوعة: 84");
    expect(html).toContain('href="https://app.turath.io/book/42/17"');
  });

  it("distinguishes a successful empty search from an unavailable search", () => {
    const base = { title: "مراجع الحديث", kind: "hadith" as const, arabicText: "نص الحديث" };
    const emptyHtml = renderToStaticMarkup(<SourceModal isOpen onClose={() => undefined} data={{
      ...base,
      turathDetails: { status: "success", references: [] },
    }} />);
    const unavailableHtml = renderToStaticMarkup(<SourceModal isOpen onClose={() => undefined} data={{
      ...base,
      turathDetails: { status: "unavailable", references: [] },
    }} />);

    expect(emptyHtml).toContain("اكتمل البحث المباشر في تراث، ولم تُعثر على إحالات مطابقة");
    expect(unavailableHtml).toContain("تعذّر البحث في تراث مؤقتا");
    expect(unavailableHtml).toContain("لا يغيّر حالة التحقق أو أحكام الدرر السنية");
  });
});
