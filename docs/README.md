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
| 8 | [Risks and mitigations](09-risks.md) | What could go wrong and how we respond |
| 9 | [Evaluation results](results.md) | Both evaluations on the published code, what changed after the run, known limits |

## Status

- **Live demo:** https://tathabbut-rho.vercel.app
- **Build window:** التجهيز من 1 أكتوبر 2026، وعمل المسابقة 4–6 أكتوبر 2026 (preparation from 1 October with the organisers' permission; submitted on 6 October, before the 23:59 Riyadh deadline)

## Conventions used in these documents

- **MUST / SHOULD / MAY** follow their usual meaning in requirements writing.
- Numbers marked **target** are goals. Measured results are in [`results.md`](results.md), each with the data it was
  measured on.
- Partnerships are described as **planned** unless one actually exists.
- Arabic terms are kept in Arabic script where a translation would lose precision (for example grade wordings).
