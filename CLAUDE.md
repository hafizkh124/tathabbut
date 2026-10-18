# Notes for Claude

Standing decisions from the team lead (Hafiz Khizar Hayat):

- **Free tiers only, up to 10,000 users.** Gemini, Supabase and Vercel all run on their free plans and will stay there. Design every
  change so a free quota can never stop the app: cache before calling the AI, keep stored data small, and when a quota is spent,
  tell the person plainly ("today's free limit is used up, try tomorrow"). Gemini free tier: 5 requests a minute per model.
  If something cannot fit the free tiers, ask before building it.
- **No login or registration.** Saving what is needed about a visitor without an account (device id, country, city, what was checked)
  is fine: analytics live in Supabase (`events`, `stats_daily`, `stats_totals`, migration 012). Do not over-engineer privacy at the
  cost of the analytics the team needs.
- **Open source (AGPL-3.0)** under العلماء (alulama.org); the live site is https://tathabbut.alulama.org.
- Supabase project: `Tathabbut` (`xayknyhdqgrfqkreqdkt`); Vercel project: `tathabbut`. Migrations are in `supabase/migrations/`, numbered in order.
- When in doubt about a product decision (what a result says, how the checks work), ask the team lead first.
