"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppData } from "@/components/app-data";
import { useMoney } from "@/components/money-data";
import { Segmented } from "@/components/ui";
import type { AlertArea, Severity } from "@/lib/money";
import { supabase } from "@/lib/supabase";

const GROUPS: { sev: Severity; label: string; dot: string }[] = [
  { sev: "urgent", label: "Needs attention", dot: "var(--bad)" },
  { sev: "soon", label: "Coming up", dot: "var(--warn)" },
  { sev: "info", label: "Good to know", dot: "var(--line2)" },
];

const AREA_LABEL: Record<AlertArea, string> = { money: "Money", time: "Time", goals: "Goals" };

export function AlertsScreen() {
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
          <div className="eyebrow">Alert center</div>
          <h1 className="m-0 mt-1.5 text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em] wide:text-[30px]">
            {open ? `${open} thing${open > 1 ? "s" : ""} need${open > 1 ? "" : "s"} you` : "All calm"}
          </h1>
          <p className="m-0 mt-1.5 text-[13.5px] text-mut">Built from your budget, bills and goals. Updates as you add data.</p>
        </div>
        <div className="max-w-full overflow-x-auto">
          <Segmented
            options={[
              { value: "all", label: "All" },
              { value: "money", label: "Money" },
              { value: "goals", label: "Goals" },
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
          <section key={g.sev} className="rounded-[10px] border border-line bg-card px-5 py-1.5">
            <div className="flex items-center gap-2 pb-1 pt-3">
              <span className="h-2 w-2 rounded-full" style={{ background: g.dot }} />
              <span className="font-mono text-[11px] font-bold uppercase tracking-[.16em] text-mut">{g.label}</span>
              <span className="text-[11.5px] text-mut2">{items.length}</span>
            </div>
            {items.map((a, i) => (
              <div
                key={a.key}
                className={`flex flex-wrap-reverse items-start gap-x-3 gap-y-1 py-3.5 ${i < items.length - 1 ? "border-b border-line" : ""}`}
              >
                <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="text-[15px] font-bold">{a.title}</span>
                    <span className="font-mono text-[11px] font-bold uppercase tracking-[.08em] text-mut2">{AREA_LABEL[a.area]}</span>
                  </div>
                  <div className="text-[13px] leading-[1.45] text-mut">{a.meta}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => router.push(a.href)}
                      className="min-h-11 whitespace-nowrap rounded-full border-0 bg-tint px-3.5 text-[13px] font-extrabold text-acct"
                    >
                      {a.cta}
                    </button>
                    <button
                      onClick={() => closeAlert(a.key, "dismissed")}
                      className="min-h-11 whitespace-nowrap rounded-full border border-line bg-card px-3.5 text-[13px] font-bold text-mut"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                <span className={`flex-none whitespace-nowrap pt-0.5 text-xs font-bold ${a.sev === "urgent" ? "text-bad" : "text-mut2"}`}>
                  {a.when}
                </span>
              </div>
            ))}
          </section>
        );
      })}

      {!shown.length && (
        <section className="rounded-[10px] border border-line bg-card px-5 py-9 text-center">
          <div className="text-lg font-extrabold">All clear</div>
          <div className="mt-1.5 text-[13.5px] text-mut">Nothing needs attention right now.</div>
        </section>
      )}

      {closedCount > 0 && (
        <button onClick={restore} className="self-start border-0 bg-transparent py-1.5 text-[12.5px] font-extrabold text-mut">
          Show {closedCount} dismissed again
        </button>
      )}
    </div>
  );
}
