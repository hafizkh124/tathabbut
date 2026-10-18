"use client";
import React from "react";
import { useI18n } from "@/lib/i18n/i18n";
import type { Key } from "@/lib/i18n/dict";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";

export type ErrorKind = "network" | "pictureNetwork" | "tooLong" | "read" | "ocr" | "noText" | "badImage" | "busy" | "busySite" | "pictureBusy" | "aiDay" | "pictureAiDay";
const BODY: Record<ErrorKind, Key> = {
  network: "error.network",
  pictureNetwork: "error.network",
  tooLong: "error.tooLong",
  read: "error.read",
  ocr: "error.ocr",
  noText: "error.noText",
  badImage: "error.badImage",
  // over the rate limit (src/lib/rateLimit.ts): this device's own, or the site's for the day
  busy: "error.busy",
  busySite: "error.busySite",
  pictureBusy: "error.busy",
  // the AI's free quota (src/lib/gemini.ts) is spent for the day
  aiDay: "error.aiDay",
  pictureAiDay: "error.aiDay",
};
/** Many people checking at once (a limit, not a fault): said calmly, on the brand's own tint, never in the error red. */
const BUSY: ErrorKind[] = ["busy", "busySite", "pictureBusy", "aiDay", "pictureAiDay"];
/** Errors about a picture have no text to keep: the only way on is back to choose another. */
const PICTURE: ErrorKind[] = ["pictureNetwork", "ocr", "noText", "badImage", "pictureBusy", "pictureAiDay"];

export function ErrorView({ kind, text, onRetry, onEdit }: { kind: ErrorKind; text: string; onRetry: () => void; onEdit: () => void }) {
  const { t } = useI18n();
  const picture = PICTURE.includes(kind);
  const busy = BUSY.includes(kind);
  return (
    <div className="space-y-4">
      <div
        role={busy ? "status" : "alert"}
        className={`space-y-3 rounded-3xl border-[1.5px] p-5 ${busy ? "border-line bg-brand-soft text-brand-ink" : ""}`}
        style={busy ? undefined : { background: "var(--t-veryWeak-bg)", color: "var(--t-veryWeak-fg)", borderColor: "var(--t-veryWeak-bd)" }}
      >
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <span>{t(busy ? "error.busyTitle" : "error.title")}</span>
          <Icon name={busy ? "history" : "bang"} size={22} />
        </h1>
        <p className="text-[15px]">{t(BODY[kind])}</p>
      </div>

      {!picture && (
        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <p className="text-[12px] font-semibold text-muted">{t("result.yourText")}</p>
          <p className="font-quran max-h-40 overflow-hidden text-[18px] leading-[2.1]" dir="auto">
            {text}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2.5 border-t border-line pt-3">
        {picture ? (
          <Button size="lg" onClick={onEdit}>
            {t("action.back")}
          </Button>
        ) : (
          <>
            {kind !== "tooLong" && kind !== "aiDay" && kind !== "busySite" && (
              <Button size="lg" onClick={onRetry}>
                {t("action.retry")}
              </Button>
            )}
            <Button variant="secondary" onClick={onEdit}>
              {t("action.edit")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
