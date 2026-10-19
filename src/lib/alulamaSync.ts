// The daily upkeep of our copy of العلماء (called by /api/cron/alulama): what changed on the site is fetched and stored, and a
// slice of the stored posts is checked against the site, so a post taken down there is taken down here. The first full copy is
// made by scripts/sync-alulama.ts; until it exists there is nothing to update from and this does nothing.
import { deleteIds, existingIds, fetchPosts, getState, setState, storedIds, toRow, upsertRows, type AlulamaRow } from "./alulama";
import type { RestConfig } from "./supabaseRest";

/** At most this many pages (100 posts each) of changes in one run: a run has to end inside the function's time limit. */
export const MAX_CHANGE_PAGES = 5;
/** How many stored posts are checked against the site in one run (a full pass takes about a fortnight). */
export const CHECK_PER_RUN = 500;

interface State {
  lastModified?: string;
  checkedUpTo?: number;
  at?: string;
}

export interface SyncDeps {
  fetchPosts: typeof fetchPosts;
  existingIds: typeof existingIds;
  upsertRows: typeof upsertRows;
  deleteIds: typeof deleteIds;
  storedIds: typeof storedIds;
  getState: typeof getState;
  setState: typeof setState;
  wait: (ms: number) => Promise<void>;
}

const real: SyncDeps = { fetchPosts, existingIds, upsertRows, deleteIds, storedIds, getState, setState, wait: (ms) => new Promise((r) => setTimeout(r, ms)) };

export interface SyncReport {
  ok: boolean;
  reason?: "no-first-copy";
  changed: number;
  removed: number;
  checked: number;
}

export async function syncAlulama(cfg: RestConfig, deps: Partial<SyncDeps> = {}): Promise<SyncReport> {
  const d = { ...real, ...deps };
  const state = (await d.getState<State>(cfg, "alulama_sync")) ?? {};
  if (!state.lastModified) return { ok: false, reason: "no-first-copy", changed: 0, removed: 0, checked: 0 };

  // 1) what changed since the last run, oldest change first
  let changed = 0;
  let lastModified = state.lastModified;
  for (let page = 1; page <= MAX_CHANGE_PAGES; page++) {
    const { posts, totalPages } = await d.fetchPosts({ page, modifiedAfter: state.lastModified });
    const rows = posts.map(toRow).filter((r): r is AlulamaRow => r !== null);
    await d.upsertRows(cfg, rows);
    changed += rows.length;
    for (const r of rows) if (r.modified && r.modified.slice(0, 19) > lastModified) lastModified = r.modified.slice(0, 19);
    if (page >= totalPages) break;
    await d.wait(1_000);
  }

  // 2) a slice of the stored posts against the site; one that is no longer there is removed
  const ids = (await d.storedIds(cfg)).sort((a, b) => a - b);
  const from = ids.findIndex((id) => id > (state.checkedUpTo ?? 0));
  const slice = from < 0 ? ids.slice(0, CHECK_PER_RUN) : ids.slice(from, from + CHECK_PER_RUN);
  let removed = 0;
  if (slice.length) {
    const alive = await d.existingIds(slice);
    const gone = slice.filter((id) => !alive.has(id));
    await d.deleteIds(cfg, gone);
    removed = gone.length;
  }
  const checkedUpTo = slice.length && from >= 0 && from + CHECK_PER_RUN < ids.length ? slice[slice.length - 1] : 0;

  await d.setState(cfg, "alulama_sync", { lastModified, checkedUpTo, at: new Date().toISOString() });
  return { ok: true, changed, removed, checked: slice.length };
}
