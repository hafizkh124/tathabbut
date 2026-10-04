"use client";
import React, { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { Dialog } from "./ui/Dialog";
import { Icon } from "./ui/Icon";
import { LogoMark } from "./ui/Logo";

export interface OriginReportData {
  query: string;
  earliestRecord: {
    estimatedDate?: string;
    sourcePlatform?: string;
    sourceUrl?: string;
    snippet?: string;
  };
  spreadPattern: string;
  summary: string;
  lang: "ar" | "en" | "ur";
  groundingSources: Array<{ title: string; url: string }>;
  disclaimer: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  claimQuery: string;
}

type Load = { status: "loading" } | { status: "failed" } | { status: "done"; report: OriginReportData };

/** The body is mounted only while the dialog is open, so each opening starts a fresh search. */
function OriginBody({ claimQuery }: { claimQuery: string }) {
  const { t, locale } = useI18n();
  const [load, setLoad] = useState<Load>({ status: "loading" });

  useEffect(() => {
    let live = true;
    fetch("/api/origin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: claimQuery, lang: locale }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { report?: OriginReportData }) => {
        if (live) setLoad(data.report ? { status: "done", report: data.report } : { status: "failed" });
      })
      .catch(() => live && setLoad({ status: "failed" }));
    return () => {
      live = false;
    };
  }, [claimQuery, locale]);

  const report = load.status === "done" ? load.report : null;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="rounded-xl border border-line bg-paper px-3.5 py-2.5">
        <p className="font-quran text-[19px] leading-[2.1]" dir="auto">
          «{claimQuery}»
        </p>
      </div>

      {load.status === "loading" && (
        <div className="flex flex-col items-center gap-3 py-8" role="status">
          <LogoMark size={72} motion="loading" />
          <p className="text-[14px] text-muted">{t("origin.loading")}</p>
        </div>
      )}

      {load.status === "failed" && (
        <p role="alert" className="rounded-xl border p-3 text-[14px]" style={{ background: "var(--t-veryWeak-bg)", color: "var(--t-veryWeak-fg)", borderColor: "var(--t-veryWeak-bd)" }}>
          {t("origin.failed")}
        </p>
      )}

      {report && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-surface p-3.5">
              <p className="text-[12px] font-semibold text-muted">{t("origin.earliest")}</p>
              <p className="font-semibold">{report.earliestRecord.estimatedDate || t("origin.unknown")}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3.5">
              <p className="text-[12px] font-semibold text-muted">{t("origin.platform")}</p>
              <p className="font-semibold">{report.earliestRecord.sourcePlatform || t("origin.unknown")}</p>
            </div>
          </div>
          <div className="rounded-xl border border-line bg-surface p-3.5">
            <p className="text-[12px] font-semibold text-muted">{t("origin.spread")}</p>
            <p className="text-[14px]" lang={report.lang}>{report.spreadPattern}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-3.5">
            <p className="text-[12px] font-semibold text-muted">{t("origin.summary")}</p>
            <p className="whitespace-pre-line text-[14px]" lang={report.lang}>
              {report.summary}
            </p>
          </div>
          {report.groundingSources.length > 0 && (
            <div className="space-y-1">
              <p className="text-[12px] font-semibold text-muted">{t("origin.links")}</p>
              <ul>
                {report.groundingSources.map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-between gap-2 text-[14px] text-brand-ink underline underline-offset-[5px]">
                      <span className="truncate">{s.title || s.url}</span>
                      <Icon name="ext" size={12} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="rounded-lg bg-paper p-3 text-[12px] text-muted" lang={report.lang}>
            {report.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}

/** «Where did it spread from?»: the public-archive search for a claim, in a dialog (a sheet on phones). */
export function OriginTrackerDrawer({ open, onClose, claimQuery }: Props) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onClose={onClose} title={t("origin.title")} placement="bottom">
      <OriginBody key={claimQuery} claimQuery={claimQuery} />
    </Dialog>
  );
}
