"use client";

import Link from "next/link";
import { useState } from "react";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { Card, EmptyNote, H2, Segmented } from "@/components/ui";
import { addMonthsLabel, eur } from "@/lib/money";
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
  const { incomes, categories, goals, today } = useMoney();
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

  const expenses = [
    ...subscriptions.filter((s) => s.status === "active").map((s) => ({ id: `s-${s.id}`, name: s.name, amount: s.monthly_price, kind: "subscription" })),
    ...categories.filter((c) => !c.is_fixed && c.monthly_limit > 0).map((c) => ({ id: `c-${c.id}`, name: c.name, amount: c.monthly_limit, kind: "budget" })),
  ];

  return (
    <>
      <PageHeader eyebrow="Tools" title="What if" />

      <div className="rounded-[10px] bg-inv p-5 text-white">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Every month, with these changes</div>
        <div className="mt-2 text-[44px] font-black leading-none tracking-[-0.03em]">{signed(freed)}</div>
        <div className="mt-2 text-[13px] text-white/70">
          {signed(freed * 12)} a year
          {investMonthly !== 0 && ` · investing ${signed(investMonthly)} a month adds about ${eur(tenYears)} in 10 years at ${ret}%`}
        </div>
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))]">
        <Card className="flex flex-col gap-4">
          <H2>Change something</H2>
          <Slider
            label="Move unplanned money into a goal"
            value={w.extra}
            min={0}
            max={Math.max(0, unplanned, w.extra)}
            step={10}
            display={`${eur(w.extra)}/mo`}
            hint={unplanned > 0 ? `${eur(unplanned)} a month has no job yet (income − budget − goal savings).` : "All income is already planned in the budget and goals."}
            onChange={(extra) => setW((s) => ({ ...s, extra }))}
          />
          <Slider
            label="Studio income change"
            value={w.incomeChange}
            min={-1000}
            max={1500}
            step={50}
            display={`${signed(w.incomeChange)}/mo`}
            hint={`After about ${w.taxPct}% tax: ${signed(w.incomeChange * (1 - w.taxPct / 100))} a month`}
            onChange={(incomeChange) => setW((s) => ({ ...s, incomeChange }))}
          />
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-bold text-mut">Tax on extra income</span>
            <Segmented
              options={[20, 30, 40].map((t) => ({ value: t, label: `${t}%` }))}
              value={w.taxPct}
              onChange={(taxPct) => setW((s) => ({ ...s, taxPct }))}
            />
          </div>
          <Slider
            label="Invest more (or less) each month"
            value={w.investDelta}
            min={-500}
            max={1000}
            step={25}
            display={`${signed(w.investDelta)}/mo`}
            hint="Comes out of the money above."
            onChange={(investDelta) => setW((s) => ({ ...s, investDelta }))}
          />
          <Slider
            label="Yearly return (for investing)"
            value={ret}
            min={2}
            max={9}
            step={0.5}
            display={`${ret}%`}
            hint="World ETFs have averaged roughly 5–7% a year over long periods. Not a promise."
            onChange={setRet}
          />
        </Card>

        <Card className="flex flex-col gap-3">
          <H2>Stop one expense</H2>
          {!expenses.length && <EmptyNote>Add subscriptions or budget categories to try this.</EmptyNote>}
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
                  {e.kind === "budget" ? " budget" : ""}
                </button>
              );
            })}
          </div>
          <div className="mt-1 text-[12.5px] font-bold text-mut">Freed money goes to</div>
          <div className="flex flex-wrap gap-1.5">
            {[...familyGoals.map((g) => ({ id: g.id, name: g.name })), { id: "invest", name: "Investing" }].map((g) => (
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
        </Card>
      </div>

      <Card className="flex flex-col gap-1">
        <H2 className="mb-1">Goal dates</H2>
        {changes.map(({ goal, before, after }) => {
          const diff = before != null && after != null ? before - after : null;
          return (
            <div key={goal.id} className="flex items-center gap-3 border-t border-line py-3">
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold">{goal.name}</div>
                <div className="font-mono text-xs text-mut">
                  {before == null ? "no date yet" : before === 0 ? "reached" : addMonthsLabel(today, before)}
                  {touched && goal.id === goalId && (
                    <> → {after == null ? "no date" : after === 0 ? "reached" : addMonthsLabel(today, after)}</>
                  )}
                </div>
              </div>
              {touched && goal.id === goalId && diff != null && diff !== 0 && (
                <span className={`rounded-full px-2.5 py-1 text-[12px] font-extrabold ${diff > 0 ? "bg-okbg text-ok" : "bg-warnbg text-warnt"}`}>
                  {Math.abs(diff)} months {diff > 0 ? "sooner" : "later"}
                </span>
              )}
              {touched && goal.id === goalId && before == null && after != null && (
                <span className="rounded-full bg-okbg px-2.5 py-1 text-[12px] font-extrabold text-ok">now has a date</span>
              )}
            </div>
          );
        })}
        {!changes.length && <EmptyNote>Add goals with a target and a monthly amount to see their dates move.</EmptyNote>}
        <div className="pt-2 text-xs text-mut2">
          Nothing is changed in your budget. To keep a change, edit the goal or budget, or see the <Link href="/sim" className="font-bold text-acct">10-year simulation</Link>.
        </div>
      </Card>
    </>
  );
}
