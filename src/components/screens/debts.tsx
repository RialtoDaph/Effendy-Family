"use client";

import { useTranslations } from "next-intl";
import { useAppData } from "@/components/app-data";
import { ModuleEmpty } from "@/components/empty-state";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useLabel } from "@/components/nav-label";
import { Card, H2, OwnerPill, PrivateMark, Segmented } from "@/components/ui";
import { payoffPlan } from "@/lib/finance";
import { AppIcon } from "@/lib/icons";
import { eur } from "@/lib/money";
import { useDates } from "@/lib/use-dates";
import { ModuleHeader } from "./module-tabs";

const STAT = "rounded-xl border border-line bg-card px-[18px] py-4";
const STAT_NUM = "mt-1 font-serif text-[42px] font-normal tabular-nums tracking-[-0.01em]";

export function DebtsScreen() {
  const tm = useTranslations("money");
  const dates = useDates();
  const label = useLabel();
  const { debts, debtSettings, setDebtSettings, loaded } = useFinance();
  const { today } = useMoney();
  const { members, userId } = useAppData();
  const { openForm } = useMoneyForms();

  const family = debts.filter((d) => d.visibility === "family");
  const mine = debts.filter((d) => d.visibility === "private" && d.owner_id === userId);
  const total = family.reduce((a, d) => a + d.balance, 0);
  const original = family.reduce((a, d) => a + Math.max(d.original, d.balance), 0);
  const monthly = family.reduce((a, d) => a + d.monthly_payment, 0);
  const extra = debtSettings.extra_per_month;
  const plan = payoffPlan(family, debtSettings.strategy, extra);
  const base = payoffPlan(family, debtSettings.strategy, 0);
  const canFinish = Number.isFinite(plan.months);
  const savedMonths = Number.isFinite(base.months) && canFinish ? base.months - plan.months : 0;
  const paidPct = original > 0 ? Math.round(((original - total) / original) * 100) : 0;
  const payoffOf = new Map(plan.order.map((o) => [o.id, o.month]));

  if (loaded && !debts.length) {
    return (
      <>
        <ModuleHeader module="money" active="debts" />
        <ModuleEmpty screen="debts" eyebrow={label("nav.debts")} onAction={() => openForm("debt")} />
      </>
    );
  }

  return (
    <>
      <ModuleHeader module="money" active="debts" />

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))]">
        <div className={STAT}>
          <div className="text-[12.5px] text-mut">{tm("total_debt")}</div>
          <div className={STAT_NUM}>{eur(total, 0)}</div>
          <div className="text-xs text-mut2">{tm("debts_count", { n: family.length, pct: paidPct })}</div>
        </div>
        <div className={STAT}>
          <div className="text-[12.5px] text-mut">{tm("monthly_payments")}</div>
          <div className={STAT_NUM}>{eur(monthly, 0)}</div>
          <div className="text-xs text-mut2">{tm("debts_extra", { extra: eur(extra) })}</div>
        </div>
        <div className={STAT}>
          <div className="text-[12.5px] text-mut">{tm("debt_free_by")}</div>
          <div className={STAT_NUM}>{!family.length ? "—" : canFinish ? dates.addMonths(today, plan.months) : tm("never_at_this_rate")}</div>
          <div className="text-xs font-bold text-ok">
            {savedMonths > 0 ? tm("debts_saved", { n: savedMonths, interest: eur(base.interest - plan.interest) }) : ""}
          </div>
        </div>
      </div>

      {mine.length > 0 && <div className="text-[12.5px] text-mut">{tm("debts_private", { total: eur(mine.reduce((a, d) => a + d.balance, 0)) })}</div>}

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <H2>{tm("payoff_plan")}</H2>
            <div className="mt-[3px] text-[12.5px] text-mut">{tm("interest_left", { interest: eur(plan.interest) })}</div>
          </div>
          <Segmented
            options={[
              { value: "avalanche", label: tm("avalanche") },
              { value: "snowball", label: tm("snowball") },
            ]}
            value={debtSettings.strategy}
            onChange={(v) => setDebtSettings({ strategy: v as "avalanche" | "snowball" })}
          />
        </div>
        <div className="text-[13px] leading-normal text-mut [text-wrap:pretty]">
          {debtSettings.strategy === "avalanche" ? tm("avalanche_note") : tm("snowball_note")}
        </div>
        <label className="flex flex-wrap items-center gap-3.5">
          <span className="min-w-[150px] text-[13.5px] font-bold">
            {tm("extra_per_month")} · <span className="font-mono">{eur(extra)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={400}
            step={10}
            value={extra}
            onChange={(e) => setDebtSettings({ extra_per_month: Number(e.target.value) })}
            className="h-11 min-w-[180px] flex-1 accent-[var(--acc)]"
          />
        </label>
        <div className="flex flex-col gap-2.5">
          {plan.order.map((o, i) => {
            const d = family.find((x) => x.id === o.id)!;
            return (
              <div key={o.id} className="grid items-center gap-3 text-[13px] [grid-template-columns:minmax(0,170px)_minmax(0,1fr)_84px]">
                <span className="truncate font-bold">
                  {i + 1} · {d.name}
                </span>
                <div className="h-2.5 overflow-hidden rounded-full bg-soft2">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(o.month / Math.max(1, plan.months)) * 100}%`, background: i === 0 ? "var(--acc)" : "var(--acc2)" }}
                  />
                </div>
                <span className="text-right font-mono text-xs text-mut">{dates.addMonths(today, o.month)}</span>
              </div>
            );
          })}
          {family.length > 0 && !canFinish && <div className="rounded-[10px] bg-badbg px-3.5 py-3 text-[13px] font-bold text-bad">{tm("payments_too_low")}</div>}
        </div>
      </Card>

      <Card>
        <div className="mb-1.5 flex items-center justify-between gap-2.5">
          <H2>{tm("your_debts")}</H2>
          <button onClick={() => openForm("debt")} className="hit44 min-h-10 flex-none whitespace-nowrap rounded-full border-0 bg-acc px-4 text-[13px] font-bold text-onacc">
            {tm("add_debt")}
          </button>
        </div>
        {[...family, ...mine].map((d) => {
          const start = Math.max(d.original, d.balance);
          const paid = start > 0 ? Math.round(((start - d.balance) / start) * 100) : 0;
          const month = payoffOf.get(d.id);
          return (
            <button
              key={d.id}
              onClick={() => openForm("debt", d.id)}
              className={`flex w-full flex-col gap-2.5 rounded-lg border-0 border-b border-line bg-transparent px-1 py-3.5 text-left hover:bg-soft ${
                d.visibility === "private" ? "border-dashed" : ""
              }`}
            >
              <span className="flex w-full items-center gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-soft text-ink">
                  <AppIcon name={d.icon} size={19} strokeWidth={1.7} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-bold text-ink">{d.name}</span>
                  <span className="block text-xs text-mut2">
                    {d.lender ? `${d.lender} · ` : ""}
                    {tm("debt_meta", { pay: eur(d.monthly_payment), rate: d.rate_pct })}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-[17px] font-bold text-ink">{eur(d.balance)}</span>
                  {month != null && Number.isFinite(month) && <span className="block text-[11.5px] text-mut2">{tm("paid_off_when", { date: dates.addMonths(today, month) })}</span>}
                </span>
              </span>
              <span className="flex w-full items-center gap-2.5">
                <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-soft2">
                  <span className="block h-full rounded-full bg-ink" style={{ width: `${paid}%` }} />
                </span>
                <span className="min-w-[72px] text-right font-mono text-[11.5px] text-mut">{tm("pct_paid", { pct: paid })}</span>
                <OwnerPill member={members.find((m) => m.id === d.member_id)} />
                {d.visibility === "private" && <PrivateMark />}
              </span>
            </button>
          );
        })}
      </Card>
    </>
  );
}
