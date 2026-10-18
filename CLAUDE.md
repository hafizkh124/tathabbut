# Notes for Claude

Standing decisions from the team lead (Hafiz Khizar Hayat):

- **Free tiers only, up to 10,000 users.** Gemini, Supabase and Vercel all run on their free plans and will stay there. Design every
  change so a free quota can never stop the app: cache before calling the AI, keep stored data small, and when a quota is spent,
  say it as high demand, never as a fault ("so many people checked today that today's capacity is full, try tomorrow").
  If something cannot fit the free tiers, ask before building it.
- **Gemini free tier (AI Studio, October 2026), per model:** every Flash model (3.8, 3.7, 3.6, 3, 2.5) 5 a minute and 20 a
  day; 3.5 and 3.1 Flash Lite 15 a minute and 500 a day; 2.5 Flash Lite 10 and 20; Gemma 4 31B and 26B 30 a minute, 16K tokens
  a minute and 14,400 a day. Search grounding is free only for the 2.5 models (1,500 a day), so the origin search keeps to them.
  The chains are GEMINI_MODEL + GEMINI_FALLBACK_MODELS and GEMINI_ORIGIN_MODELS (Vercel); `/api/health?models=1` lists the
  API names the key can call.
- **No login or registration.** Saving what is needed about a visitor without an account (device id, country, city, what was checked)
  is fine: analytics live in Supabase (`events`, `stats_daily`, `stats_totals`, migration 012). Do not over-engineer privacy at the
  cost of the analytics the team needs.
- **Open source (AGPL-3.0)** under العلماء (alulama.org); the live site is https://tathabbut.alulama.org.
- Supabase project: `Tathabbut` (`xayknyhdqgrfqkreqdkt`); Vercel project: `tathabbut`. Migrations are in `supabase/migrations/`, numbered in order.
- When in doubt about a product decision (what a result says, how the checks work), ask the team lead first.
