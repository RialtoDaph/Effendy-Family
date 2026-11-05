"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAppData } from "@/components/app-data";
import { useMoney } from "@/components/money-data";
import { useAlertText } from "@/components/screens/home";
import { Segmented } from "@/components/ui";
import type { AlertArea, Severity } from "@/lib/money";
import { supabase } from "@/lib/supabase";

const GROUPS: { sev: Severity; label: "al_urgent" | "al_soon" | "al_info"; dot: string }[] = [
  { sev: "urgent", label: "al_urgent", dot: "var(--bad)" },
  { sev: "soon", label: "al_soon", dot: "var(--warn)" },
  { sev: "info", label: "al_info", dot: "var(--line2)" },
];

export function AlertsScreen() {
  const t = useTranslations("tools");
  const text = useAlertText();
  const router = useRouter();
  const { alerts, alertsState, closeAlert, reload } = useMoney();
  const { userId } = useAppData();
  const [filter, setFilter] = useState<"all" | AlertArea>("all");

  const shown = alerts.filter((a) => filter === "all" || a.area === filter);
  const open = alerts.filter((a) => a.sev !== "info").length;
  const closedCount = alertsState.length;

  async function restore() {
    await supabase().from("alerts_state").delete().eq("member_id", userId);
    await reload();
  }

  return (
    <div className="flex max-w-[860px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">{t("al_eyebrow")}</div>
          <h1 className="m-0 mt-1.5 text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em] wide:text-[30px]">
            {open ? t("al_need", { n: open }) : t("al_calm")}
          </h1>
          <p className="m-0 mt-1.5 text-[13.5px] text-mut">{t("al_sub")}</p>
        </div>
        <div className="max-w-full overflow-x-auto">
          <Segmented
            options={[
              { value: "all", label: t("al_all") },
              { value: "money", label: t("al_money") },
              { value: "goals", label: t("al_goals") },
            ]}
            value={filter}
            onChange={(v) => setFilter(v as "all" | AlertArea)}
          />
        </div>
      </div>

      {GROUPS.map((g) => {
        const items = shown.filter((a) => a.sev === g.sev);
        if (!items.length) return null;
        return (
          <section key={g.sev} className="rounded-[18px] border border-line bg-card px-5 py-1.5">
            <div className="flex items-center gap-2 pb-1 pt-3">
              <span className="h-2 w-2 rounded-full" style={{ background: g.dot }} />
              <span className="font-mono text-[11px] font-bold uppercase tracking-[.16em] text-mut">{t(g.label)}</span>
              <span className="text-[11.5px] text-mut2">{items.length}</span>
            </div>
            {items.map((a, i) => (
              <div
                key={a.key}
                className={`flex flex-wrap-reverse items-start gap-x-3 gap-y-1 py-3.5 ${i < items.length - 1 ? "border-b border-line" : ""}`}
              >
                <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="text-[15px] font-bold">{text(a).title}</span>
                    <span className="font-mono text-[11px] font-bold uppercase tracking-[.08em] text-mut2">{t(`al_${a.area}`)}</span>
                  </div>
                  <div className="text-[13px] leading-[1.45] text-mut">{text(a).meta}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => router.push(a.href)}
                      className="min-h-11 whitespace-nowrap rounded-full border-0 bg-tint px-3.5 text-[13px] font-extrabold text-acct"
                    >
                      {text(a).cta}
                    </button>
                    <button
                      onClick={() => closeAlert(a.key, "dismissed")}
                      className="min-h-11 whitespace-nowrap rounded-full border border-line bg-card px-3.5 text-[13px] font-bold text-mut"
                    >
                      {t("al_dismiss")}
                    </button>
                  </div>
                </div>
                <span className={`flex-none whitespace-nowrap pt-0.5 text-xs font-bold ${a.sev === "urgent" ? "text-bad" : "text-mut2"}`}>
                  {a.when.key === "in_days" ? t("in_days", { n: a.when.n }) : t(a.when.key)}
                </span>
              </div>
            ))}
          </section>
        );
      })}

      {!shown.length && (
        <section className="rounded-[18px] border border-line bg-card px-5 py-9 text-center">
          <div className="text-lg font-extrabold">{t("al_clear")}</div>
          <div className="mt-1.5 text-[13.5px] text-mut">{t("al_clear_sub")}</div>
        </section>
      )}

      {closedCount > 0 && (
        <button onClick={restore} className="self-start border-0 bg-transparent py-1.5 text-[12.5px] font-extrabold text-mut">
          {t("al_restore", { n: closedCount })}
        </button>
      )}
    </div>
  );
}
