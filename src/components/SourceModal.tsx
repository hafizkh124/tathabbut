"use client";

import React from "react";
import type { TurathLookupOutcome } from "@/lib/hadithMatch";

export interface ModalSourceData {
  title: string;
  kind: "quran" | "hadith" | "saying" | "other";
  arabicText: string;
  statusBadge?: string;
  verseDetails?: {
    surahName: string;
    surah: number;
    ayah: number;
    diffs?: { op: string; typed?: string; correct?: string }[];
    quranComUrl?: string;
    quranpediaUrl?: string;
  };
  hadithDetails?: {
    narrations: Array<{
      rawi?: string;
      muhaddith?: string;
      source?: string;
      numberOrPage?: string;
      verdict?: string;
      display?: { gradeText: string; color?: string };
    }>;
    dorarUrl?: string;
    shamelaUrl?: string;
  };
  turathDetails?: TurathLookupOutcome;
  sayingDetails?: {
    claimedAttribution?: string | null;
    claimedReference?: string | null;
    correctText?: string | null;
    verdict?: string;
    verdictBy?: string;
    reference?: string;
    dorarUrl?: string;
    shamelaUrl?: string;
  };
}

interface SourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ModalSourceData | null;
}

export function SourceModal({ isOpen, onClose, data }: SourceModalProps) {
  if (!isOpen || !data) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold dark:bg-emerald-950/60 dark:text-emerald-300">
              📖
            </span>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{data.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
            title="بند کریں"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-5 space-y-6">
          {/* Classical Arabic Presentation Block */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2">النص الأصلي المعتمد:</p>
            <p className="text-xl leading-relaxed text-zinc-900 font-serif dark:text-zinc-100 text-right">
              {data.arabicText}
            </p>
          </div>

          {/* Quran Specific Section */}
          {data.verseDetails && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                <span className="rounded-md bg-zinc-100 px-2.5 py-1 font-medium dark:bg-zinc-800">
                  {data.verseDetails.surahName} (آیت {data.verseDetails.ayah})
                </span>
                <span className="rounded-md bg-zinc-100 px-2.5 py-1 font-medium dark:bg-zinc-800">
                  سورہ نمبر: {data.verseDetails.surah}
                </span>
              </div>

              {data.verseDetails.diffs && data.verseDetails.diffs.length > 0 && (
                <div className="rounded-lg bg-rose-50 p-4 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-900">
                  <p className="text-sm font-semibold text-rose-800 dark:text-rose-300 mb-2">
                    نقل میں فرق / غلطی کی نشاندہی:
                  </p>
                  <div className="space-y-1 text-sm">
                    {data.verseDetails.diffs.map((d, i) => (
                      <div key={i} className="text-rose-700 dark:text-rose-400">
                        {d.op === "replaced" && (
                          <span>
                            پوسٹ میں لکھا تھا: <span className="line-through font-bold">{d.typed}</span> ⟵ قرآن میں اصل لفظ ہے: <span className="font-bold underline text-emerald-700 dark:text-emerald-400">{d.correct}</span>
                          </span>
                        )}
                        {d.op === "missing" && (
                          <span>
                            چھوٹا ہوا لفظ: <span className="font-bold text-emerald-700 dark:text-emerald-400">{d.correct}</span>
                          </span>
                        )}
                        {d.op === "added" && (
                          <span>
                            اضافی لفظ: <span className="line-through font-bold">{d.typed}</span>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quran External Buttons */}
              <div className="pt-2 flex flex-wrap gap-3">
                {data.verseDetails.quranComUrl && (
                  <a
                    href={data.verseDetails.quranComUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
                  >
                    <span>🌐</span>
                    <span>Quran.com پر خود تصدیق کریں</span>
                  </a>
                )}
                {data.verseDetails.quranpediaUrl && (
                  <a
                    href={data.verseDetails.quranpediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <span>📖</span>
                    <span>Quranpedia پر مطالعہ کریں</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Hadith Narrations Section */}
          {data.hadithDetails && (
            <div className="space-y-4">
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                کتبِ حدیث اور ائمہ کے احکام (تخریج):
              </p>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {data.hadithDetails.narrations.map((n, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                        الراوي: {n.rawi || "—"}
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {n.display?.gradeText || n.verdict}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                      <p>
                        <span className="font-semibold">المحدث:</span> {n.muhaddith || "—"}
                      </p>
                      <p>
                        <span className="font-semibold">المصدر:</span> {n.source || "—"} {n.numberOrPage ? `(${n.numberOrPage})` : ""}
                      </p>
                      {n.verdict && (
                        <p className="mt-1 text-zinc-700 dark:text-zinc-300 font-medium">
                          <span className="font-semibold">حكم المحدث:</span> {n.verdict}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Hadith External Buttons */}
              <div className="pt-2 flex flex-wrap gap-3">
                {data.hadithDetails.dorarUrl && (
                  <a
                    href={data.hadithDetails.dorarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
                  >
                    <span>📚</span>
                    <span>الدرر السنية میں تمام مراجع دیکھیں</span>
                  </a>
                )}
                {data.hadithDetails.shamelaUrl && (
                  <a
                    href={data.hadithDetails.shamelaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <span>🔎</span>
                    <span>مکتبہ شاملہ میں تلاش کریں</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {data.turathDetails && (
            <div className="space-y-4">
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                مراجع إضافية من مكتبة تراث:
              </p>
              {data.turathDetails.status === "unavailable" ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
                  تعذّر البحث في تراث مؤقتا. هذا لا يغيّر حالة التحقق أو أحكام الدرر السنية.
                </p>
              ) : data.turathDetails.references.length === 0 ? (
                <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300">
                  اكتمل البحث المباشر في تراث، ولم تُعثر على إحالات مطابقة.
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {data.turathDetails.references.map((reference, idx) => (
                    <article
                      key={`${reference.bookId}:${reference.pageLocator?.internalPage ?? idx}`}
                      className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                            {reference.book.title}
                            {reference.author?.name ? ` — ${reference.author.name}` : ""}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{reference.citation}</p>
                          {reference.provenance && (
                            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                              ترتيب النتيجة في بحث تراث: {reference.provenance.rank + 1}
                            </p>
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Turath ID: {reference.bookId}</span>
                      </div>
                      {reference.pageLocator && (
                        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                          {reference.pageLocator.volume ? `المجلد: ${reference.pageLocator.volume} · ` : ""}
                          {reference.pageLocator.printedPage !== undefined ? `الصفحة المطبوعة: ${reference.pageLocator.printedPage} · ` : ""}
                          {reference.pageLocator.internalPage !== undefined ? `معرّف الصفحة الداخلي في تراث: ${reference.pageLocator.internalPage}` : ""}
                        </p>
                      )}
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-200" dir="rtl">
                        {reference.excerpt}
                      </p>
                      <a
                        href={reference.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex text-xs font-semibold text-emerald-700 underline underline-offset-2 dark:text-emerald-300"
                      >
                        فتح الإحالة في تراث
                      </a>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Specialist Saying Section */}
          {data.sayingDetails && (
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-800/40 space-y-2">
                {data.sayingDetails.claimedAttribution && (
                  <p>
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">منسوب کیا گیا:</span>{" "}
                    {data.sayingDetails.claimedAttribution}
                  </p>
                )}
                {data.sayingDetails.verdict && (
                  <p>
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">حکم:</span>{" "}
                    {data.sayingDetails.verdict} {data.sayingDetails.verdictBy ? `(قول: ${data.sayingDetails.verdictBy})` : ""}
                  </p>
                )}
                {data.sayingDetails.reference && (
                  <p>
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">مرجع و کتاب:</span>{" "}
                    {data.sayingDetails.reference}
                  </p>
                )}
                {data.sayingDetails.correctText && (
                  <div className="mt-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <span className="font-bold">اصل درست عبارت یا نسبت:</span> {data.sayingDetails.correctText}
                  </div>
                )}
              </div>

              {/* Saying External Buttons */}
              <div className="pt-2 flex flex-wrap gap-3">
                {data.sayingDetails.shamelaUrl && (
                  <a
                    href={data.sayingDetails.shamelaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
                  >
                    <span>🔎</span>
                    <span>مکتبہ شاملہ میں حوالہ دیکھیں</span>
                  </a>
                )}
                {data.sayingDetails.dorarUrl && (
                  <a
                    href={data.sayingDetails.dorarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 transition-colors"
                  >
                    <span>📚</span>
                    <span>الدرر السنية میں تلاش</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="rounded-xl bg-zinc-100 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
          >
            بند کریں
          </button>
        </div>
      </div>
    </div>
  );
}
