# Tathabbut — Project Documentation

**Tathabbut (تَثَبُّت): an AI system for instant verification and sourcing of Islamic texts.**

This folder holds the project's goals, scope and requirements, written for the team, the mentors and the
management of the **Islamic AI Challenge 2026** (Track 4: knowledge and verification tools that empower people
who introduce Islam).

| # | Document | What it covers |
|---|---|---|
| 1 | [Vision and goals](01-vision-and-goals.md) | The problem, who it is for, the core principle, measurable goals |
| 2 | [Scope](02-scope.md) | What the MVP includes, what it leaves out, and the roadmap after the challenge |
| 3 | [Requirements](03-requirements.md) | Functional and non-functional requirements, numbered for tracking |
| 4 | [Verification rules](04-verification-rules.md) | How a result's state is decided, the grade scheme, the four content levels |
| 5 | [Data sources and licensing](05-data-sources-and-licensing.md) | Every source we use, how we use it, its terms, and what we deliberately do not use |
| 6 | [Architecture](06-architecture.md) | Pipeline, components, database, infrastructure |
| 7 | [Evaluation plan](07-evaluation-plan.md) | Test set, metrics, targets, baseline comparison |
| 8 | [Challenge compliance](08-challenge-compliance.md) | Judging criteria, required deliverables, timeline, disclosures |
| 9 | [Risks and mitigations](09-risks.md) | What could go wrong and how we respond |
| 10 | [Turath integration decisions](10-turath-integration-decisions.md) | SDK choice, lookup scope and limits, citation/locator behavior, failure handling, retention, attribution, and evaluation status |
| 11 | [Turath extension decisions](11-turath-extension-decisions.md) | Category-scoped search, strict matching, «غير حاسم» fallback, fiqh and personal-case handling, translation, caching; drafts for the specialist (ruling books, test questions) |
| 12 | [۵ اکتوبر کی مشترکہ عملی جانچ](12-practical-review-2026-10-05.md) | منظور شدہ علمی اصلاحات، عملی تجربات، ناکامی کے راستے اور واضح طور پر باقی جانچ |

## Status

- **Live demo:** https://tathabbut-rho.vercel.app
- **Build window:** 4–6 October 2026 (submission closes Tuesday 6 October, 23:59 Riyadh time)
- **Team:** solo participant — a hadith specialist (MA in Hadith and Hadith Sciences, Islamic University of Madinah),
  who also performs all scholarly review.

## Conventions used in these documents

- **MUST / SHOULD / MAY** follow their usual meaning in requirements writing.
- Numbers marked **target** are goals to be measured on the test set. They are not results. Results will be
  published in `docs/results.md` after evaluation; no number is reported before it is measured.
- Partnerships are described as **planned** unless one actually exists.
- Arabic terms are kept in Arabic script where a translation would lose precision (for example grade wordings).
