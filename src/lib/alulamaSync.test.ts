import { describe, expect, it, vi } from "vitest";
import { CHECK_PER_RUN, syncAlulama, type SyncDeps } from "./alulamaSync";
import type { WpPost } from "./alulama";

const cfg = { url: "https://x.supabase.co", key: "k" };
const post = (id: number, modified: string): WpPost => ({
  id,
  link: `https://alulama.org/${id}/`,
  modified,
  date: modified,
  categories: [7191],
  title: { rendered: `سوال ${id}` },
  content: { rendered: `<h3>سوال ${id}</h3><p>سوال؟</p><h3>جواب</h3><p>جواب ${id}</p>` },
});

function deps(over: Partial<SyncDeps> = {}): SyncDeps {
  return {
    fetchPosts: vi.fn().mockResolvedValue({ posts: [], totalPages: 1, total: 0 }),
    existingIds: vi.fn().mockImplementation(async (ids: number[]) => new Set(ids)),
    upsertRows: vi.fn().mockResolvedValue(undefined),
    deleteIds: vi.fn().mockResolvedValue(undefined),
    storedIds: vi.fn().mockResolvedValue([1, 2, 3]),
    getState: vi.fn().mockResolvedValue({ lastModified: "2026-10-15T00:00:00", checkedUpTo: 0 }),
    setState: vi.fn().mockResolvedValue(undefined),
    wait: vi.fn().mockResolvedValue(undefined),
    ...over,
  } as SyncDeps;
}

describe("syncAlulama", () => {
  it("does nothing until the first full copy exists", async () => {
    const d = deps({ getState: vi.fn().mockResolvedValue(null) });
    expect(await syncAlulama(cfg, d)).toEqual({ ok: false, reason: "no-first-copy", changed: 0, removed: 0, checked: 0 });
    expect(d.fetchPosts).not.toHaveBeenCalled();
  });

  it("stores what changed since the last run and moves the mark forward", async () => {
    const d = deps({ fetchPosts: vi.fn().mockResolvedValue({ posts: [post(10, "2026-10-16T08:00:00"), post(11, "2026-10-17T09:30:00")], totalPages: 1, total: 2 }) });
    const r = await syncAlulama(cfg, d);
    expect(r).toMatchObject({ ok: true, changed: 2 });
    expect(d.fetchPosts).toHaveBeenCalledWith({ page: 1, modifiedAfter: "2026-10-15T00:00:00" });
    expect((d.upsertRows as ReturnType<typeof vi.fn>).mock.calls[0][1].map((x: { id: number }) => x.id)).toEqual([10, 11]);
    expect((d.setState as ReturnType<typeof vi.fn>).mock.calls[0][2]).toMatchObject({ lastModified: "2026-10-17T09:30:00" });
  });

  it("removes a stored post the site no longer has", async () => {
    const d = deps({ existingIds: vi.fn().mockResolvedValue(new Set([1, 3])) });
    const r = await syncAlulama(cfg, d);
    expect(r).toMatchObject({ removed: 1, checked: 3 });
    expect(d.deleteIds).toHaveBeenCalledWith(cfg, [2]);
  });

  it("checks the stored posts a slice at a time, and starts over after the last", async () => {
    const ids = Array.from({ length: CHECK_PER_RUN + 10 }, (_, i) => i + 1);
    const first = deps({ storedIds: vi.fn().mockResolvedValue(ids) });
    await syncAlulama(cfg, first);
    expect((first.setState as ReturnType<typeof vi.fn>).mock.calls[0][2].checkedUpTo).toBe(CHECK_PER_RUN);
    const second = deps({ storedIds: vi.fn().mockResolvedValue(ids), getState: vi.fn().mockResolvedValue({ lastModified: "2026-10-15T00:00:00", checkedUpTo: CHECK_PER_RUN }) });
    const r = await syncAlulama(cfg, second);
    expect(r.checked).toBe(10);
    expect((second.setState as ReturnType<typeof vi.fn>).mock.calls[0][2].checkedUpTo).toBe(0);
  });
});
