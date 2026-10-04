"use client";
import React, { useEffect, useId, useRef } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { Icon } from "./Icon";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** centre of the screen, or a sheet that rises from the bottom (phones) */
  placement?: "center" | "bottom";
  children: React.ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/** A real dialog: role + aria-modal, Escape closes, Tab stays inside, and focus returns to where it came from. */
export function Dialog({ open, onClose, title, placement = "center", children }: DialogProps) {
  const { t } = useI18n();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const node = panel.current;
    node?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const bottom = placement === "bottom";

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-black/55 animate-fade-in ${bottom ? "items-end justify-center" : "items-center justify-center p-4"}`}
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={`flex w-full flex-col bg-surface text-ink shadow-2xl animate-sheet-up ${
          bottom ? "max-h-[92vh] rounded-t-3xl border-t border-line" : "max-h-[88vh] max-w-xl rounded-3xl border border-line"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 id={titleId} className="text-lg font-bold text-brand-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("action.close")}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-paper hover:text-ink cursor-pointer"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
