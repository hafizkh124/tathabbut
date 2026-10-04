"use client";

import React, { useState } from "react";
import { SourceModal, type ModalSourceData } from "@/components/SourceModal";
import { OriginTrackerDrawer } from "@/components/OriginTrackerDrawer";

interface ClaimResult {
  claim: {
    kind: string;
    textAsWritten: string;
    query: string;
    arabicSpan: string | null;
    language: string;
    attributedTo: string | null;
    citedSource: string | null;
  };
  state: string;
  basis: string;
  verse?: {
    surah: number;
    ayah: number;
    surahName: string;
    text: string;
    wording?: {
      exact: boolean;
      correctText: string;
      diffs: Array<{ op: string; typed?: string; correct?: string }>;
    };
    externalUrls?: {
      quranCom: string;
      quranpedia: string;
    };
  };
  saying?: {
    id: number;
    text_ar: string;
    status: string;
    verdict: string;
    verdict_by: string;
    reference: string;
    correct_text: string | null;
    note: string | null;
    claimed_attribution: string | null;
    claimed_reference: string | null;
    externalUrls?: {
      dorar: string;
      shamela: string;
    };
  };
  dorar?: {
    narrations: Array<{
      rawi?: string;
      muhaddith?: string;
      source?: string;
      numberOrPage?: string;
      verdict?: string;
      display?: { gradeText: string; color?: string };
    }>;
    summary: {
      grade: string;
      count: number;
    };
    origin?: string;
    externalUrls?: {
      dorar: string;
      shamela: string;
    };
  };
  notes: string[];
}

interface VerifyResponse {
  claims: ClaimResult[];
  dropped?: unknown[];
  ms?: { extract: number; total: number };
  error?: string;
  detail?: string;
}

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [selectedSourceModal, setSelectedSourceModal] = useState<ModalSourceData | null>(null);
  const [originDrawerQuery, setOriginDrawerQuery] = useState<string | null>(null);

  const sampleTexts = [
    { label: "آیت میں غلطی", text: "قرآن میں آیا ہے: إن الله مع الصابرون" },
    { label: "ضعیف یا موضوع روایت", text: "حدیث شریف میں ہے: اطلبوا العلم ولو بالصين" },
    { label: "مشہور متداول مقولہ", text: "روایت ہے کہ: لولاك لما خلقت الأفلاك" },
    { label: "فقہی سوال", text: "کیا غصے کی حالت میں دی گئی طلاق واقع ہو جاتی ہے؟" },
  ];

  const handleVerify = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });
      const data = (await res.json()) as VerifyResponse;
      if (!res.ok) {
        setError(data.error || "تحقیق میں رکاوٹ پیش آئی");
      } else {
        setResults(data);
      }
    } catch (err) {
      setError((err as Error).message || "نیٹ ورک کی خرابی");
    } finally {
      setLoading(false);
    }
  };

  const openSourceModal = (r: ClaimResult) => {
    if (r.verse) {
      setSelectedSourceModal({
        title: `تحقیق المصحف — ${r.verse.surahName}`,
        kind: "quran",
        arabicText: r.verse.text,
        statusBadge: r.state,
        verseDetails: {
          surahName: r.verse.surahName,
          surah: r.verse.surah,
          ayah: r.verse.ayah,
          diffs: r.verse.wording?.diffs,
          quranComUrl: r.verse.externalUrls?.quranCom,
          quranpediaUrl: r.verse.externalUrls?.quranpedia,
        },
      });
    } else if (r.dorar) {
      setSelectedSourceModal({
        title: `تخریج الحدیث — الدرر السنية`,
        kind: "hadith",
        arabicText: r.claim.arabicSpan || r.claim.query,
        statusBadge: r.state,
        hadithDetails: {
          narrations: r.dorar.narrations,
          dorarUrl: r.dorar.externalUrls?.dorar,
          shamelaUrl: r.dorar.externalUrls?.shamela,
        },
      });
    } else if (r.saying) {
      setSelectedSourceModal({
        title: `تحقیق القول المتداول — قائمة النقد`,
        kind: "saying",
        arabicText: r.saying.text_ar,
        statusBadge: r.state,
        sayingDetails: {
          claimedAttribution: r.saying.claimed_attribution,
          claimedReference: r.saying.claimed_reference,
          correctText: r.saying.correct_text,
          verdict: r.saying.verdict,
          verdictBy: r.saying.verdict_by,
          reference: r.saying.reference,
          dorarUrl: r.saying.externalUrls?.dorar,
          shamelaUrl: r.saying.externalUrls?.shamela,
        },
      });
    }
  };

  const getBadgeStyle = (state: string) => {
    if (state.includes("مقبول") || state.includes("صحيحة")) {
      return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800";
    }
    if (state.includes("ضعيف") && !state.includes("شديد")) {
      return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800";
    }
    if (state.includes("شديد") || state.includes("لا أصل") || state.includes("خطأ")) {
      return "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800";
    }
    if (state.includes("فتوى")) {
      return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800";
    }
    return "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans" dir="rtl">
      {/* Top Header */}
      <header className="border-b border-zinc-200 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-emerald-600/20">
              تَ
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">تَثَبُّت</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">التحقق الشرعي والمصدري من النصوص المتداولة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900">
              Islamic AI Challenge 2026
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Intro Banner */}
        <section className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
            تثبّت من صحة الآيات والأحاديث والأقوال
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
            تحقق مباشر من 6,236 آية قرآنية، کتبِ حدیث کی مسند تخریج (الدرر السنية)، معتمد تراجم، اور وائرل شوشوں کی ڈیجیٹل کھوج۔
          </p>
        </section>

        {/* Input Box Card */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">
            پوسٹ، پیغام یا تحریر یہاں پیسٹ کریں:
          </label>
          <textarea
            rows={4}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="مثال: واٹس ایپ یا سوشل میڈیا پر گردش کرنے والا میسج، قرآنی آیت، یا حدیث کا متن پیسٹ کریں..."
            className="w-full rounded-xl border border-zinc-300 p-4 text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
          />

          {/* Sample Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-zinc-400 font-medium">تجرباتی نمونے:</span>
            {sampleTexts.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setInputText(s.text)}
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleVerify}
              disabled={loading || !inputText.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-base font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>تحقیق جاری ہے...</span>
                </>
              ) : (
                <>
                  <span>🔍</span>
                  <span>تحقیق کریں</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Error Display */}
        {error && (
          <div className="rounded-xl bg-rose-50 p-4 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 text-sm">
            <p className="font-bold">خرابی:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Results Section */}
        {results && results.claims && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                نتائج التحقیق ({results.claims.length} دعوے)
              </h3>
              {results.ms && (
                <span className="text-xs text-zinc-400">
                  رفتار: {results.ms.total}ms
                </span>
              )}
            </div>

            <div className="space-y-4">
              {results.claims.map((r, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4 transition-all hover:shadow-md"
                >
                  {/* Top Bar of Claim Card */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
                    <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {r.claim.kind === "quran" ? "📖 آیت کریمہ" : r.claim.kind === "hadith" ? "📜 حدیث شریف" : r.claim.kind === "scholar_quote" ? "✍️ قولِ عالم" : "❓ استفسار"}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${getBadgeStyle(r.state)}`}
                    >
                      {r.state}
                    </span>
                  </div>

                  {/* Quoted Text */}
                  <div>
                    <p className="text-xs text-zinc-400 mb-1">منقول شدہ عبارت:</p>
                    <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100 font-serif leading-relaxed">
                      «{r.claim.textAsWritten}»
                    </p>
                  </div>

                  {/* Misquote notice if verse has error */}
                  {r.verse?.wording && !r.verse.wording.exact && (
                    <div className="rounded-xl bg-rose-50 p-3.5 border border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300 text-sm space-y-1">
                      <p className="font-bold">⚠️ آیت نقل کرنے میں غلطی واقع ہوئی ہے:</p>
                      {r.verse.wording.diffs.map((d, di) => (
                        <p key={di} className="text-xs">
                          {d.op === "replaced" && `پوسٹ کا لفظ [${d.typed}] غلط ہے، صحیح لفظ [${d.correct}] ہے`}
                          {d.op === "missing" && `چھوٹا ہوا لفظ: [${d.correct}]`}
                          {d.op === "added" && `اضافی لفظ: [${d.typed}]`}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Specialist / Dorar ruling snippet */}
                  {r.dorar && (
                    <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-400 space-y-1">
                      <p>
                        <span className="font-bold">ماخذ:</span> الدرر السنية ({r.dorar.summary.count} مرویات معتمدہ)
                      </p>
                      {r.dorar.narrations[0]?.verdict && (
                        <p>
                          <span className="font-bold">حکم:</span> {r.dorar.narrations[0].verdict}{" "}
                          {r.dorar.narrations[0].muhaddith ? `(${r.dorar.narrations[0].muhaddith})` : ""}
                        </p>
                      )}
                    </div>
                  )}

                  {r.saying && (
                    <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-400 space-y-1">
                      <p>
                        <span className="font-bold">حکم:</span> {r.saying.verdict} ({r.saying.verdict_by})
                      </p>
                      <p>
                        <span className="font-bold">مرجع:</span> {r.saying.reference}
                      </p>
                    </div>
                  )}

                  {/* Notes */}
                  {r.notes && r.notes.length > 0 && (
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                      {r.notes.join(" • ")}
                    </div>
                  )}

                  {/* Action Buttons Bar */}
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    {/* Source Modal Trigger */}
                    {(r.verse || r.dorar || r.saying) && (
                      <button
                        type="button"
                        onClick={() => openSourceModal(r)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 cursor-pointer transition-colors"
                      >
                        <span>📖</span>
                        <span>تحقیقِ مراجع و کتابی صفحہ</span>
                      </button>
                    )}

                    {/* Origin Tracker Trigger */}
                    <button
                      type="button"
                      onClick={() => setOriginDrawerQuery(r.claim.query || r.claim.textAsWritten)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 cursor-pointer transition-colors"
                    >
                      <span>🕵️</span>
                      <span>منبع کی کھوج (کہاں سے پھیلا؟)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Popups & Drawers */}
      <SourceModal
        isOpen={Boolean(selectedSourceModal)}
        onClose={() => setSelectedSourceModal(null)}
        data={selectedSourceModal}
      />

      <OriginTrackerDrawer
        isOpen={Boolean(originDrawerQuery)}
        onClose={() => setOriginDrawerQuery(null)}
        claimQuery={originDrawerQuery || ""}
      />
    </div>
  );
}
