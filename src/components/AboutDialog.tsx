"use client";
import React from "react";
import type { Key } from "@/lib/i18n/dict";
import { useI18n } from "@/lib/i18n/i18n";
import { Dialog } from "./ui/Dialog";

const SECTIONS: { h: Key; body: Key[] }[] = [
  { h: "about.s1.h", body: ["about.s1.b"] },
  { h: "about.s2.h", body: ["about.s2.1", "about.s2.2", "about.s2.3"] },
  { h: "about.s3.h", body: ["about.s3.b"] },
  { h: "about.s4.h", body: ["about.s4.b"] },
  { h: "about.s5.h", body: ["about.s5.b"] },
  { h: "about.s6.h", body: ["about.s6.b"] },
];

/** The short introduction: what the tool is, where its answers come from, who reviewed it, and what it does not do. */
export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, num } = useI18n();
  return (
    <Dialog open={open} onClose={onClose} title={t("about.title")} placement="bottom">
      <div className="space-y-5 pb-2">
        {SECTIONS.map((s) => (
          <section key={s.h}>
            <h3 className="mb-1.5 text-[15px] font-bold text-brand-ink">{t(s.h)}</h3>
            {s.body.length > 1 ? (
              <ol className="space-y-1 text-[15px] leading-7">
                {s.body.map((k, i) => (
                  <li key={k} className="flex gap-2">
                    <span aria-hidden="true" className="w-5 flex-none text-brand-ink">
                      {num(i + 1)}.
                    </span>
                    <span>{t(k)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[15px] leading-7">{t(s.body[0])}</p>
            )}
          </section>
        ))}
      </div>
    </Dialog>
  );
}
