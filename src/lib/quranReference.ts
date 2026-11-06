// A verse named by its place («البقرة: ٢٥٩», «سورہ الحجرات آیت 49:11», «Surah Al-Kahf 18», «2:255»): read as a
// surah and an ayah, checked against the number of verses of that surah, so the verse can be fetched by its number.
// Pure text work: no names or numbers are guessed, and a reading that does not fit a real verse is no reference.
import { foldUrdu } from "./arabic";

/** The number of verses of each surah, 1 to 114 (the sum is 6236). */
export const AYAH_COUNTS: readonly number[] = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
  60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3,
  6, 3, 5, 4, 5, 6,
];

/** The surahs' names in Arabic script (Urdu spellings fold to the same letters), in mushaf order. */
export const SURAH_NAMES_AR: readonly string[] = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس", "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
  "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم", "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
  "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق", "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة", "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم",
  "الحاقة", "المعارج", "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس", "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد", "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق",
  "القدر", "البينة", "الزلزلة", "العاديات", "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر", "المسد", "الإخلاص", "الفلق", "الناس",
];

/** Other names an Arabic-script text gives a surah (the first word of the surah, the other title). */
const ALIASES_AR: Record<string, number> = { ياسين: 36, رحمان: 55, "بني اسرائيل": 17, براءه: 9, مومن: 40, "حم السجده": 41, ملائكه: 35, لهب: 111, تبارك: 67, الم: 32, سجده: 32 };

/** Latin spellings, one list per surah (lower case, no hyphens or apostrophes; the article is tried with and without). */
const LATIN: readonly string[] = [
  "fatiha|fatihah|fateha", "baqarah|baqara|bakara", "imran|aal imran|ali imran|al imran", "nisa|nisaa|nissa", "maidah|maida|maeda|ma'idah", "anam|anaam", "araf|aaraf", "anfal", "tawbah|tawba|taubah|bara'ah|baraah", "yunus|younus|yonus", "hud|hood", "yusuf|yousuf|yousaf", "rad|raad|ra'd", "ibrahim|ibraheem", "hijr", "nahl", "isra|israa|bani israil|bani israeel", "kahf|kahaf", "maryam|mariam", "taha|ta ha",
  "anbiya|anbiyaa|anbya", "hajj|haj", "muminun|muminoon|mu'minun|mominoon", "nur|noor", "furqan|furqaan", "shuara|shu'ara", "naml", "qasas", "ankabut|ankaboot", "rum|room|rome", "luqman|luqmaan", "sajdah|sajda|as sajdah", "ahzab|ahzaab", "saba|sabaa|sheba", "fatir|faatir", "yasin|yaseen|ya sin", "saffat|saaffaat|safaat", "sad|saad", "zumar", "ghafir|ghaafir|mumin|mu'min",
  "fussilat|fussilat|ha mim sajdah", "shura|shuraa", "zukhruf", "dukhan|dukhaan", "jathiyah|jaathiyah|jathiya", "ahqaf|ahqaaf", "muhammad", "fath", "hujurat|hujuraat", "qaf|qaaf", "dhariyat|zariyat|dhaariyaat", "tur|toor", "najm", "qamar", "rahman|rehman|ar rahman", "waqiah|waqia|waqi'ah", "hadid|hadeed", "mujadilah|mujadila|mujadalah", "hashr", "mumtahanah|mumtahina", "saff|saf", "jumuah|jumah|jumu'ah", "munafiqun|munafiqoon", "taghabun|taghabun", "talaq|talaaq", "tahrim|tahreem", "mulk", "qalam",
  "haqqah|haaqqah", "maarij|ma'arij", "nuh|nooh", "jinn", "muzzammil|muzammil", "muddaththir|muddathir|mudassir", "qiyamah|qiyama|qiyaamah", "insan|insaan|dahr", "mursalat|mursalaat", "naba|nabaa", "naziat|naazi'aat", "abasa", "takwir|takweer", "infitar|infitaar", "mutaffifin|mutaffifeen|tatfif", "inshiqaq|inshiqaaq", "buruj|burooj", "tariq|taariq", "ala|a'la|al ala", "ghashiyah|ghaashiyah", "fajr", "balad", "shams", "layl|lail", "duha|dhuha|zuha", "sharh|inshirah|alam nashrah", "tin|teen", "alaq|iqra", "qadr", "bayyinah|bayyina|bayinah", "zalzalah|zilzal|zilzaal", "adiyat|aadiyat", "qariah|qaari'ah|qaria", "takathur|takasur", "asr", "humazah|humaza", "fil|feel", "quraysh|quraish", "maun|ma'un|maaoon", "kawthar|kausar|kauthar", "kafirun|kafiroon", "nasr", "masad|lahab", "ikhlas|ikhlaas", "falaq", "nas|naas",
];

const stripArticle = (s: string) => s.replace(/^ال(?=.{2,})/, "");
const arabicKey = (s: string) => stripArticle(foldUrdu(s).replace(/\s+/g, ""));
const latinKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const stripLatinArticle = (s: string) => s.replace(/^(?:ash|ath|adh|an|ar|as|at|ad|az|al)(?=[a-z]{3,})/, "");

const BY_ARABIC = new Map<string, number>();
const BY_LATIN = new Map<string, number>();
SURAH_NAMES_AR.forEach((name, i) => {
  // a name already taken keeps its first surah (never replaced by a later alias)
  if (!BY_ARABIC.has(arabicKey(name))) BY_ARABIC.set(arabicKey(name), i + 1);
});
for (const [alias, n] of Object.entries(ALIASES_AR)) if (!BY_ARABIC.has(arabicKey(alias))) BY_ARABIC.set(arabicKey(alias), n);
LATIN.forEach((names, i) => names.split("|").forEach((name) => BY_LATIN.set(latinKey(name), i + 1)));

/** The surah a name stands for (any of the spellings above), or null. `words` are the words of the name, as written. */
export function surahOfName(words: string[]): number | null {
  const joined = words.join(" ");
  if (/[a-z]/i.test(joined)) {
    const k = latinKey(joined);
    return BY_LATIN.get(k) ?? BY_LATIN.get(stripLatinArticle(k)) ?? null;
  }
  return BY_ARABIC.get(arabicKey(joined)) ?? null;
}

export interface QuranReference {
  surah: number;
  /** the first and the last verse (equal for one verse) */
  from: number;
  to: number;
  /** the words of the text that gave the reference, as written */
  matched: string;
}

const MAX_RANGE = 15;
const SURAH_WORD = /^(?:سوره|سورت|سوريه|surah|surat|sura|suratul)$/i;
const AYAH_WORD = /^(?:ال)?(?:ايه|ايت|ايات|ayah|ayat|aya|verse|verses|v|ver)$/i;
const NOISE = /^(?:نمبر|رقم|no|number|num|من|في|of|کي|كي|کا|كا|ka|ki|ke)$/i;
/** A reading that is only digits needs a sign that the text is about the Quran. */
const QURAN_CONTEXT = /(?:سوره|سورت|ايه|ايت|ايات|قران|quran|koran|surah|sura\b|ayah|ayat|verse)/i;

function validRange(surah: number, from: number, to: number): { from: number; to: number } | null {
  const max = AYAH_COUNTS[surah - 1];
  if (!max || from < 1 || from > max) return null;
  const end = Math.min(Math.max(to, from), max, from + MAX_RANGE - 1);
  return { from, to: end };
}

/**
 * The verse (or the few verses) a text names by number, or null. A reading is kept only when the surah exists and the
 * ayah is within it. «2:255» alone counts only when the text speaks of the Quran (or the claim is one); a name with a
 * number counts after «سورة», after a colon, or when the claim is a Quran claim.
 */
export function parseQuranReference(text: string, opts: { kind?: string } = {}): QuranReference | null {
  const t = foldUrdu(text).replace(/[：]/g, ":");
  const context = opts.kind === "quran" || QURAN_CONTEXT.test(t);

  // a name, then (after «آیت» and the like) a number; or a number first, then «from surah X»
  const tokens = [...t.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({ w: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
  const isNumber = (w: string) => /^\d{1,3}$/.test(w);
  for (let i = 0; i < tokens.length; i++) {
    for (const len of [3, 2, 1]) {
      const part = tokens.slice(i, i + len);
      if (part.length < len || part.some((p) => isNumber(p.w))) continue;
      const surah = surahOfName(part.map((p) => p.w));
      if (!surah) continue;
      const nameEnd = part[len - 1].end;
      const prefixed = i > 0 && SURAH_WORD.test(tokens[i - 1].w);
      const short = part.map((p) => p.w).join("").length <= 2;
      // the number after the name
      let j = i + len;
      let sawAyahWord = false;
      while (j < tokens.length && (AYAH_WORD.test(tokens[j].w) || NOISE.test(tokens[j].w)) && j - (i + len) < 4) {
        if (AYAH_WORD.test(tokens[j].w)) sawAyahWord = true;
        j++;
      }
      const num = tokens[j];
      // «17:23» after the name is a surah:ayah of its own (read below), not an ayah of the named surah
      const pairFollows = num && /^\s*:\s*\d/.test(t.slice(num.end));
      if (num && isNumber(num.w) && !pairFollows) {
        const between = t.slice(nameEnd, num.start);
        const colon = /[:،,]/.test(between) || /-/.test(between.slice(0, 3));
        // a bare name next to a number is a Quran reading only with a sign of it (the surah word, an ayah word, a colon, or a Quran claim)
        if (prefixed || sawAyahWord || (context && (colon || opts.kind === "quran")) || (!short && colon && context)) {
          const rangeEnd = t.slice(num.end).match(/^\s*[-–—]\s*(\d{1,3})(?!\d)/);
          const range = validRange(surah, Number(num.w), rangeEnd ? Number(rangeEnd[1]) : Number(num.w));
          if (range) return { surah, ...range, matched: text.slice(Math.max(0, part[0].start - (prefixed ? tokens[i - 1].w.length + 1 : 0)), tokens[j].end) };
        }
      }
      // «آیت 18 سورۃ الکہف»: the number comes first
      if (prefixed || sawAyahWord) {
        for (let k = i - (prefixed ? 2 : 1); k >= Math.max(0, i - 5); k--) {
          if (!isNumber(tokens[k]?.w ?? "")) continue;
          if (k > 0 && AYAH_WORD.test(tokens[k - 1].w)) {
            const range = validRange(surah, Number(tokens[k].w), Number(tokens[k].w));
            if (range) return { surah, ...range, matched: text.slice(tokens[k - 1].start, nameEnd) };
          }
        }
      }
    }
  }

  // digits only: surah:ayah, with a range after it
  if (context) {
    for (const m of t.matchAll(/(?<![\d.:])(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?(?![\d:])/g)) {
      const surah = Number(m[1]);
      if (surah < 1 || surah > 114) continue;
      const range = validRange(surah, Number(m[2]), m[3] ? Number(m[3]) : Number(m[2]));
      if (range) return { surah, ...range, matched: m[0] };
    }
  }
  return null;
}

/** The text with the reference's own words taken out: what is left says whether the text is only a reference. */
export const withoutReference = (text: string, ref: QuranReference): string => text.replace(ref.matched, " ").replace(/[()\[\]{}«»"'،,.:;؛۔\-–—]/g, " ").replace(/\s+/g, " ").trim();
