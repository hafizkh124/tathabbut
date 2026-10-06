# ٹیم کے لیے: ریپو کی نئی حالت اور محفوظ طریقۂ کار (۶ اکتوبر ۲۰۲۶)

## کیا بدلا

- سارا کام اب صرف **`master`** پر ہے۔ GitHub سے `eval`، `turath-integration` اور `turath-phase1` حذف کر دی گئی ہیں۔ ان کا کام یا تو master میں ضم ہے یا آرکائیو میں محفوظ ہے (صاحبِ منصوبہ کے پاس: `tathabbut-archive-branches-20261006.bundle`)۔
- **عبدالرحمٰن صاحب کا تقییمی نظام** (`eval/`) master میں ضم ہے۔ تیسرے فریق کے متون اس میں مقامی رہتے ہیں: `dataset.json`، `sources/v1-snapshot.json`، `screenshots/` اور ہر دور کا `results.json`۔ صرف کوڈ اور `report.md` عوامی ہیں۔
- **رسم الخط:** `eval` برانچ کا الف حذف کرنے والا طریقہ ضم **نہیں** کیا گیا، کیونکہ اس میں عثمانی اقتباس کا «قَالَ» آیت کے «قُلْ» کے برابر ہو جاتا تھا۔ اس کی جگہ `quranCheck.ts` میں Tanzil اور رسمِ مصحف کے قواعد پر مبنی اصول ہیں (`uthmaniKey`)۔ صاحبِ منصوبہ کا اصول یہ ہے کہ پورا الف کبھی «کچھ نہیں» کے برابر نہیں ہوگا۔ ٹیسٹ `src/lib/quranScripts.test.ts` میں ہیں۔
- مخصوص عبارتوں کے علمی فیصلے کوڈ میں نہیں لکھے جاتے۔ ان کی جگہ صاحبِ منصوبہ کی فہرست (`Tathabbut_Circulating_Sayings.xlsx` سے `circulating_sayings`) یا `CONTEXT_CUTS` ہے۔

## اپنی مقامی کاپی کو محفوظ طریقے سے تازہ کریں

> پہلے اپنا ہر غیر محفوظ کام محفوظ کر لیں (commit یا کاپی)، کیونکہ نیچے کی تیسری کمانڈ مقامی تبدیلیاں مٹا دیتی ہے۔

```bash
git fetch --prune origin
git switch master
git reset --hard origin/master
git branch -D eval turath-integration turath-phase1
```

## آئندہ کام کا طریقہ

1. ہر نیا کام **master سے نئی برانچ** پر کریں: `git switch -c <نام> origin/master`
2. **Pull request** بنائیں اور صاحبِ منصوبہ کی منظوری کے بعد ضم کریں۔ master پر براہِ راست push نہ کریں۔
3. **پرانی برانچیں دوبارہ push نہ کریں** (`eval`، `turath-*`)، اور `git push --force` کبھی استعمال نہ کریں۔
4. ہر push اور pull request پر **CI** (`.github/workflows/ci.yml`) یہ چیزیں جانچتا ہے:
   - ممنوع فائلیں (`scripts/check-published-files.mjs`)
   - اقسام (types) اور lint
   - تمام ٹیسٹ، جن میں «قال ≠ قل» بھی شامل ہے

   CI ناکام ہو تو تبدیلی ضم نہیں ہوگی۔
5. اپنا commit کرنے سے پہلے `git status` دیکھیں، اور صرف اپنی فائلیں نام سے `git add` کریں۔

## English summary

Only `master` remains. The `eval` suite is merged (third-party texts stay local; only code and `report.md` are published).
The alif-dropping Quran comparison from `eval` was **not** merged because it equated «قال» with «قل»; documented spelling
rules replace it. Sync with `git fetch --prune && git switch master && git reset --hard origin/master` (save your work
first), delete the old local branches, and work on new branches through pull requests. Never push the old branches or
force-push. CI must pass before merging.
