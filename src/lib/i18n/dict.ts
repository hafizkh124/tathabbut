// Every word the user sees, in three languages. The Arabic text of the Quran and hadith is never translated here: it is shown as it is.
// Rule: say what the user needs in plain words; never explain how the system works.
export type Locale = "ar" | "en" | "ur";
export const LOCALES: Locale[] = ["ar", "en", "ur"];
export const DEFAULT_LOCALE: Locale = "ar";
export const DIR: Record<Locale, "rtl" | "ltr"> = { ar: "rtl", en: "ltr", ur: "rtl" };

type Entry = { ar: string; en: string; ur: string };

export const DICT = {
  "notice": {
    ar: "ذكاء اصطناعي ينقل من مصادر إسلامية معتبرة",
    en: "AI that quotes from reliable Islamic sources",
    ur: "ذکاء اصطناعی جو معتبر اسلامی مصادر سے نقل کرتی ہے",
  },
  "lang.label": { ar: "اللغة", en: "Language", ur: "زبان" },

  "home.title": { ar: "ما الذي وصلك؟", en: "What did you receive?", ur: "آپ کو کیا موصول ہوا؟" },
  "home.sub": {
    ar: "ألصق ما وصلك من آية أو حديث أو رسالة، ونتحقق لك منه.",
    en: "Paste the verse, hadith or message you received and we will check it for you.",
    ur: "جو آیت، حدیث یا پیغام آپ کو ملا ہے وہ یہاں ڈالیں، ہم اس کی تصدیق کر دیں گے۔",
  },
  "home.label": { ar: "النص", en: "Text", ur: "متن" },
  "home.placeholder": {
    ar: "ألصق هنا النص الذي تريد التحقق منه…",
    en: "Paste the text you want to check here…",
    ur: "جس متن کی تصدیق کرنی ہے وہ یہاں ڈالیں…",
  },
  "home.hint": { ar: "يمكنك لصق الرسالة كاملة", en: "You can paste the whole message", ur: "پورا پیغام بھی ڈال سکتے ہیں" },
  "home.image": { ar: "صورة", en: "Image", ur: "تصویر" },
  "home.camera": { ar: "كاميرا", en: "Camera", ur: "کیمرہ" },
  "home.drop": { ar: "أفلت الصورة هنا لقراءتها", en: "Drop the picture here", ur: "تصویر یہاں چھوڑیں" },
  "home.imageHint": {
    ar: "اسحب صورة إلى هنا، أو الصقها بـ Ctrl+V",
    en: "Drag a picture here, or paste it with Ctrl+V",
    ur: "تصویر یہاں گھسیٹیں، یا Ctrl+V سے چسپاں کریں",
  },
  "home.voice": { ar: "صوت", en: "Voice", ur: "آواز" },
  "home.soon": { ar: "قريبًا", en: "Soon", ur: "جلد" },
  "home.verify": { ar: "تحقّق", en: "Check", ur: "تصدیق کریں" },
  "home.examples": { ar: "جرّب مثالًا", en: "Try an example", ur: "ایک مثال آزمائیں" },
  "home.history": { ar: "السجل", en: "History", ur: "تاریخ" },
  "example.verse": { ar: "آية فيها خطأ", en: "A verse with a mistake", ur: "آیت میں غلطی" },
  "example.hadith": { ar: "حديث مشهور", en: "A famous hadith", ur: "مشہور حدیث" },
  "example.saying": { ar: "قول متداول", en: "A saying in circulation", ur: "مشہور مقولہ" },
  "example.question": { ar: "سؤال فقهي", en: "A fiqh question", ur: "فقہی سوال" },

  "loading.title": { ar: "جارٍ التحقق من المصادر…", en: "Checking the sources…", ur: "ماخذ کی جانچ ہو رہی ہے…" },
  "step.read": { ar: "قراءة النص", en: "Reading the text", ur: "متن پڑھنا" },
  "step.find": { ar: "تحديد الآيات والأحاديث", en: "Finding the verses and hadiths", ur: "آیات اور احادیث الگ کرنا" },
  "step.match": { ar: "مطابقة النص مع المصادر", en: "Matching with the sources", ur: "ماخذ سے ملانا" },
  "step.fetch": { ar: "جلب النتائج", en: "Getting the results", ur: "نتائج لانا" },

  "result.title": { ar: "نتيجة التحقق", en: "Result", ur: "نتیجۂ تحقیق" },
  "result.count.one": { ar: "نص واحد", en: "1 text", ur: "ایک عبارت" },
  "result.count.two": { ar: "نصّان", en: "2 texts", ur: "دو عبارتیں" },
  "result.count.many": { ar: "{n} نصوص", en: "{n} texts", ur: "{n} عبارتیں" },
  "result.of": { ar: "{i} من {n}", en: "{i} of {n}", ur: "{i} از {n}" },
  "result.tap": { ar: "اضغط على النص الملوّن لعرض التفاصيل", en: "Tap a coloured text to see the details", ur: "تفصیل کے لیے رنگین عبارت پر ٹیپ کریں" },
  "result.unplaced": { ar: "نتائج أخرى في الرسالة", en: "Other results in the message", ur: "پیغام کے دیگر نتائج" },
  "result.new": { ar: "تحقّق من نص آخر", en: "Check another text", ur: "کوئی اور متن جانچیں" },
  "result.yourText": { ar: "نصّك", en: "Your text", ur: "آپ کا متن" },

  "label.source": { ar: "المصدر", en: "Source", ur: "ماخذ" },
  "label.via": { ar: "عبر", en: "Via", ur: "بواسطہ" },
  "label.scholar": { ar: "المحدّث", en: "Scholar", ur: "محدث" },
  "label.words": { ar: "قوله", en: "His words", ur: "ان کا قول" },
  "label.dorarGrade": { ar: "حكم أضافته الدرر السنية", en: "Grading added by Dorar al-Saniyya", ur: "الدرر السنیہ کا درج کردہ حکم" },
  "verse.contextWarning": { ar: "اقتُطع سياق الآية؛ اقرأ العبارة في سياقها الكامل أدناه.", en: "The verse's context was omitted. Read the full relevant wording below.", ur: "آیت کا سیاق حذف ہوا ہے؛ ذیل میں مکمل متعلقہ عبارت پڑھیں۔" },
  "label.narrator": { ar: "الراوي", en: "Narrator", ur: "راوی" },
  "label.text": { ar: "النص", en: "Text", ur: "متن" },
  "label.attributed": { ar: "نُسب إلى", en: "Attributed to", ur: "منسوب کیا گیا" },
  "label.correct": { ar: "الصواب", en: "The correct form", ur: "درست صورت" },
  "label.note": { ar: "ملاحظة", en: "Note", ur: "نوٹ" },
  "label.mushaf": { ar: "نص مصحف حفص", en: "Hafs mushaf text", ur: "مصحفِ حفص کا متن" },
  "label.matchedArabic": { ar: "النص العربي الموافق لهذه العبارة المترجمة", en: "Arabic text matched to this translated wording", ur: "اس ترجمہ شدہ عبارت سے ملنے والا عربی متن" },
  "note.translationMatch": { ar: "المطابقة مع النص العربي؛ لا يُحكم بها على دقة ألفاظ الترجمة.", en: "The match is to the Arabic text; it does not verify the translation word for word.", ur: "یہ مطابقت عربی متن سے ہے؛ اس سے ترجمے کے ہر لفظ کی تصدیق مراد نہیں۔" },
  "note.halikIsnad": { ar: "هذا الحكم بالضعف الشديد يخص هذا الإسناد.", en: "This severe-weakness verdict applies to this chain of transmission.", ur: "شدید ضعف کا یہ حکم اسی سند کے بارے میں ہے۔" },
  "note.narratorCriticism": { ar: "هذا جرح لراوٍ في هذا الإسناد؛ لا يُفهم منه وحده حكم نهائي على جميع طرق الحديث.", en: "This criticizes a narrator in this chain; it alone is not a final verdict on every route of the narration.", ur: "یہ اس سند کے راوی کی جرح ہے؛ اسے تنہا روایت کی تمام سندوں کا حتمی حکم نہ سمجھیں۔" },
  "label.narrationText": { ar: "نص الرواية في المصدر", en: "Narration text in the source", ur: "ماخذ میں روایت کا متن" },
  "note.additionalWording": { ar: "في هذه الرواية ألفاظ إضافية؛ اقرأ حكمها منسوبًا إلى هذا النص أو إسناده.", en: "This narration has additional wording; read its verdict as applying to this text or its chain.", ur: "اس روایت میں اضافی الفاظ ہیں؛ اس کا حکم اسی متن یا اس کی سند کے حوالے سے پڑھیں۔" },
  "note.differentWording": { ar: "ألفاظ هذه الرواية تختلف عن العبارة المدخلة؛ اقرأ حكمها مع نصها وإسنادها.", en: "This narration differs from the supplied wording; read its verdict together with its text and chain.", ur: "اس روایت کے الفاظ فراہم کردہ عبارت سے مختلف ہیں؛ اس کا حکم اس کے متن اور سند کے ساتھ پڑھیں۔" },
  "note.variantSummary": { ar: "تتضمن النتائج روايات بألفاظ إضافية أو مختلفة وأحكامها؛ لا تجعل حكم نص منها حكمًا على كل صيغة.", en: "Results include narrations with additional or different wording and their verdicts; do not treat one text's verdict as applying to every wording.", ur: "نتائج میں اضافی یا مختلف الفاظ والی روایتیں اور ان کے احکام بھی ہیں؛ ایک متن کا حکم ہر لفظی صورت کا حکم نہ سمجھیں۔" },
  "label.pages": { ar: "ج {v}، ص {p}", en: "vol. {v}, p. {p}", ur: "ج {v}، ص {p}" },
  "verse.ref": { ar: "سورة {s}، الآية {a}", en: "Surah {s}, verse {a}", ur: "سورہ {s}، آیت {a}" },
  "narrations.more": { ar: "نتائج أخرى ({n})", en: "Other results ({n})", ur: "دیگر نتائج ({n})" },
  "narrations.weakVariants": { ar: "طرق وأسانيد ضعيفة ({n})", en: "Weak chains ({n})", ur: "دیگر ضعیف اسناد ({n})" },
  "fatwa.warn": {
    ar: "تنبيه قبل العمل: هذه معلومات علمية عامة فقط. والحكم في واقعة بعينها يرجع فيه إلى دار الإفتاء أو مفتٍ مؤهل، لأن الحكم يتعلق بالتفاصيل الكاملة للواقعة.",
    en: "Before you act: this is general scholarly information only. A ruling on a particular case belongs to a Dar al-Ifta or a qualified mufti, because a ruling depends on the full details of the case.",
    ur: "تنبیہ برائے عملی فتویٰ: یہ معلومات صرف عمومی علمی فہم کے لیے ہیں۔ کسی بھی انفرادی واقعے کے حتمی فیصلے کے لیے دار الافتاء یا مستند مفتیانِ کرام سے ذاتی رجوع لازم ہے، کیونکہ حکم کا تعلق واقعے کی مکمل تفصیل سے ہوتا ہے۔",
  },
  "fiqh.topic": { ar: "الموضوع الذي بحثنا فيه: {topic}", en: "Topic searched: {topic}", ur: "جس موضوع پر تلاش کی گئی: {topic}" },
  "fiqh.refer": {
    ar: "راجع دار الإفتاء أو المفتي الذي تثق به.",
    en: "Please consult the Dar al-Ifta or the mufti you trust.",
    ur: "اپنے معتمد دار الافتاء یا مفتی سے رجوع کریں۔",
  },
  "fiqh.title": { ar: "من كتب الفقه والفتاوى", en: "From the books of fiqh and fatwa", ur: "کتبِ فقہ و فتاویٰ سے" },
  "fiqh.note": {
    ar: "هذه نصوص من كتب الفقه والفتاوى كما وردت، دون ترجيح بين الأقوال.",
    en: "These are passages from books of fiqh and fatwa as written, without preferring any view.",
    ur: "یہ فقہ و فتاویٰ کی کتب کے اقتباسات ہیں جیسے لکھے ہیں، اقوال میں کسی کو ترجیح نہیں دی گئی۔",
  },
  "translate.label": { ar: "ترجمة آلية", en: "Machine translation — check it against the Arabic", ur: "مشینی ترجمہ — اصل عربی سے ملا کر دیکھیں" },
  "translate.loading": { ar: "جارٍ الترجمة…", en: "Translating…", ur: "ترجمہ ہو رہا ہے…" },
  "turath.title": { ar: "من كتب التراث", en: "From the books (Turath)", ur: "کتبِ تراث سے" },
  "turath.loading": { ar: "جارٍ البحث في الكتب…", en: "Searching the books…", ur: "کتابوں میں تلاش جاری ہے…" },
  "turath.unavailable": {
    ar: "تعذّر البحث في كتب التراث الآن، ونتيجة التحقق أعلاه لم تتغيّر.",
    en: "The books could not be searched now. The result above is unchanged.",
    ur: "ابھی کتابوں میں تلاش نہیں ہو سکی۔ اوپر کا نتیجہ جوں کا توں ہے۔",
  },
  "turath.partial": {
    ar: "تعذّر البحث في بعض أنواع الكتب؛ فقد توجد نتائج أخرى.",
    en: "Some kinds of books could not be searched, so more passages may exist.",
    ur: "کتابوں کی بعض اقسام میں تلاش نہ ہو سکی، اس لیے مزید نتائج ہو سکتے ہیں۔",
  },
  "turath.page": { ar: "صفحة تراث {p}", en: "Turath page {p}", ur: "صفحۂ تراث {p}" },
  "turath.volume": { ar: "ج {v}", en: "vol. {v}", ur: "ج {v}" },
  "turath.printedPage": { ar: "ص {p}", en: "p. {p}", ur: "ص {p}" },
  "turath.expand": { ar: "عرض النص كاملًا", en: "Show the full passage", ur: "پورا اقتباس دیکھیں" },
  "turath.cat.14": { ar: "الفقه الحنفي", en: "Hanafi fiqh", ur: "فقہ حنفی" },
  "turath.cat.15": { ar: "الفقه المالكي", en: "Maliki fiqh", ur: "فقہ مالکی" },
  "turath.cat.16": { ar: "الفقه الشافعي", en: "Shafi'i fiqh", ur: "فقہ شافعی" },
  "turath.cat.17": { ar: "الفقه الحنبلي", en: "Hanbali fiqh", ur: "فقہ حنبلی" },
  "turath.cat.22": { ar: "الفتاوى", en: "Fatwa collections", ur: "کتبِ فتاویٰ" },
  "turath.cat.6": { ar: "كتب السنة", en: "Hadith collections", ur: "کتبِ حدیث" },
  "turath.cat.23": { ar: "الرقائق والآداب", en: "Spiritual and ethical works", ur: "رقائق و آداب" },
  "turath.cat.25": { ar: "التاريخ", en: "History", ur: "تاریخ" },
  "turath.cat.26": { ar: "التراجم والطبقات", en: "Biographies", ur: "تراجم و طبقات" },
  "via.turath": { ar: "التراث", en: "Turath", ur: "تراث" },
  "narrations.fewer": { ar: "إخفاء", en: "Hide", ur: "چھپائیں" },
  "diff.replaced": { ar: "كُتب «{typed}» والصواب «{correct}»", en: "Written “{typed}”, should be “{correct}”", ur: "«{typed}» لکھا ہے، درست «{correct}» ہے" },
  "diff.missing": { ar: "سقطت كلمة «{correct}»", en: "Missing the word “{correct}”", ur: "لفظ «{correct}» رہ گیا ہے" },
  "diff.added": { ar: "كلمة زائدة «{typed}»", en: "Extra word “{typed}”", ur: "اضافی لفظ «{typed}»" },
  "empty.body": { ar: "لم نجد في هذا النص آية أو حديثًا نتحقق منه.", en: "We found no verse or hadith to check in this text.", ur: "اس متن میں تصدیق کے لیے کوئی آیت یا حدیث نہیں ملی۔" },
  "note.disputed": { ar: "اختلفت أقوال المحدّثين في هذا النص", en: "Scholars differ on this text", ur: "اس متن پر محدثین کے اقوال مختلف ہیں" },
  "note.caution": { ar: "في كلام المحدّث تقييد، فاقرأه كاملًا", en: "The scholar's wording is qualified; read it in full", ur: "محدث کے الفاظ میں قید ہے، انہیں پورا پڑھیں" },
  "diff.title": { ar: "الفرق عن النص الصحيح", en: "Difference from the correct text", ur: "درست متن سے فرق" },

  "via.dorar": { ar: "الدرر السنية", en: "Dorar al-Saniyyah", ur: "الدرر السنیہ" },
  "via.shamela": { ar: "المكتبة الشاملة", en: "Shamela Library", ur: "المکتبۃ الشاملہ" },
  "via.quranCom": { ar: "القرآن الكريم", en: "Quran.com", ur: "Quran.com" },
  "via.quranpedia": { ar: "موسوعة القرآن", en: "Quranpedia", ur: "Quranpedia" },
  "via.exact": { ar: "يفتح الدرر السنية على هذا الحديث في كتابه", en: "Opens Dorar at this hadith, in its own book", ur: "الدرر السنیہ میں اسی کتاب میں یہی حدیث کھولتا ہے" },
  "via.opens": { ar: "يفتح البحث عن هذا النص في الموقع", en: "Opens a search for this text on the site", ur: "اس سائٹ پر یہی متن تلاش کرتا ہے" },

  "action.copy": { ar: "نسخ", en: "Copy", ur: "کاپی" },
  "action.copied": { ar: "تم النسخ", en: "Copied", ur: "کاپی ہو گیا" },
  "action.share": { ar: "مشاركة", en: "Share", ur: "شیئر" },
  "action.report": { ar: "هل في هذه النتيجة خطأ؟ أبلغ عنه", en: "Is this result wrong? Report it", ur: "کیا یہ نتیجہ غلط ہے؟ اطلاع دیں" },
  "action.reported": { ar: "شكرًا، وصل بلاغك", en: "Thank you, your report was received", ur: "شکریہ، آپ کی اطلاع مل گئی" },
  "action.origin": { ar: "من أين انتشر؟", en: "Where did it spread from?", ur: "یہ کہاں سے پھیلا؟" },
  "action.close": { ar: "إغلاق", en: "Close", ur: "بند کریں" },
  "action.edit": { ar: "تعديل النص", en: "Edit the text", ur: "متن میں تبدیلی" },
  "action.editRetry": { ar: "تعديل النص وإعادة المحاولة", en: "Edit the text and try again", ur: "متن بدل کر دوبارہ کوشش کریں" },
  "action.copyText": { ar: "نسخ النص", en: "Copy the text", ur: "متن کاپی کریں" },
  "action.retry": { ar: "إعادة المحاولة", en: "Try again", ur: "دوبارہ کوشش کریں" },

  "notfound.body": {
    ar: "لم نجد هذا النص في المصادر المعتبرة التي نعتمد عليها.",
    en: "We could not find this text in the reliable sources we use.",
    ur: "یہ متن ہمارے معتبر ماخذ میں نہیں ملا۔",
  },
  "notfound.hint": {
    ar: "لا نخمّن النتيجة. إن كنت تقصد نصًّا آخر فعدّل الصياغة، وإلا فراجع أهل العلم.",
    en: "We do not guess the result. If you meant another text, change the wording; otherwise ask a scholar.",
    ur: "ہم اندازے سے نتیجہ نہیں دیتے۔ کوئی اور متن مراد ہو تو الفاظ بدلیں، ورنہ اہلِ علم سے رجوع کریں۔",
  },
  "note.scholar": {
    ar: "القول منسوب إلى عالم. هذه نتائج الدرر السنية في هذا النص كما وردت، فاقرأ كلام المحدّث كاملًا.",
    en: "This is a saying attributed to a scholar. These are Dorar's results for the text, as given; read the scholar's words in full.",
    ur: "یہ کسی عالم سے منسوب قول ہے۔ یہ الدرر کے نتائج جوں کے توں ہیں؛ محدث کے الفاظ پورے پڑھیں۔",
  },
  "label.cited": { ar: "ذُكر في الرسالة", en: "Named in the message", ur: "پیغام میں مذکور" },
  "fatwa.body": {
    ar: "هذا سؤال عن حكم أو حالة شخصية، والجواب فيه لأهل العلم.",
    en: "This is a question about a ruling or a personal case, and the answer belongs to the scholars.",
    ur: "یہ کسی حکم یا ذاتی صورتِ حال کا سوال ہے، اس کا جواب اہلِ علم دیں گے۔",
  },
  "translated.body": {
    ar: "النص مترجم، فنعرض الآية للمقارنة ولا نحكم على لفظه.",
    en: "The text is a translation, so we show the verse for comparison and do not judge its wording.",
    ur: "متن ترجمہ ہے، اس لیے ہم آیت موازنے کے لیے دکھاتے ہیں اور الفاظ پر فیصلہ نہیں دیتے۔",
  },

  "error.title": { ar: "تعذّر إكمال التحقق", en: "We could not finish the check", ur: "تصدیق مکمل نہ ہو سکی" },
  "error.network": {
    ar: "تحقّق من اتصالك بالإنترنت ثم أعد المحاولة. نصّك محفوظ ولم يضِع.",
    en: "Check your internet connection and try again. Your text is saved.",
    ur: "انٹرنیٹ دیکھیں اور دوبارہ کوشش کریں۔ آپ کا متن محفوظ ہے۔",
  },
  "error.tooLong": {
    ar: "النص أطول مما نستطيع قراءته مرة واحدة. جرّب جزءًا أقصر.",
    en: "The text is longer than we can read at once. Try a shorter part.",
    ur: "متن ایک بار میں پڑھنے سے لمبا ہے۔ کوئی چھوٹا حصہ آزمائیں۔",
  },
  "error.read": {
    ar: "لم نستطع قراءة هذا النص الآن. أعد المحاولة بعد قليل.",
    en: "We could not read this text just now. Please try again in a moment.",
    ur: "ابھی یہ متن پڑھا نہ جا سکا۔ تھوڑی دیر بعد دوبارہ کوشش کریں۔",
  },

  "candidates.title": { ar: "هل تقصد؟", en: "Which one do you mean?", ur: "آپ کی مراد کون سی ہے؟" },
  "candidates.hint": {
    ar: "هذه العبارة في أكثر من موضع. اختر ما تقصده.",
    en: "This wording is in more than one place. Choose the one you mean.",
    ur: "یہ عبارت ایک سے زیادہ جگہ ہے۔ جو مراد ہے وہ چنیں۔",
  },
  "ocr.title": { ar: "هل هذا هو النص؟", en: "Is this the text?", ur: "کیا یہ وہی متن ہے؟" },
  "ocr.sub": {
    ar: "قرأنا النص من الصورة. قارنه بالصورة وصحّح أي خطأ قبل المتابعة.",
    en: "We read this from the picture. Compare it with the picture and fix any mistake before continuing.",
    ur: "ہم نے تصویر سے یہ متن پڑھا ہے۔ تصویر سے ملا لیں اور غلطی ہو تو ٹھیک کریں۔",
  },
  "ocr.label": { ar: "النص المقروء", en: "The text we read", ur: "پڑھا گیا متن" },
  "ocr.uncertain": { ar: "كلمة غير مؤكدة", en: "Not sure about this word", ur: "اس لفظ پر یقین نہیں" },
  "ocr.confirm": { ar: "تأكيد ومتابعة", en: "Confirm and continue", ur: "تصدیق کر کے آگے بڑھیں" },
  "ocr.reading": { ar: "جارٍ قراءة الصورة…", en: "Reading the picture…", ur: "تصویر پڑھی جا رہی ہے…" },
  "ocr.picture": { ar: "الصورة", en: "The picture", ur: "تصویر" },
  "ocr.privacy": {
    ar: "تُرسل الصورة إلى Google Gemini لقراءتها ولا نحتفظ بها.",
    en: "The picture is sent to Google Gemini to be read. We do not keep it.",
    ur: "تصویر پڑھنے کے لیے Google Gemini کو بھیجی جاتی ہے۔ ہم اسے محفوظ نہیں رکھتے۔",
  },
  "action.done": { ar: "تم", en: "Done", ur: "ہو گیا" },
  "action.back": { ar: "رجوع", en: "Back", ur: "واپس" },
  "error.ocr": {
    ar: "لم نستطع قراءة الصورة. جرّب صورة أوضح أو الصق النص.",
    en: "We could not read the picture. Try a clearer one or paste the text.",
    ur: "تصویر پڑھی نہ جا سکی۔ زیادہ واضح تصویر آزمائیں یا متن چسپاں کریں۔",
  },
  "error.noText": { ar: "لم نجد نصًّا في هذه الصورة.", en: "We found no text in this picture.", ur: "اس تصویر میں کوئی متن نہیں ملا۔" },
  "error.badImage": {
    ar: "هذا النوع من الصور غير مدعوم. استخدم JPG أو PNG.",
    en: "This kind of picture is not supported. Use JPG or PNG.",
    ur: "اس قسم کی تصویر قابلِ قبول نہیں۔ JPG یا PNG استعمال کریں۔",
  },
  "origin.title": { ar: "من أين انتشر؟", en: "Where did it spread from?", ur: "یہ کہاں سے پھیلا؟" },
  "origin.loading": { ar: "نبحث في الأرشيف العام…", en: "Searching public archives…", ur: "عوامی آرکائیوز میں تلاش جاری ہے…" },
  "origin.earliest": { ar: "أقدم ظهور علني", en: "Earliest public record", ur: "سب سے پرانا عوامی ریکارڈ" },
  "origin.platform": { ar: "أول ظهور في", en: "First seen on", ur: "پہلی بار کہاں ملا" },
  "origin.spread": { ar: "كيف انتشر", en: "How it spread", ur: "کیسے پھیلا" },
  "origin.summary": { ar: "الخلاصة", en: "Summary", ur: "خلاصہ" },
  "origin.links": { ar: "روابط ذات صلة", en: "Related links", ur: "متعلقہ روابط" },
  "origin.unknown": { ar: "غير معروف", en: "Unknown", ur: "نامعلوم" },
  "origin.failed": { ar: "تعذّر البحث الآن. أعد المحاولة بعد قليل.", en: "The search failed. Please try again in a moment.", ur: "تلاش مکمل نہ ہو سکی۔ تھوڑی دیر بعد دوبارہ کوشش کریں۔" },
} satisfies Record<string, Entry>;

export type Key = keyof typeof DICT;

type Pair = { short: string; long: string };
/** Labels of a state, keyed by the state's Arabic wording (the backend's own words). */
const STATE_LABELS: Record<string, Record<Locale, Pair>> = {
  "مقبول": {
    ar: { short: "مقبول", long: "مقبول (صحيح أو حسن)" },
    en: { short: "Accepted", long: "Accepted (sound or good)" },
    ur: { short: "مقبول", long: "مقبول (صحیح یا حسن)" },
  },
  "ضعيف": { ar: p("ضعيف"), en: p("Weak"), ur: p("ضعیف") },
  "شديد الضعف أو لا أصل له": { ar: p("شديد الضعف أو لا أصل له"), en: p("Very weak or baseless"), ur: p("شدید ضعیف یا بے اصل") },
  "غير حاسم": { ar: p("غير حاسم"), en: p("Inconclusive"), ur: p("غیر حاسم") },
  "آية صحيحة النقل": { ar: p("آية صحيحة النقل"), en: p("Verse quoted correctly"), ur: p("آیت درست نقل ہوئی") },
  "آية منقولة بخطأ": { ar: p("آية منقولة بخطأ"), en: p("Verse misquoted"), ur: p("آیت غلط نقل ہوئی") },
  "آية اقتطع سياقها": { ar: p("اقتُطع سياق الآية"), en: p("Verse context omitted"), ur: p("آیت کا سیاق حذف ہوا ہے") },
  "آية (نص مترجم)": { ar: p("آية (نص مترجم)"), en: p("Verse (translated text)"), ur: p("آیت (ترجمہ شدہ متن)") },
  "لم يُعثر عليه — إحالة": {
    ar: p("لم يُعثر عليه — إحالة"),
    en: p("Not found — refer to a scholar"),
    ur: p("اس عبارت کا معتبر حوالہ نہیں ملا — اہلِ علم سے رجوع کریں"),
  },
  "فتوى أو حالة شخصية — إحالة": {
    ar: p("فتوى أو حالة شخصية — إحالة"),
    en: p("A fatwa or personal matter — refer to a scholar"),
    ur: p("فتویٰ یا ذاتی معاملہ — اہلِ علم سے رجوع کریں"),
  },
  "موجود في كتب التراث": { ar: p("موجود"), en: p("Found"), ur: p("موجود") },
  "مسألة فقهية": { ar: p("مسألة فقهية"), en: p("Fiqh question"), ur: p("فقہی مسئلہ") },
  "قول منسوب خطأً إلى النبي ﷺ": {
    ar: p("قول منسوب خطأً إلى النبي ﷺ"),
    en: p("Wrongly attributed to the Prophet ﷺ"),
    ur: p("نبی صلی اللہ علیہ وسلم کی طرف غلط منسوب قول"),
  },
  "لفظ أو ترجمة غير دقيقة": { ar: p("لفظ أو ترجمة غير دقيقة"), en: p("Inexact wording or translation"), ur: p("لفظ یا ترجمہ غیر درست") },
  "قول منسوب خطأً إلى عالم": { ar: p("قول منسوب خطأً إلى عالم"), en: p("Wrongly attributed to a scholar"), ur: p("عالم کی طرف غلط منسوب قول") },
};

function p(label: string): Pair {
  return { short: label, long: label };
}

/** A state's label in the user's language; a wording we do not know is shown as the backend wrote it. */
export function stateLabel(state: string, locale: Locale, long = false): string {
  const e = STATE_LABELS[state.trim()]?.[locale];
  return e ? (long ? e.long : e.short) : state;
}

export function translate(locale: Locale, key: Key, params?: Record<string, string | number>): string {
  const raw: string = DICT[key][locale];
  return params ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : raw;
}

/** «نصّان» / «2 texts» / «ثلاثة»: the count line under the result title. */
export function countLabel(locale: Locale, n: number): string {
  if (n === 1) return translate(locale, "result.count.one");
  if (n === 2) return translate(locale, "result.count.two");
  return translate(locale, "result.count.many", { n });
}

/** Numbers in the user's own digits: Arabic-Indic for Arabic, Eastern Arabic-Indic (Urdu) for Urdu, Latin for English. */
export function digits(locale: Locale, value: number | string): string {
  const s = String(value);
  if (locale === "en") return s;
  const base = locale === "ar" ? 0x0660 : 0x06f0;
  return s.replace(/\d/g, (d) => String.fromCharCode(base + Number(d)));
}
