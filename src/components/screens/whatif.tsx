"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { useFinance } from "@/components/finance-data";
import { useLabel } from "@/components/nav-label";
import { useMoney } from "@/components/money-data";
import { Card, EmptyNote, H2, Segmented } from "@/components/ui";
import { eur } from "@/lib/money";
import { useDates } from "@/lib/use-dates";
import { WHAT_IF_START, freedPerMonth, futureValue, goalChanges, unplannedPerMonth, type WhatIf } from "@/lib/plan";
import { PageHeader } from "./page-header";

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${eur(Math.abs(n))}`;

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  hint?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13.5px] font-bold">{label}</span>
        <span className="font-mono text-[14px] font-bold">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full accent-[var(--acc)]"
      />
      {hint && <span className="text-xs text-mut2">{hint}</span>}
    </label>
  );
}

export function WhatIfScreen() {
  const tt = useTranslations("t");
  const t = useTranslations("tools");
  const dates = useDates();
  const label = useLabel();
  const { incomes, categories, goals, today, loaded } = useMoney();
  const { subscriptions } = useFinance();
  const [w, setW] = useState<WhatIf>(WHAT_IF_START);
  const [ret, setRet] = useState(6);
  const [off, setOff] = useState<Record<string, number>>({});
  const familyGoals = goals.filter((g) => g.target > 0);
  const [target, setTarget] = useState<string>("");
  const goalId = target || familyGoals.find((g) => !g.is_emergency_fund)?.id || familyGoals[0]?.id || "invest";

  const unplanned = unplannedPerMonth(
    incomes.filter((i) => i.visibility === "family"),
    categories,
    goals.filter((g) => g.visibility === "family"),
  );
  const removed = Object.values(off).reduce((a, n) => a + n, 0);
  const state = { ...w, removed };
  const freed = freedPerMonth(state);
  const changes = goalChanges(familyGoals, goalId === "invest" ? null : goalId, freed);
  const investMonthly = w.investDelta + (goalId === "invest" ? freed : 0);
  const tenYears = futureValue(investMonthly, ret, 10);
  const touched = freed !== 0 || w.investDelta !== 0;
  const targets = [...familyGoals.map((g) => ({ id: g.id, name: g.name })), { id: "invest", name: t("wi_etf") }];
  const targetName = targets.find((t) => t.id === goalId)?.name ?? t("wi_etf");

  const expenses = [
    ...subscriptions.filter((s) => s.status === "active").map((s) => ({ id: `s-${s.id}`, name: s.name, amount: s.monthly_price, kind: "subscription" })),
    ...categories.filter((c) => !c.is_fixed && c.monthly_limit > 0).map((c) => ({ id: `c-${c.id}`, name: c.name, amount: c.monthly_limit, kind: "budget" })),
  ];

  if (loaded && (!incomes.length || !categories.length || !goals.length)) {
    return (
      <EmptyState eyebrow={label("nav.what_if")} title={tt("e_whatif")}>
        <Link href="/setup" className="flex min-h-[46px] items-center rounded-full bg-acc px-5 text-sm font-bold text-onacc hover:text-onacc">
          {tt("b_setup")}
        </Link>
      </EmptyState>
    );
  }

  return (
    <>
      <PageHeader eyebrow={t("tools")} title={t("wi_title")} />

      <div className="rounded-[10px] bg-inv p-5 text-white">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">{t("wi_every")}</div>
        <div className="mt-2 text-[44px] font-black leading-none tracking-[-0.03em]">{signed(freed)}</div>
        <div className="mt-2 text-[13px] text-white/70">
          {t.rich("wi_year", { amount: signed(freed * 12), target: targetName, b: (c) => <b className="text-white">{c}</b> })}
          {goalId !== "invest" && w.investDelta !== 0 && t("wi_invest_note", { amount: signed(w.investDelta) })}
          {investMonthly > 0 && t("wi_ten", { amount: eur(tenYears), pct: ret })}
        </div>
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))]">
        <Card className="flex flex-col gap-4">
          <H2>{t("wi_change")}</H2>
          <div>
            <div className="mb-1.5 text-[12.5px] font-bold text-mut">{t("wi_goes")}</div>
            <div className="flex flex-wrap gap-1.5">
              {targets.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setTarget(g.id)}
                  aria-pressed={goalId === g.id}
                  className={`min-h-10 rounded-full border px-3 text-[13px] font-bold ${goalId === g.id ? "border-ink bg-inv text-white" : "border-line bg-card text-ink"}`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
          <Slider
            label={t("wi_move", { target: targetName })}
            value={w.extra}
            min={0}
            max={Math.max(0, unplanned, w.extra)}
            step={10}
            display={t("wi_mo", { amount: eur(w.extra) })}
            hint={unplanned > 0 ? t("wi_nojob", { amount: eur(unplanned) }) : t("wi_planned")}
            onChange={(extra) => setW((s) => ({ ...s, extra }))}
          />
          <Slider
            label={t("wi_studio")}
            value={w.incomeChange}
            min={-1000}
            max={1500}
            step={50}
            display={t("wi_mo", { amount: signed(w.incomeChange) })}
            hint={t("wi_after", { pct: w.taxPct, amount: signed(w.incomeChange * (1 - w.taxPct / 100)) })}
            onChange={(incomeChange) => setW((s) => ({ ...s, incomeChange }))}
          />
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-bold text-mut">{t("wi_tax")}</span>
            <Segmented
              options={[20, 30, 40].map((p) => ({ value: p, label: `${p}%` }))}
              value={w.taxPct}
              onChange={(taxPct) => setW((s) => ({ ...s, taxPct }))}
            />
          </div>
          <Slider
            label={t("wi_invest")}
            value={w.investDelta}
            min={-500}
            max={1000}
            step={25}
            display={t("wi_mo", { amount: signed(w.investDelta) })}
            hint={goalId === "invest" ? t("wi_counted") : t("wi_taken", { target: targetName })}
            onChange={(investDelta) => setW((s) => ({ ...s, investDelta }))}
          />
          <Slider
            label={t("wi_return")}
            value={ret}
            min={2}
            max={9}
            step={0.5}
            display={`${ret}%`}
            hint={t("wi_return_hint")}
            onChange={setRet}
          />
        </Card>

        <Card className="flex flex-col gap-3">
          <H2>{t("wi_stop")}</H2>
          {!expenses.length && <EmptyNote>{t("wi_stop_empty")}</EmptyNote>}
          <div className="flex flex-wrap gap-1.5">
            {expenses.map((e) => {
              const on = e.id in off;
              return (
                <button
                  key={e.id}
                  onClick={() =>
                    setOff((o) => {
                      const next = { ...o };
                      if (on) delete next[e.id];
                      else next[e.id] = e.amount;
                      return next;
                    })
                  }
                  aria-pressed={on}
                  className={`min-h-10 rounded-full border px-3 text-[13px] font-bold ${on ? "border-acc bg-tint text-acct line-through" : "border-line bg-card text-ink"}`}
                >
                  {e.name} · {eur(e.amount)}
                  {e.kind === "budget" ? t("wi_budget") : ""}
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="flex flex-col gap-1">
        <H2 className="mb-1">{t("wi_dates")}</H2>
        {changes.map(({ goal, before, after }) => {
          const diff = before != null && after != null ? before - after : null;
          return (
            <div key={goal.id} className="flex items-center gap-3 border-t border-line py-3">
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold">{goal.name}</div>
                <div className="font-mono text-xs text-mut">
                  {before == null ? t("wi_nodate") : before === 0 ? t("wi_reached") : dates.addMonths(today, before)}
                  {touched && goal.id === goalId && (
                    <> → {after == null ? t("wi_nodate2") : after === 0 ? t("wi_reached") : dates.addMonths(today, after)}</>
                  )}
                </div>
              </div>
              {touched && goal.id === goalId && diff != null && diff !== 0 && (
                <span className={`rounded-full px-2.5 py-1 text-[12px] font-extrabold ${diff > 0 ? "bg-okbg text-ok" : "bg-warnbg text-warnt"}`}>
                  {t(diff > 0 ? "wi_sooner" : "wi_later", { n: Math.abs(diff) })}
                </span>
              )}
              {touched && goal.id === goalId && before == null && after != null && (
                <span className="rounded-full bg-okbg px-2.5 py-1 text-[12px] font-extrabold text-ok">{t("wi_hasdate")}</span>
              )}
            </div>
          );
        })}
        {!changes.length && <EmptyNote>{t("wi_goals_empty")}</EmptyNote>}
        <div className="pt-2 text-xs text-mut2">
          {t.rich("wi_note", { a: (c) => <Link href="/sim" className="hit44 font-bold text-acct">{c}</Link> })}
        </div>
      </Card>
    </>
  );
}
