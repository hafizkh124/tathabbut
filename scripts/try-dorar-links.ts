// Prints, for a few well-known texts, each Dorar narration's source and the link we would build for it, so the book
// matching can be checked by eye and the share of narrations that get a book filter can be counted.
//
//   npx tsx scripts/try-dorar-links.ts
import { searchDorar } from "../src/lib/dorar";
import { dorarBookId, dorarSearchUrl } from "../src/lib/dorarLink";

const TEXTS = [
  "اطلبوا العلم ولو بالصين",
  "إنما الأعمال بالنيات",
  "من غشنا فليس منا",
  "لولاك لما خلقت الأفلاك",
  "الدين النصيحة",
  "طلب العلم فريضة على كل مسلم",
  "حب الوطن من الإيمان",
  "أنا مدينة العلم وعلي بابها",
];

async function main() {
  let total = 0;
  let matched = 0;
  const unmatched = new Map<string, number>();
  for (const text of TEXTS) {
    const r = await searchDorar(text, 15);
    if (!r.ok) {
      console.log(`${text}: ${r.error}`);
      continue;
    }
    for (const n of r.results) {
      total++;
      if (dorarBookId(n.source)) matched++;
      else unmatched.set(n.source ?? "(none)", (unmatched.get(n.source ?? "(none)") ?? 0) + 1);
    }
    const first = r.results[0];
    console.log(`\n${text}\n  ${first?.source} | ${first?.reference}\n  ${dorarSearchUrl(first?.matn ?? text, first?.source)}`);
  }
  console.log(`\nbook found for ${matched} of ${total} narrations`);
  console.log("not matched:", [...unmatched].sort((a, b) => b[1] - a[1]).slice(0, 25));
}

main();
