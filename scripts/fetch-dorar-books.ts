// Reads the list of books from the filter of Dorar's own search page (the <select name="s[]">) and saves {id, name} pairs
// to src/data/dorarBooks.json. The ids let a «via» link open Dorar's search already narrowed to the very book a narration
// comes from, so the user lands on that hadith in one click. Only ids and book names are kept, nothing else of the page.
//
//   npx tsx scripts/fetch-dorar-books.ts
import { mkdirSync, writeFileSync } from "node:fs";

const UA = "Tathabbut/0.1 (Islamic AI Challenge 2026; hafizkh124@gmail.com)";
const PAGE = "https://dorar.net/hadith/search?q=%D8%A7%D9%84%D8%B5%D8%A8%D8%B1";
const OUT = "src/data/dorarBooks.json";

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

async function main() {
  const res = await fetch(PAGE, { headers: { "User-Agent": UA, "Accept-Language": "ar" } });
  if (!res.ok) throw new Error(`${PAGE} -> HTTP ${res.status}`);
  const html = await res.text();

  const at = html.indexOf('name="s[]"');
  if (at < 0) throw new Error('the page has no <select name="s[]">: Dorar changed its search form');
  const end = html.indexOf("</select>", at);
  const select = html.slice(at, end < 0 ? undefined : end);

  const books: Array<{ id: number; name: string }> = []; // id 0 is «الجميع» (all books): not a book
  for (const m of select.matchAll(/<option\s+value="(\d+)"[^>]*>([^<]+)<\/option>/g)) {
    const name = decode(m[2]);
    if (name && Number(m[1]) !== 0) books.push({ id: Number(m[1]), name });
  }
  if (books.length < 300) throw new Error(`only ${books.length} books found: Dorar changed its search form`);

  mkdirSync("src/data", { recursive: true });
  writeFileSync(OUT, JSON.stringify(books, null, 0) + "\n", "utf8");
  console.log(`${books.length} books -> ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
