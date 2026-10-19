import { describe, expect, it } from "vitest";
import { decodeEntities, foldText, htmlLines, isHadithRuling, toRow, withoutGreeting, type WpPost } from "./alulama";

// Posts as alulama.org's REST API sent them on 2026-10-19.
const TWO_SHAIKHS: WpPost = {
  id: 65151,
  link: "https://alulama.org/example-1/",
  date: "2026-10-12T09:00:00",
  modified: "2026-10-13T10:00:00",
  categories: [7191],
  title: { rendered: "مصحف پر تعلیقات اور ہائی لائٹر استعمال کرنے کا حکم" },
  content: {
    rendered:
      '<h3>سوال 7581</h3>\n<p>السلام علیکم ورحمة اللّٰه وبرکاته.<br />\nاحسن اللّٰه الیکم.<br />\nمصحف پر تعلیقات لگانا، یا highlighter سے رنگ لگانا آیات کو، اس سب کا کیا حکم ہے؟</p>\n<h3>جواب</h3>\n<p>وعلیکم السلام ورحمۃ اللہ وبرکاتہ<br />\nتعلیم و تربیت اور افہام و تفہیم کی غرض سے جائز ہے۔</p>\n<p style="text-align: left;"><strong>فضیلۃ العالم حافظ خضر حیات حفظہ اللہ</strong></p>\n<p>وعلیکم السلام ورحمۃ اللہ وبرکاتہ<br />\nباوقتِ ضرورت آپ مصحف پر تعلیقات لگا سکتے ہیں۔</p>\n<p style="text-align: left;"><strong>فضیلۃ الشیخ عبد الوکیل ناصر حفظہ اللہ</strong></p>',
  },
};

describe("htmlLines / decodeEntities", () => {
  it("turns blocks and breaks into lines and drops every tag", () => {
    expect(htmlLines("<h3>سوال 1</h3><p>a<br />b <strong>c</strong></p><script>alert(1)</script>")).toEqual(["سوال 1", "a", "b c"]);
  });

  it("decodes named and numeric entities, and leaves an unknown one as it is", () => {
    expect(decodeEntities("&#8220;میں&#8221; &amp; &quot;x&quot; &#x41; &nosuch;")).toBe("“میں” & \"x\" A &nosuch;");
  });
});

describe("foldText", () => {
  it("reads the spellings of one word as one", () => {
    const same = ["زکاۃ", "زکوٰۃ", "زکوة", "زكاة"].map(foldText);
    expect(new Set(same).size).toBe(1);
    expect(foldText("نماز میں ہاتھ")).toBe(foldText("نَمَاز مِیں ہَاتھ"));
  });

  it("keeps Urdu letters and drops punctuation", () => {
    expect(foldText("پیغام، گھر؟")).toBe("پيغام گهر");
  });
});

describe("withoutGreeting", () => {
  it.each([
    ["السلام علیکم ورحمۃ اللہ وبرکاتہ", ""],
    ["وعلیکم السلام و رحمۃ اللہ وبرکاتہ", ""],
    ["جزاکم اللہ خیراً", ""],
    ["محترم شیخ صاحب!", ""],
    ["السلام علیکم بغیر محرم کے عورت حج اور عمرہ نہیں کر سکتی؟", "بغیر محرم کے عورت حج اور عمرہ نہیں کر سکتی؟"],
    ["ہماری دانست میں تو یہ درست ہے", "ہماری دانست میں تو یہ درست ہے"],
  ])("%s", (line, out) => expect(withoutGreeting(line)).toBe(out));
});

describe("isHadithRuling", () => {
  it.each([
    ["(مانع الزکوۃ یوم القیامۃ فی النار) اس حدیث کا حکم", true],
    ["“خيركم خيركم لأهله وأنا خيركم لأهلي” حدیث کا حکم", true],
    ["“مَا رَأَيْتَ ابْنَ الْمُسَيَّبِ قَابضًا يَمِينَهُ۔۔۔” کیا اس کی سند صحیح ہے؟", true],
    ["حذیفہ رضی اللہ عنہ کے خیطِ حُمّى والے اثر کی تخریج و تحقیق", true],
    ["اللّٰہ سفید بالوں کا حیا کرتا ہے ایسی کوئی حدیث ہے؟", true],
    ["غیر اہل حدیث رشتہ دار کے جنازے میں شرکت اور نماز جنازہ کا شرعی حکم", false],
    ["نماز عید کا مسنون طریقہ قرآن وحدیث کی روشنی میں", false],
    ["نماز جمعہ کے وقت فلائٹ ہو تو جمعہ کا حکم", false],
    ["کرپٹو کرنسی اور اس کی دیگر صورتیں جائز ہیں؟", false],
    ["زکاۃ مقررہ وقت میں ادا کرنا", false],
  ])("%s", (title, yes) => expect(isHadithRuling(title)).toBe(yes));
});

describe("toRow", () => {
  it("takes the question without its greetings, the first answer only, and the shaikhs named under the answers", () => {
    const row = toRow(TWO_SHAIKHS)!;
    expect(row).toMatchObject({ id: 65151, kind: "fatwa", number: 7581, link: "https://alulama.org/example-1/", categories: [7191] });
    expect(row.search_text).toContain(foldText("مصحف پر تعلیقات لگانا، یا highlighter سے رنگ لگانا"));
    expect(row.answer_snippet).toBe("تعلیم و تربیت اور افہام و تفہیم کی غرض سے جائز ہے۔");
    expect(row.answerers).toEqual(["فضیلۃ العالم حافظ خضر حیات حفظہ اللہ", "فضیلۃ الشیخ عبد الوکیل ناصر حفظہ اللہ"]);
    expect(row.published).toBe("2026-10-12T09:00:00+00:00");
    expect(row.search_text).not.toContain("السلام");
    expect(row.title_clean).toBe(foldText(row.title));
  });

  it("marks a post that asks about a hadith", () => {
    const row = toRow({ ...TWO_SHAIKHS, title: { rendered: "&#8220;أبغضُ الحلالِ إلى اللهِ الطلاق&#8221; حدیث کا حکم" } })!;
    expect(row.kind).toBe("hadith_ruling");
    expect(row.title).toBe("“أبغضُ الحلالِ إلى اللهِ الطلاق” حدیث کا حکم");
  });

  it("keeps the answer within the limit, cut at a word", () => {
    const long = "کلمہ ".repeat(400);
    const row = toRow({ ...TWO_SHAIKHS, content: { rendered: `<h3>سوال 1</h3><p>سوال؟</p><h3>جواب</h3><p>${long}</p>` } })!;
    expect(row.answer_snippet.length).toBeLessThanOrEqual(500);
    expect(row.answer_snippet.endsWith("کلمہ")).toBe(true);
  });

  it("reads an older «سوال: … جواب: …» post", () => {
    const row = toRow({ ...TWO_SHAIKHS, content: { rendered: "<p>سوال: مسافر پر جمعہ ہے؟ جواب: نہیں ہے۔</p>" } });
    expect(row?.search_text).toContain(foldText("مسافر پر جمعہ ہے"));
    expect(row?.answer_snippet).toBe("نہیں ہے۔");
  });

  it("gives nothing for a post with no answer", () => {
    expect(toRow({ ...TWO_SHAIKHS, content: { rendered: "<h3>سوال 5</h3><p>کوئی سوال؟</p><h3>جواب</h3>" } })).toBeNull();
    expect(toRow({ ...TWO_SHAIKHS, title: { rendered: "" } })).toBeNull();
  });
});
