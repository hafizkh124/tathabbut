import { describe, expect, it, vi } from "vitest";
import { arabicRun, checkClaims, cleanTopic, extractClaims, topicQuery, foldUrduLetters, recoverSlice, transcribeImage } from "./claims";

// The post used in the live Gemini test of 2026-10-03.
const POST = `واٹس ایپ پوسٹ:
حدیث ہے: اطلبوا العلم ولو بالصين — یعنی علم حاصل کرو چاہے چین جانا پڑے۔
اور اللہ فرماتا ہے: إن الله مع الصابرون۔
امام ابن تیمیہ فرماتے ہیں: "ما رأيت شيئاً يغذي العقل والروح أكثر من إدامة النظر في كتاب الله" (مجموع الفتاوى 7/493)
نبی ﷺ نے فرمایا: إنما الأعمال بالنيات۔
یہ پیغام دس لوگوں کو بھیجو، جنت ملے گی۔`;

describe("checkClaims — the model points, the post decides", () => {
  it("never keeps a 'correction' of the Quran: the post's own wording is used (live case, gemini-3.8-flash)", () => {
    const { claims } = checkClaims(POST, [{ kind: "quran", text_as_written: "إن الله مع الصابرون۔", arabic_span: "إن الله مع الصابرين" }]);
    expect(claims[0].arabicSpan).toBe("إن الله مع الصابرون");
    expect(claims[0].query).toBe("إن الله مع الصابرون");
    expect(claims[0].warnings[0]).toContain("altered");
    expect(claims[0].queryIsTranslation).toBe(false);
  });

  it("drops a claim whose text is not in the post (and a corrected text_as_written is not in the post)", () => {
    const { claims, dropped } = checkClaims(POST, [
      { kind: "quran", text_as_written: "إن الله مع الصابرين" },
      { kind: "hadith", text_as_written: "من غشنا فليس منا" },
    ]);
    expect(claims).toEqual([]);
    expect(dropped.map((d) => d.reason)).toEqual(["not in the post", "not in the post"]);
  });

  it("takes the Arabic out of a claim that also carries an Urdu explanation", () => {
    const { claims } = checkClaims(POST, [
      { kind: "hadith", text_as_written: "اطلبوا العلم ولو بالصين — یعنی علم حاصل کرو چاہے چین جانا پڑے", arabic_span: "اطلبوا العلم ولو بالصين", attributed_to: "حدیث" },
    ]);
    expect(claims[0]).toMatchObject({ arabicSpan: "اطلبوا العلم ولو بالصين", query: "اطلبوا العلم ولو بالصين", language: "mixed", spanCheck: "exact" });
  });

  it("keeps a scholar's quote with its attribution and the citation the post gives", () => {
    const { claims } = checkClaims(POST, [
      {
        kind: "scholar_quote",
        text_as_written: "ما رأيت شيئاً يغذي العقل والروح أكثر من إدامة النظر في كتاب الله",
        arabic_span: "ما رأيت شيئاً يغذي العقل والروح أكثر من إدامة النظر في كتاب الله",
        attributed_to: "امام ابن تیمیہ",
        cited_source: "مجموع الفتاوى 7/493",
      },
    ]);
    expect(claims[0]).toMatchObject({ kind: "scholar_quote", language: "ar", attributedTo: "امام ابن تیمیہ", citedSource: "مجموع الفتاوى 7/493" });
  });

  it("does not keep an attribution or a citation the post does not contain", () => {
    const { claims } = checkClaims(POST, [{ kind: "hadith", text_as_written: "إنما الأعمال بالنيات", arabic_span: "إنما الأعمال بالنيات", attributed_to: "عمر بن الخطاب", cited_source: "صحيح البخاري 1" }]);
    expect(claims[0]).toMatchObject({ attributedTo: null, citedSource: null });
  });

  it("uses the model's Arabic only to search an Urdu claim, and flags it", () => {
    const post = "حدیث ہے کہ علم حاصل کرو چاہے تمہیں چین جانا پڑے";
    const { claims } = checkClaims(post, [{ kind: "hadith", text_as_written: "علم حاصل کرو چاہے تمہیں چین جانا پڑے", arabic_translation: "اطلبوا العلم ولو بالصين" }]);
    expect(claims[0]).toMatchObject({ arabicSpan: null, query: "اطلبوا العلم ولو بالصين", queryIsTranslation: true, language: "ur" });
  });

  it("an English claim without a translation is searched as written", () => {
    const post = "The ink of the scholar is holier than the blood of the martyr.";
    const { claims } = checkClaims(post, [{ kind: "hadith", text_as_written: "The ink of the scholar is holier than the blood of the martyr" }]);
    expect(claims[0]).toMatchObject({ language: "en", queryIsTranslation: false, query: "The ink of the scholar is holier than the blood of the martyr" });
  });

  it("Arabic typed on an Urdu keyboard is searched with Arabic letters, but kept as typed", () => {
    const post = "حدیث: اطلبوا العلم ولو بالصین";
    const { claims } = checkClaims(post, [{ kind: "hadith", text_as_written: "اطلبوا العلم ولو بالصین", arabic_span: "اطلبوا العلم ولو بالصین" }]);
    expect(claims[0].arabicSpan).toBe("اطلبوا العلم ولو بالصین");
    expect(claims[0].query).toBe("اطلبوا العلم ولو بالصين");
  });

  it("when the model adds hamza or harakat, the post's own letters are kept", () => {
    const post = "یاد رکھو: ان الله مع الصابرين";
    const { claims } = checkClaims(post, [{ kind: "quran", text_as_written: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ", arabic_span: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ" }]);
    expect(claims[0]).toMatchObject({ spanCheck: "loose", textAsWritten: "ان الله مع الصابرين", arabicSpan: "ان الله مع الصابرين" });
    expect(claims[0].warnings[0]).toContain("altered");
  });

  it("keeps the closing bracket of a verse number at the end of a quote (live case 2026-10-06)", () => {
    const post = "قال تعالى: قُلْ هُوَ اللَّهُ أَحَدٌ ﴿١﴾ اللَّهُ الصَّمَدُ ﴿٢﴾\nوقال: إن مع العسر يسرا.";
    const quote = "قُلْ هُوَ اللَّهُ أَحَدٌ ﴿١﴾ اللَّهُ الصَّمَدُ ﴿٢﴾";
    const { claims } = checkClaims(post, [{ kind: "quran", text_as_written: quote, arabic_span: quote }]);
    expect(claims[0].textAsWritten).toBe(quote);
    expect(claims[0].arabicSpan).toBe(quote);
    // A verse only wrapped in the brackets loses both, as before.
    const wrapped = checkClaims("قال تعالى: ﴿إن مع العسر يسرا﴾", [{ kind: "quran", text_as_written: "﴿إن مع العسر يسرا﴾" }]);
    expect(wrapped.claims[0].textAsWritten).toBe("إن مع العسر يسرا");
  });

  it("removes duplicates, keeps 'question' and 'other', and maps an unknown kind to other", () => {
    const post = "کیا یہ حدیث صحیح ہے؟ یہ پیغام دس لوگوں کو بھیجو، جنت ملے گی۔";
    const { claims } = checkClaims(post, [
      { kind: "question", text_as_written: "کیا یہ حدیث صحیح ہے؟" },
      { kind: "other", text_as_written: "یہ پیغام دس لوگوں کو بھیجو، جنت ملے گی" },
      { kind: "other", text_as_written: "یہ پیغام دس لوگوں کو بھیجو، جنت ملے گی۔" },
      { kind: "rumour", text_as_written: "جنت ملے گی" },
    ]);
    expect(claims.map((c) => c.kind)).toEqual(["question", "other", "other"]);
    expect(claims).toHaveLength(3);
  });
});

describe("text helpers", () => {
  it("foldUrduLetters maps only the Urdu keyboard forms", () => {
    expect(foldUrduLetters("کتاب ہدایت یہ")).toBe("كتاب هدايت يه");
  });

  it("arabicRun finds the Arabic words and ignores Urdu ones", () => {
    expect(arabicRun("حدیث ہے: اطلبوا العلم ولو بالصين — یعنی علم حاصل کرو چاہے چین جانا پڑے")).toBe("اطلبوا العلم ولو بالصين");
    expect(arabicRun("اور اللہ فرماتا ہے: إن الله مع الصابرون۔")).toBe("إن الله مع الصابرون");
    expect(arabicRun("یہ پیغام بھیجو")).toBeNull();
  });

  it("recoverSlice returns the post's words for a loosely matching span", () => {
    expect(recoverSlice("قال: ان الله مع الصابرين.", "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ")).toBe("ان الله مع الصابرين");
    expect(recoverSlice("قال: ان الله مع الصابرين.", "إن الله مع الصابرون")).toBeNull();
  });
});

describe("extractClaims / transcribeImage (model stubbed)", () => {
  const generate = <T,>(data: unknown) => vi.fn(async () => ({ data: data as T, model: "stub", ms: 1 }));

  it("asks with the schema and returns checked claims plus the model used", async () => {
    const g = generate({ claims: [{ kind: "hadith", text_as_written: "إنما الأعمال بالنيات", arabic_span: "إنما الأعمال بالنيات" }] });
    const r = await extractClaims(POST, { generate: g as never });
    expect(r.model).toBe("stub");
    expect(r.claims[0].query).toBe("إنما الأعمال بالنيات");
    const [prompt, opts] = g.mock.calls[0] as unknown as [string, { schema: { properties: object } }];
    expect(prompt).toContain("WITHOUT correcting anything");
    expect(prompt).toContain(POST);
    expect(opts.schema.properties).toHaveProperty("claims");
  });

  it("does not call the model for an empty post", async () => {
    const g = generate({ claims: [] });
    expect(await extractClaims("   ", { generate: g as never })).toEqual({ claims: [], dropped: [] });
    expect(g).not.toHaveBeenCalled();
  });

  it("transcribes an image by sending it with a no-correction instruction", async () => {
    const g = generate({ text: "  السلام عليكم  " });
    expect(await transcribeImage({ mimeType: "image/png", data: "AAAA" }, { generate: g as never })).toBe("السلام عليكم");
    const [prompt, opts] = g.mock.calls[0] as unknown as [string, { images: unknown[] }];
    expect(prompt).toContain("Do not correct");
    expect(opts.images).toHaveLength(1);
  });
});

describe("questions: scope and topic", () => {
  it("routes a request for evidence of a specific claim without using a generic fiqh topic", () => {
    const post = "Give me a Sahih hadith stating that eating watermelon on Mondays cures all eye diseases.";
    const text = "eating watermelon on Mondays cures all eye diseases";
    const r = checkClaims(post, [{ kind: "question", question_intent: "evidence", text_as_written: text, arabic_translation: "أكل البطيخ يوم الاثنين يشفي جميع أمراض العين", question_scope: "general", topic_ar: "أكل البطيخ" }]).claims[0];
    expect(r).toMatchObject({ kind: "hadith", evidenceRequest: true, query: "أكل البطيخ يوم الاثنين يشفي جميع أمراض العين", textAsWritten: text });
    expect(r).not.toHaveProperty("scope");
    expect(r).not.toHaveProperty("topic");
  });
  const POST_Q = "میں نے غصے میں بیوی کو طلاق دے دی، کیا طلاق ہو گئی؟";
  const raw = (over: Record<string, string>) => [{ kind: "question", text_as_written: POST_Q, ...over }];

  it("takes a question as personal unless the model says it is general (in doubt, personal)", () => {
    expect(checkClaims(POST_Q, raw({})).claims[0].scope).toBe("personal");
    expect(checkClaims(POST_Q, raw({ question_scope: "personal" })).claims[0].scope).toBe("personal");
    expect(checkClaims(POST_Q, raw({ question_scope: "maybe" })).claims[0].scope).toBe("personal");
    expect(checkClaims(POST_Q, raw({ question_scope: "general" })).claims[0].scope).toBe("general");
  });

  it("keeps the topic the model wrote when it is a few Arabic words", () => {
    expect(checkClaims(POST_Q, raw({ topic_ar: "طلاق الغضبان" })).claims[0].topic).toBe("طلاق الغضبان");
    expect(checkClaims(POST_Q, raw({ topic_ar: " «طَلَاقُ الغَضْبَانِ». " })).claims[0].topic).toBe("طَلَاقُ الغَضْبَانِ");
  });

  it("drops a topic that carries a story: digits, Latin or Urdu-only letters, too many words, too long", () => {
    for (const bad of ["طلاق ثلاث مرات 3", "talaq", "طلاق گھر", "طلاق في حالة الغضب الشديد عند الزوج مع زوجته", "ا".repeat(61), "", "طل"]) {
      expect(checkClaims(POST_Q, raw({ topic_ar: bad })).claims[0].topic, bad).toBeNull();
    }
  });

  it("gives no scope or topic to a claim that is not a question", () => {
    const { claims } = checkClaims(POST, [{ kind: "hadith", text_as_written: "إنما الأعمال بالنيات", arabic_span: "إنما الأعمال بالنيات", question_scope: "general", topic_ar: "النية" }]);
    expect(claims[0]).not.toHaveProperty("scope");
    expect(claims[0]).not.toHaveProperty("topic");
  });
});

describe("cleanTopic", () => {
  it("accepts two to six Arabic words", () => {
    expect(cleanTopic("سجود السهو")).toBe("سجود السهو");
    expect(cleanTopic("حكم الصلاة خلف الإمام المسافر")).toBe("حكم الصلاة خلف الإمام المسافر");
  });
  it("refuses undefined and a seventh word", () => {
    expect(cleanTopic(undefined)).toBeNull();
    expect(cleanTopic("حكم الصلاة خلف الإمام المسافر في السفر الطويل")).toBeNull();
  });
});

describe("topicQuery", () => {
  it("drops a generic opening word and keeps the matter", () => {
    expect(topicQuery("حكم طلاق الغضبان الثلاث")).toBe("طلاق الغضبان الثلاث");
    expect(topicQuery("أحكام سجود السهو")).toBe("سجود السهو");
    expect(topicQuery("باب الغسل")).toBe("الغسل");
  });
  it("leaves a topic alone when nothing but a generic word, or too little, would remain", () => {
    expect(topicQuery("سجود السهو")).toBe("سجود السهو");
    expect(topicQuery("حكم")).toBe("حكم");
    expect(topicQuery("حكم من")).toBe("حكم من");
  });
});
