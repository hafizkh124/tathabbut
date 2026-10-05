"use client";
import React from "react";
import { useI18n } from "@/lib/i18n/i18n";
import type { Key } from "@/lib/i18n/dict";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";

export type ErrorKind = "network" | "pictureNetwork" | "tooLong" | "read" | "ocr" | "noText" | "badImage";
const BODY: Record<ErrorKind, Key> = { network: "error.network", pictureNetwork: "error.network", tooLong: "error.tooLong", read: "error.read", ocr: "error.ocr", noText: "error.noText", badImage: "error.badImage" };
/** Errors about a picture have no text to keep: the only way on is back to choose another. */
const PICTURE: ErrorKind[] = ["pictureNetwork", "ocr", "noText", "badImage"];

export function ErrorView({ kind, text, onRetry, onEdit }: { kind: ErrorKind; text: string; onRetry: () => void; onEdit: () => void }) {
  const { t } = useI18n();
  const picture = PICTURE.includes(kind);
  return (
    <div className="space-y-4">
      <div role="alert" className="space-y-3 rounded-3xl border-[1.5px] p-5" style={{ background: "var(--t-veryWeak-bg)", color: "var(--t-veryWeak-fg)", borderColor: "var(--t-veryWeak-bd)" }}>
        <p className="flex items-center gap-2 text-lg font-bold">
          <span>{t("error.title")}</span>
          <Icon name="bang" size={22} />
        </p>
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
            {kind !== "tooLong" && (
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
