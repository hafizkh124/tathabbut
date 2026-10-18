"use client";
// A result opened from its link (/r/<id>, src/app/r/[ids]/page.tsx): the same result screen as after a check, with the
// books asked again (they are not stored with the result), and an invitation to check a message of one's own.
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClaimResult } from "@/lib/clientTypes";
import { useI18n } from "@/lib/i18n/i18n";
import { applyTurath, fetchTurath, turathKindOf } from "@/lib/turathClient";
import { Header } from "./Header";
import { OriginTrackerDrawer } from "./OriginTrackerDrawer";
import { ResultsView } from "./ResultsView";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";

export function SharedView({ claims: stored }: { claims: ClaimResult[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [claims, setClaims] = useState(() => stored.map((c) => (turathKindOf(c) ? { ...c, turath: { status: "loading" as const } } : c)));
  const [selected, setSelected] = useState(0);
  const [originQuery, setOriginQuery] = useState<string | null>(null);
  const home = useCallback(() => router.push("/"), [router]);
  const closeOrigin = useCallback(() => setOriginQuery(null), []);

  // as on the home page: each claim's books land on it when they come
  useEffect(() => {
    let live = true;
    stored.forEach((c, i) => {
      const kind = turathKindOf(c);
      if (!kind) return;
      fetchTurath(c, kind).then(({ turath, patch }) => {
        if (live) setClaims((all) => all.map((x, j) => (j === i ? applyTurath(x, turath, patch) : x)));
      });
    });
    return () => {
      live = false;
    };
  }, [stored]);

  const invite = (
    <Button size="lg" onClick={home} className="rounded-2xl">
      <Icon name="check" size={20} strokeWidth={2.2} />
      <span>{t("shared.cta")}</span>
    </Button>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header onHome={home} />
      <main className="w-full flex-1">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6 lg:max-w-none lg:px-12">
          <p className="text-[14px] text-muted">{claims.length > 0 ? t("shared.banner") : t("shared.missing")}</p>
          {claims.length > 0 && <div className="hidden sm:block">{invite}</div>}
        </div>
        {claims.length > 0 ? (
          <ResultsView post="" claims={claims} selected={selected} onSelect={setSelected} onOrigin={setOriginQuery} onEdit={home} onNew={home} />
        ) : (
          <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6">{invite}</div>
        )}
        {/* on a phone the invitation comes after the result, where the reader's eye ends */}
        {claims.length > 0 && <div className="mx-auto w-full max-w-3xl px-5 pb-8 sm:hidden">{invite}</div>}
      </main>
      <OriginTrackerDrawer open={Boolean(originQuery)} onClose={closeOrigin} claimQuery={originQuery ?? ""} />
    </div>
  );
}
