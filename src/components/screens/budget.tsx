"use client";

import Link from "next/link";
import { Camera } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAppData } from "@/components/app-data";
import { ModuleEmpty } from "@/components/empty-state";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useLabel } from "@/components/nav-label";
import {
  AddButton,
  Card,
  EmptyNote,
  H2,
  OwnerPill,
  PrivateMark,
  Segmented,
  StatusPill,
  statusBarColor,
} from "@/components/ui";
import { AppIcon } from "@/lib/icons";
import { eur, eurSigned } from "@/lib/money";
import { useDates } from "@/lib/use-dates";
import { ModuleHeader } from "./module-tabs";

export function BudgetScreen() {
  const tm = useTranslations("money");
  const dates = useDates();
  const label = useLabel();
  const money = useMoney();
  const { budget, today } = money;
  const { openForm } = useMoneyForms();

  if (money.loaded && !money.categories.length && !money.incomes.length) {
    return (
      <>
        <ModuleHeader module="money" active="budget" />
        <ModuleEmpty screen="budget" eyebrow={label("nav.budget")} onAction={() => openForm("income")} />
      </>
    );
  }

  return (
    <>
      <ModuleHeader module="money" active="budget" />

      <Hero />

      <div className="grid items-stretch gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
        <EmergencyFundCard />
        <WarningsCard />
      </div>

      <IncomePlan />
      <Incomes />

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr))]">
        <Categories monthPct={budget.monthPct} />
        <LatestTransactions />
      </div>

      {!money.loaded && <div className="text-center text-[13px] text-mut2">{tm("loading_month", { month: dates.monthLong(today.m) })}</div>}
    </>
  );
}

function Hero() {
  const tm = useTranslations("money");
  const dates = useDates();
  const { budget, today, transactions } = useMoney();
  const { userId } = useAppData();
  const myPrivate = transactions
    .filter((t) => t.visibility === "private" && t.owner_id === userId && t.date.startsWith(today.ym) && t.amount < 0)
    .reduce((a, t) => a - t.amount, 0);

  return (
    <section className="relative overflow-hidden rounded-[18px] bg-inv p-6 text-white">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="font-mono text-[11px] font-bold uppercase tracking-[.16em] text-acc2">
            {tm("hero_day", { month: dates.monthLong(today.m), day: today.d, days: today.daysInMonth })}
          </div>
          <div className="mt-3 text-[13px] text-white/60">{tm("flexible_money_left")}</div>
          <div className="mt-1 font-serif text-[68px] font-normal leading-none tabular-nums tracking-[-0.01em]">{eur(budget.flexLeft, 0)}</div>
          <div className="mt-2 text-sm text-white/75">
            {tm.rich("per_day_line", {
              amount: eur(budget.perDay, 0),
              n: budget.daysLeft,
              b: (chunks) => <b className="text-white">{chunks}</b>,
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <HeroStat label={tm("spent_so_far")} value={eur(budget.spent, 0)} />
          <HeroStat label={tm("monthly_budget")} value={eur(budget.limit, 0)} />
        </div>
      </div>
      {myPrivate > 0 && (
<div className="mt-4 text-[12.5px] text-white/60">{tm("budget_private", { total: eur(myPrivate) })}</div>
      )}
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-white/10 bg-white/[.06] px-4 py-3">
      <div className="text-[11px] text-white/55">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function EmergencyFundCard() {
  const tm = useTranslations("money");
  const dates = useDates();
  const { ef, efMonths, setSetting, today } = useMoney();
  const { openForm } = useMoneyForms();
  const scale = Math.max(6, ef.target);
  const pct = (m: number) => `${Math.min(100, (m / scale) * 100)}%`;
  const statusText = ef.status === "full" ? tm("ef_full") : ef.status === "minimum" ? tm("ef_minimum") : tm("ef_below");
  const eta = ef.goal && ef.goal.monthly > 0 && ef.remaining > 0 ? Math.ceil(ef.remaining / ef.goal.monthly) : null;

  return (
    <Card className="flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <H2>{tm("emergency_fund")}</H2>
          <div className="mt-1 text-[12.5px] text-mut">{tm("ef_saved", { saved: eur(ef.saved), month: eur(ef.monthlyBudget) })}</div>
        </div>
        <span
          className={`flex-none rounded-full px-[9px] py-[3px] text-[11px] font-extrabold ${
            ef.status === "below" ? "bg-badbg text-bad" : "bg-okbg text-ok"
          }`}
        >
          {statusText}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-serif text-[52px] font-normal leading-none tracking-[-0.01em]">{(Math.floor(ef.months * 10) / 10).toFixed(1)}</span>
        <span className="text-sm font-bold text-mut">{tm("months_covered")}</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-soft2">
        <div className="h-full rounded-full bg-acc" style={{ width: pct(ef.months) }} />
        <span className="absolute -top-1 h-[18px] w-0.5 bg-ink" style={{ left: pct(3) }} />
        <span className="absolute -top-1 h-[18px] w-0.5 bg-ink" style={{ left: `calc(${pct(ef.target)} - 2px)` }} />
      </div>
      <div className="flex justify-between font-mono text-[11.5px] text-mut2">
        <span>0</span>
        <span>{tm("ef_scale", { target: ef.target })}</span>
      </div>
      <div className="text-[13px] leading-normal">
        {ef.remaining <= 0
          ? tm("ef_reached")
          : eta
            ? tm("ef_eta", { left: eur(ef.remaining), target: ef.target, monthly: eur(ef.goal!.monthly), date: dates.addMonths(today, eta) })
            : tm("ef_no_eta", { left: eur(ef.remaining), target: ef.target })}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] font-bold text-mut">{tm("target")}</span>
        <Segmented
          options={[3, 4, 6].map((m) => ({ value: m, label: tm("n_mo", { n: m }) }))}
          value={efMonths}
          onChange={(m) => setSetting({ ef_months: m })}
        />
        {ef.goal && (
          <button
            onClick={() => openForm("goal", ef.goal!.id)}
            className="ml-auto min-h-10 flex-none whitespace-nowrap rounded-full border-0 bg-tint px-3.5 text-[12.5px] font-extrabold text-acct"
          >
            {tm("update_fund")}
          </button>
        )}
      </div>
    </Card>
  );
}

function WarningsCard() {
  const tm = useTranslations("money");
  const { budget, warnPct, setSetting } = useMoney();
  const { openForm } = useMoneyForms();
  const flagged = budget.rows
    .filter((r) => !r.cat.is_fixed && r.cat.monthly_limit > 0 && r.pct >= warnPct)
    .sort((a, b) => b.pct - a.pct);

  return (
    <Card className="flex flex-col gap-3.5">
      <div>
        <H2>{tm("budget_warnings")}</H2>
        <div className="mt-1 text-[12.5px] text-mut">{tm("budget_warnings_note")}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] font-bold text-mut">{tm("warn_me_at")}</span>
        <Segmented
          options={[70, 80, 90].map((p) => ({ value: p, label: `${p}%` }))}
          value={warnPct}
          onChange={(p) => setSetting({ warn_pct: p })}
        />
      </div>
      <div className="flex flex-col">
        {flagged.map((r) => {
          const over = r.status === "over";
          return (
            <button
              key={r.cat.id}
              onClick={() => openForm("cat", r.cat.id)}
              className="flex items-center gap-2.5 border-0 border-b border-line bg-transparent py-2.5 text-left"
            >
              <span className={`h-2 w-2 flex-none rounded-full ${over ? "bg-bad" : "bg-warn"}`} />
              <span className="min-w-0 flex-1 text-sm font-bold text-ink">{r.cat.name}</span>
              <span className={`text-[13px] font-extrabold ${over ? "text-bad" : "text-ink"}`}>{Math.round(r.pct)}%</span>
            </button>
          );
        })}
        {!flagged.length && (
          <div className="rounded-[10px] bg-okbg px-3.5 py-3 text-[13px] font-bold text-ok">
            {tm("warn_none", { pct: warnPct })}
          </div>
        )}
      </div>
      <Link href="/alerts" className="hit44 mt-auto self-start py-1.5 text-[12.5px] font-bold text-acct">
        {tm("open_alert_center")}
      </Link>
    </Card>
  );
}

function IncomePlan() {
  const tm = useTranslations("money");
  const dates = useDates();
  const { incomes, goals, budget, today } = useMoney();
  const { businessMonths } = useFinance();
  const income = incomes.filter((i) => i.visibility === "family").reduce((a, i) => a + i.monthly_amount, 0);
  if (income <= 0) return null;
  const intoGoals = goals.filter((g) => g.visibility === "family").reduce((a, g) => a + g.monthly, 0);
  // What each business last set aside; rows arrive newest first.
  const latest = new Map<string, number>();
  for (const m of businessMonths) if (m.visibility === "family" && !latest.has(m.business_id)) latest.set(m.business_id, m.tax_set_aside);
  const taxPot = [...latest.values()].reduce((a, v) => a + v, 0);
  const buffer = income - taxPot - intoGoals - budget.limit;
  const parts = [
    ...(taxPot > 0 ? [{ label: tm("tax_pot"), value: taxPot, color: "var(--ink)" }] : []),
    { label: tm("goals_paid_first"), value: intoGoals, color: "var(--acc)" },
    { label: tm("monthly_budget"), value: budget.limit, color: "var(--acc2)" },
    { label: buffer >= 0 ? tm("buffer") : tm("short_by"), value: buffer, color: buffer >= 0 ? "var(--soft2)" : "var(--bad)" },
  ];

  return (
    <Card>
      <H2 className="mb-1">{tm("where_income_goes", { month: dates.monthLong(today.m), income: eur(income) })}</H2>
      <p className="m-0 mb-3.5 text-[13px] text-mut">{tm("pay_first_note")}</p>
      <div className="flex h-3.5 gap-[3px] overflow-hidden rounded-full">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <div key={p.label} style={{ flex: p.value, background: p.color }} />
          ))}
      </div>
      <div className="mt-3.5 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        {parts.map((p) => (
          <div key={p.label} className="flex items-start gap-2">
            <span className="mt-[5px] h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: p.color }} />
            <div>
              <div className="text-[12.5px] text-mut">{p.label}</div>
              <div className={`text-lg font-bold tabular-nums ${p.value < 0 ? "text-bad" : ""}`}>{eur(Math.abs(p.value))}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Incomes() {
  const tm = useTranslations("money");
  const { incomes } = useMoney();
  const { members } = useAppData();
  const { openForm } = useMoneyForms();

  return (
    <Card>
      <div className="mb-1.5 flex items-center justify-between gap-2.5">
        <H2>{tm("income_each_month")}</H2>
        <AddButton onClick={() => openForm("income")} />
      </div>
      {incomes.map((i) => (
        <button
          key={i.id}
          onClick={() => openForm("income", i.id)}
          className={`flex w-full items-center gap-3 border-0 border-b border-line bg-transparent py-3 text-left ${
            i.visibility === "private" ? "border-dashed" : ""
          }`}
        >
          <OwnerPill member={members.find((m) => m.id === i.member_id)} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-ink">{i.name}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-mut2">
              {tm(`income_kind_${i.kind}`)} · {tm("net_monthly_average")} {i.visibility === "private" && <PrivateMark />}
            </div>
          </div>
          <span className="text-[15px] font-bold tabular-nums text-ink">{eur(i.monthly_amount)}</span>
        </button>
      ))}
      {!incomes.length && <EmptyNote>{tm("incomes_empty")}</EmptyNote>}
    </Card>
  );
}

function Categories({ monthPct }: { monthPct: number }) {
  const tm = useTranslations("money");
  const { budget } = useMoney();
  const { openForm } = useMoneyForms();

  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <H2>{tm("categories")}</H2>
          <AddButton onClick={() => openForm("cat")} />
        </div>
        <span className="flex items-center gap-1.5 text-[11.5px] text-mut2">
          <span className="inline-block h-3 w-0.5 bg-acc" />
          {tm("where_today", { pct: monthPct })}
        </span>
      </div>
      <div className="flex flex-col">
        {budget.rows.map(({ cat, spent, pct, status }) => {
          return (
            <button
              key={cat.id}
              onClick={() => openForm("cat", cat.id)}
              className="border-0 border-b border-line bg-transparent py-3 text-left"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex w-6 justify-center text-ink">
                  <AppIcon name={cat.icon} size={19} strokeWidth={1.7} />
                </span>
                <span className="min-w-0 flex-1 text-sm font-bold text-ink">{cat.name}</span>
                <StatusPill status={status} />
                <span className="whitespace-nowrap text-[13px] font-bold tabular-nums text-ink">
                  {eur(spent)} <span className="font-semibold text-mut2">/ {eur(cat.monthly_limit)}</span>
                </span>
              </div>
              <div className="relative ml-[34px] mt-2 h-1.5 rounded-full bg-soft2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, pct)}%`, background: statusBarColor(status, cat.is_fixed) }}
                />
                {!cat.is_fixed && (
                  <span className="absolute -top-[3px] h-3 w-0.5 bg-acc" style={{ left: `${monthPct}%` }} />
                )}
              </div>
            </button>
          );
        })}
        {!budget.rows.length && <EmptyNote>{tm("categories_empty")}</EmptyNote>}
      </div>
    </Card>
  );
}

function LatestTransactions() {
  const tm = useTranslations("money");
  const dates = useDates();
  const { transactions, categories } = useMoney();
  const { members } = useAppData();
  const { openForm } = useMoneyForms();
  const { openFile } = useFinance();
  const [count, setCount] = useState(12);
  const shown = transactions.slice(0, count);

  return (
    <Card>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <H2>{tm("latest_transactions")}</H2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openForm("scan")}
            aria-label={tm("scan_receipt")}
            className="flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[12.5px] font-bold text-ink"
          >
            <Camera size={15} strokeWidth={2} />
            {tm("scan")}
          </button>
          <AddButton onClick={() => openForm("tx")} />
        </div>
      </div>
      {shown.map((t) => {
        const cat = categories.find((c) => c.id === t.category_id);
        const payer = members.find((m) => m.id === t.paid_by);
        return (
          <div key={t.id} className={`flex items-center gap-1 border-b border-line ${t.visibility === "private" ? "border-dashed" : ""}`}>
            <button
              onClick={() => openForm("tx", t.id)}
              className="flex min-w-0 flex-1 items-center gap-3 border-0 bg-transparent py-[11px] text-left"
            >
              <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl bg-soft text-ink">
                <AppIcon name={cat?.icon} size={19} strokeWidth={1.7} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-ink">{t.payee}</div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-mut2">
                  <span>
                    {dates.short(t.date)} · {cat?.name ?? (t.amount > 0 ? tm("income") : tm("no_category"))} · {payer?.display_name ?? tm("family")}
                    {t.source === "recurring" && ` · ${tm("recurring_tag")}`}
                  </span>
                  {t.visibility === "private" && <PrivateMark />}
                </div>
              </div>
              <span className={`text-sm font-bold tabular-nums ${t.amount > 0 ? "text-ok" : "text-ink"}`}>{eurSigned(t.amount)}</span>
            </button>
            {t.receipt_file_id && (
              <button
                onClick={() => openFile(t.receipt_file_id!)}
                aria-label={tm("receipt_photo_for", { payee: t.payee })}
                className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-0 bg-transparent text-mut"
              >
                <Camera size={17} strokeWidth={2} />
              </button>
            )}
          </div>
        );
      })}
      {!transactions.length && (
        <EmptyNote>{tm("transactions_empty")}</EmptyNote>
      )}
      {transactions.length > count && (
        <button
          onClick={() => setCount((c) => c + 20)}
          className="mt-3 min-h-11 w-full rounded-full border border-line bg-card text-[13px] font-bold text-ink"
        >
          {tm("show_more")}
        </button>
      )}
      <GoalHint />
    </Card>
  );
}

/** The one-line tip under the list (prototype: tint box). */
function GoalHint() {
  const tm = useTranslations("money");
  const { budget, today } = useMoney();
  const fast = budget.rows.find((r) => r.status === "fast" || r.status === "near");
  if (!fast) return null;
  return (
    <div className="mt-3.5 rounded-[10px] bg-tint px-3.5 py-3 text-[13px] leading-normal text-ink">
      {tm.rich("goal_hint", {
        name: fast.cat.name,
        pct: Math.round(fast.pct),
        month: budget.monthPct,
        amount: eur(Math.max(0, (fast.cat.monthly_limit - fast.spent) / Math.max(1, today.daysInMonth - today.d + 1))),
        b: (chunks) => <b>{chunks}</b>,
      })}
    </div>
  );
}
