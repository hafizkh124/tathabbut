// Searches the specialist's list (circulating_sayings) through the match_sayings database function (migration 005).
import { searchForm } from "./quranCheck";
import { publicConfig, rpc, type RestConfig } from "./supabaseRest";
import type { SayingHit } from "./verify";

export async function matchSayings(query: string, cfg: RestConfig | null = publicConfig(), minScore = 0.5): Promise<SayingHit[]> {
  const q = searchForm(query);
  if (q.split(" ").length < 2) return [];
  return rpc<SayingHit[]>(cfg, "match_sayings", { q, min_score: minScore, max_results: 3 });
}
