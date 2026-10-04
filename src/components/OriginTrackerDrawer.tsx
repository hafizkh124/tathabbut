"use client";

import React, { useState, useEffect } from "react";

export interface OriginReportData {
  query: string;
  earliestRecord: {
    estimatedDate?: string;
    sourcePlatform?: string;
    sourceUrl?: string;
    snippet?: string;
  };
  spreadPattern: string;
  summaryUrdu: string;
  groundingSources: Array<{ title: string; url: string }>;
  disclaimer: string;
}

interface OriginTrackerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  claimQuery: string;
}

export function OriginTrackerDrawer({ isOpen, onClose, claimQuery }: OriginTrackerDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<OriginReportData | null>(null);

  useEffect(() => {
    if (isOpen && claimQuery) {
      setLoading(true);
      setError(null);
      setReport(null);

      fetch("/api/origin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: claimQuery }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (data.report) {
            setReport(data.report);
          } else {
            setError(data.error || "کوئی معلومات موصول نہیں ہو سکیں");
          }
        })
        .catch((err) => {
          setError(err.message || "نیٹ ورک کی خرابی");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, claimQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-800 font-bold dark:bg-amber-950 dark:text-amber-300">
              🕵️
            </span>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              منبع کی کھوج (انٹرنیٹ پر ڈیجیٹل آغاز)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="mt-5 space-y-5">
          {/* Query Text */}
          <div className="rounded-xl bg-zinc-50 p-3.5 border border-zinc-200 dark:bg-zinc-800/50 dark:border-zinc-800 text-sm">
            <span className="font-semibold text-zinc-600 dark:text-zinc-400">زیرِ تحقیق جملہ / دعویٰ:</span>
            <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">«{claimQuery}»</p>
          </div>

          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-600 border-t-transparent" />
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                انٹرنیٹ کے پرانے عوامی آرکائیوز اور فورمز کی کھوج جاری ہے...
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-rose-50 p-4 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 text-sm">
              <p className="font-bold">تحقیق مکمل نہ ہو سکی:</p>
              <p>{error}</p>
            </div>
          )}

          {report && (
            <div className="space-y-4 text-right">
              {/* Timeline / Key Findings Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4 dark:border-amber-950 dark:bg-amber-950/20">
                  <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    📅 سب سے پرانا عوامی ریکارڈ:
                  </span>
                  <p className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-50">
                    {report.earliestRecord.estimatedDate || "غیر معین"}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                    🌐 پہلی عوامی موجودگی:
                  </span>
                  <p className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {report.earliestRecord.sourcePlatform || "آن لائن فورمز"}
                  </p>
                </div>
              </div>

              {/* Spread Pattern */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                  🔄 طریقۂ تداول اور پھیلاؤ:
                </span>
                <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {report.spreadPattern}
                </p>
              </div>

              {/* Urdu Detailed Summary */}
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                  تفصیلی تجزیاتی خلاصہ:
                </h4>
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
                  {report.summaryUrdu}
                </p>
              </div>

              {/* Grounding Sources */}
              {report.groundingSources.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                    انٹرنیٹ پر دستیاب متعلقہ ریکارڈز اور لنکس:
                  </p>
                  <div className="space-y-1.5">
                    {report.groundingSources.map((s, idx) => (
                      <a
                        key={idx}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-700 hover:border-amber-400 hover:bg-amber-50/50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <span className="truncate max-w-[85%] font-medium">{s.title || s.url}</span>
                        <span className="text-amber-600 dark:text-amber-400">↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <div className="rounded-lg bg-zinc-100 p-3 text-[11px] leading-relaxed text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
                {report.disclaimer}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="rounded-xl bg-zinc-100 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            بند کریں
          </button>
        </div>
      </div>
    </div>
  );
}
