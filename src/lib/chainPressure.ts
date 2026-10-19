// Share-pressure phrases of chain messages: «انشرها ولك الأجر», «یہ پیغام دس لوگوں کو بھیجیں», «forward this».
// They ask the reader to pass the message on; they are not a claim about the religion, so they are never searched for
// as one (a search for them ends as «not found», which tells the reader nothing). A promise («من نشرها دخل الجنة») is a
// claim and is left alone: only the request itself is matched, as whole words, in the imperative.
// Pure and browser-safe (it imports only arabic.ts), so the screen can use it on the post as typed.
import { foldUrdu } from "./arabic";

/** A phrase as a regex source over folded words: words in this order, one space between. */
const phrase = (s: string) =>
  foldUrdu(s)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(" ");
const any = (list: string[]) => `(?:${list.map(phrase).join("|")})`;

// ---- Urdu: [«یہ پیغام»] [«دس لوگوں کو»…] «بھیجیں»
const UR_THING = any(["اس پیغام کو", "اس میسج کو", "اس پوسٹ کو", "اس تحریر کو", "اس حدیث کو", "یہ پیغام", "یہ میسج", "یہ پوسٹ", "اسے", "اس کو"]);
const UR_WHOM = `(?:${any([
  "کم از کم",
  "دس لوگوں کو",
  "پانچ لوگوں کو",
  "دس افراد کو",
  "ایک شخص کو",
  "اپنے دوستوں کو",
  "سب دوستوں کو",
  "اپنے گروپس میں",
  "ہر گروپ میں",
  "سب کو",
  "آگے",
  "ضرور",
  "فوراً",
  "فورا",
  "جلد",
])}|\\d+ (?:${any(["لوگوں", "افراد", "دوستوں", "گروپس"])})(?: ${phrase("کو")})?) `;
const UR_VERB = any([
  "بھیجیں",
  "بھیجو",
  "بھیج دیں",
  "بھیجیے",
  "بھیجئے",
  "شیئر کریں",
  "شیئر کر دیں",
  "شیئر کیجیے",
  "شیئر کیجئے",
  "شئیر کریں",
  "فارورڈ کریں",
  "فارورڈ کر دیں",
  "فارورڈ کیجیے",
  "پھیلائیں",
  "پھیلا دیں",
  "پہنچائیں",
  "پہنچا دیں",
]);
const URDU = `(?:${UR_THING} )?(?:${UR_WHOM})*${UR_VERB}`;

// ---- Arabic
const ARABIC = any([
  "انشرها",
  "انشروها",
  "انشروا",
  "انشره",
  "انشر هذه",
  "انشر هذا",
  "شاركها",
  "شاركوها",
  "شارك هذه",
  "ارسلها",
  "ارسلوها",
  "ارسل هذه",
  "عممها",
  "عمموها",
  "ابعثها",
  "لا تقف عندك",
  "لا تكسر السلسلة",
  "أمانة في رقبتك",
  "أمانة في عنقك",
  "أمانة في أعناقكم",
  "ولك الأجر",
  "ولك الأجر والثواب",
  "لك الأجر والثواب",
  "ولك الثواب",
  "ساهم في نشرها",
  "ساهم في نشر هذه",
]);

// ---- English
const ENGLISH = any([
  "please share",
  "share this",
  "forward this",
  "pass it on",
  "pass this on",
  "dont break the chain",
  "don't break the chain",
  "share with everyone",
]) + `|${phrase("send this to")} (?:\\d+|ten|five|\\w+) (?:people|friends|contacts)`;

const PRESSURE = new RegExp(`(?:^| )(?:${URDU}|${ARABIC}|${ENGLISH})(?= |$)`, "g");

/** Words of the text, each with its folded form (punctuation and marks gone); a word that folds to nothing is left out. */
function words(text: string): { start: number; end: number; folded: string }[] {
  const out: { start: number; end: number; folded: string }[] = [];
  for (const m of text.matchAll(/\S+/g)) {
    const folded = foldUrdu(m[0].replace(/[^\p{L}\p{M}\p{N}'’]/gu, "")).toLowerCase().replace(/’/g, "'");
    if (folded) out.push({ start: m.index!, end: m.index! + m[0].length, folded });
  }
  return out;
}

/** The word ranges (first, last) of every pressure phrase in the text. */
function matches(text: string): { from: number; to: number }[] {
  const ws = words(text);
  const joined = ws.map((w) => w.folded).join(" ");
  const out: { from: number; to: number }[] = [];
  for (const m of joined.matchAll(PRESSURE)) {
    const lead = m[0].startsWith(" ") ? 1 : 0;
    const startChar = m.index! + lead;
    const from = joined.slice(0, startChar).split(" ").length - 1;
    const to = from + m[0].slice(lead).split(" ").length - 1;
    out.push({ from: startChar === 0 ? 0 : from, to });
  }
  return out;
}

/** True when the text asks the reader to pass it on. */
export function hasPressure(text: string): boolean {
  return matches(text).length > 0;
}

/** The text without its share requests (and the punctuation they leave at the ends); empty when nothing else is left. */
export function stripPressure(text: string): string {
  const ws = words(text);
  const hit = matches(text);
  if (!hit.length) return text.trim();
  const drop = new Set<number>();
  for (const { from, to } of hit) for (let i = from; i <= to; i++) drop.add(i);
  let out = "";
  let last = 0;
  ws.forEach((w, i) => {
    if (drop.has(i)) {
      out += text.slice(last, w.start);
      last = w.end;
    }
  });
  out += text.slice(last);
  // what is left of a request: spaces, and a separator that held it to the rest («…بھیجیں: صفائی…», «… — انشرها»)
  return out
    .replace(/\s+/g, " ")
    .replace(/^[\s:؛،,.\-–—۔!؟?]+|[\s:؛،,\-–—]+$/gu, "")
    .trim();
}
