"use client";
import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";

interface Report {
  id: number;
  text: string;
  query: string | null;
  state: string;
  locale: string;
  reviewed: boolean;
  created_at: string;
}

type Which = "false" | "true" | "all";
const TOKEN_KEY = "tathabbut.admin";

// the token lives in this tab only (sessionStorage): closing the tab forgets it
const readToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
};
const saveToken = (v: string) => {
  try {
    if (v) sessionStorage.setItem(TOKEN_KEY, v);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* blocked storage: the token is asked for again after a reload */
  }
};

const noSubscribe = () => () => {};

const btn = "min-h-10 cursor-pointer rounded-full border-[1.5px] border-line-strong bg-surface px-4 text-[14px] font-medium text-ink hover:bg-paper";

export function ReviewReports() {
  // read on the client only (the server render has no token), so the sign-in form never flashes for a signed-in tab
  const saved = useSyncExternalStore(noSubscribe, readToken, () => "");
  const [entered, setToken] = useState<string | null>(null); // null: nothing entered or cleared yet in this tab
  const token = entered ?? saved;
  const [typed, setTyped] = useState("");
  const [which, setWhich] = useState<Which>("false");
  const [rows, setRows] = useState<Report[] | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (tok: string, w: Which) => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/reports?reviewed=${w}&limit=200`, { headers: { Authorization: `Bearer ${tok}` }, cache: "no-store" });
      if (res.status === 401) {
        saveToken("");
        setToken("");
        setRows(null);
        setMessage("ٹوکن درست نہیں۔");
        return;
      }
      if (res.status === 429) {
        setMessage("کئی غلط کوششیں ہوئیں؛ ایک منٹ بعد دوبارہ کوشش کریں۔");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setRows(((await res.json()) as { reports: Report[] }).reports);
    } catch {
      setMessage("رپورٹیں پڑھی نہ جا سکیں۔");
    } finally {
      setLoading(false);
    }
  }, []);

  // a token kept from earlier in this tab opens the list at once
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => void load(saved, "false"), 0);
    return () => clearTimeout(timer);
  }, [saved, load]);

  const enter = (e: React.FormEvent) => {
    e.preventDefault();
    const tok = typed.trim();
    if (!tok) return;
    saveToken(tok);
    setToken(tok);
    setTyped("");
    void load(tok, which);
  };

  const mark = async (r: Report) => {
    const reviewed = !r.reviewed;
    setMessage("");
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, reviewed }),
      });
      if (!res.ok) throw new Error(String(res.status));
      // a row that no longer belongs to the list shown leaves it; in «all» it only changes its mark
      setRows((list) => (list ?? []).flatMap((x) => (x.id !== r.id ? [x] : which === "all" ? [{ ...x, reviewed }] : [])));
    } catch {
      setMessage("تبدیلی محفوظ نہ ہو سکی۔");
    }
  };

  const choose = (w: Which) => {
    setWhich(w);
    void load(token, w);
  };

  if (!token) {
    return (
      <main dir="rtl" className="mx-auto max-w-md space-y-4 px-5 py-12">
        <h1 className="text-xl font-bold text-brand-ink">رپورٹوں کا جائزہ</h1>
        <form onSubmit={enter} className="space-y-3">
          <label className="block space-y-1 text-[13px] text-muted">
            <span>ٹوکن</span>
            <input
              type="password"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              dir="ltr"
              className="block w-full rounded-xl border-[1.5px] border-line-strong bg-surface px-3 py-2 text-[16px] text-ink focus:border-brand focus:outline-none"
            />
          </label>
          <button type="submit" className={btn} disabled={!typed.trim()}>
            داخل ہوں
          </button>
        </form>
        {message && <p className="text-[13px]" style={{ color: "var(--t-weak-fg)" }} role="status">{message}</p>}
      </main>
    );
  }

  return (
    <main dir="rtl" className="mx-auto max-w-3xl space-y-4 px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-brand-ink">رپورٹوں کا جائزہ</h1>
        <button
          type="button"
          className={btn}
          onClick={() => {
            saveToken("");
            setToken("");
            setRows(null);
          }}
        >
          باہر نکلیں
        </button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="فلٹر">
        {(
          [
            ["false", "باقی"],
            ["true", "دیکھی ہوئی"],
            ["all", "سب"],
          ] as const
        ).map(([w, label]) => (
          <button key={w} type="button" className={`${btn} ${which === w ? "border-brand! text-brand-ink" : ""}`} aria-pressed={which === w} onClick={() => choose(w)}>
            {label}
          </button>
        ))}
      </div>

      {message && <p className="text-[13px]" style={{ color: "var(--t-weak-fg)" }} role="status">{message}</p>}
      {loading && <p className="text-[13px] text-muted">لوڈ ہو رہا ہے…</p>}
      {rows && !loading && <p className="text-[13px] text-muted">{rows.length} رپورٹیں</p>}

      <ul className="space-y-3">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="space-y-2 rounded-2xl border border-line bg-surface p-4">
            <p className="font-quran whitespace-pre-line text-[19px] leading-[2] text-ink" dir="auto">
              {r.text}
            </p>
            <p className="text-[13px] text-muted">
              <span className="font-semibold text-brand-ink">{r.state}</span> · {r.locale} · {new Date(r.created_at).toLocaleString("ur-PK")} · #{r.id}
            </p>
            {r.query && (
              <p className="text-[13px] text-muted" dir="auto">
                سوال جو کتابوں سے پوچھا گیا: {r.query}
              </p>
            )}
            <button type="button" className={btn} onClick={() => void mark(r)}>
              {r.reviewed ? "دوبارہ باقی کریں" : "دیکھ لی"}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
