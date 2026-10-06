// Fails when files that must stay out of the public repository are tracked again (decisions of 2026-10-06):
// third-party texts of the evaluation suite, the private evaluation records, and secrets.
import { execSync } from "node:child_process";

const FORBIDDEN = [
  [/^eval\/dataset\.json$/, "third-party texts (Sahih International, HadeethEnc, quranlab/hadith); rebuild locally"],
  [/^eval\/sources\/v1-snapshot\.json$/, "third-party texts; rebuild locally"],
  [/^eval\/screenshots\//, "rendered third-party texts; rebuild locally"],
  [/^eval\/runs\/.+\/results\.json$/, "run results hold third-party texts; only report.md is published"],
  [/^evaluation-audit\//, "private evaluation records"],
  [/(^|\/)\.env(\.local)?$/, "secrets"],
];

const tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
const hits = tracked.flatMap((f) => FORBIDDEN.filter(([re]) => re.test(f)).map(([, why]) => `${f} — ${why}`));
if (hits.length) {
  console.error("These files must not be in the repository:\n- " + hits.join("\n- "));
  process.exit(1);
}
console.log(`OK: ${tracked.length} tracked files, none forbidden.`);
