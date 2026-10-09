"use client";

import { useAppData } from "@/components/app-data";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { Card, EmptyNote, H2, OwnerPill, PrivateMark, ProgressBar, Segmented } from "@/components/ui";
import { payoffPlan } from "@/lib/finance";
import { AppIcon } from "@/lib/icons";
import { addMonthsLabel, eur } from "@/lib/money";
import { ModuleTabs } from "./module-tabs";
import { PageHeader } from "./page-header";

export function DebtsScreen() {
  const { debts, debtSettings, setDebtSettings } = useFinance();
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
  const freeBy = Number.isFinite(plan.months) ? addMonthsLabel(today, plan.months) : "never at this rate";
  const savedMonths = Number.isFinite(base.months) && Number.isFinite(plan.months) ? base.months - plan.months : 0;

  return (
    <>
      <div className="flex flex-col gap-3">
        <PageHeader eyebrow="Money" title="Debts" />
        <ModuleTabs module="money" active="debts" />
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        <div className="rounded-xl border border-line bg-card p-[18px]">
          <div className="text-[12.5px] text-mut">Total debt</div>
          <div className="text-[34px] font-black tracking-[-0.02em]">{eur(total, 0)}</div>
          <div className="text-xs text-mut2">
            {family.length} debts · {original > 0 ? Math.round(((original - total) / original) * 100) : 0}% paid off
          </div>
        </div>
        <div className="rounded-xl border border-line bg-card p-[18px]">
          <div className="text-[12.5px] text-mut">Monthly payments</div>
          <div className="text-[34px] font-black tracking-[-0.02em]">{eur(monthly + extra, 0)}</div>
          <div className="text-xs text-mut2">{extra ? `incl. ${eur(extra)} extra` : "minimums only"}</div>
        </div>
        <div className="rounded-xl bg-inv p-[18px] text-white">
          <div className="text-[12.5px] text-white/60">Debt-free by</div>
          <div className="mt-1 text-[28px] font-black tracking-[-0.02em]">{family.length ? freeBy : "—"}</div>
          <div className="text-xs font-bold text-acc2">
            {savedMonths > 0
              ? `${savedMonths} months sooner · ${eur(base.interest - plan.interest)} less interest`
              : family.length
                ? `${eur(plan.interest)} interest in total`
                : "No debts"}
          </div>
        </div>
      </div>

      {mine.length > 0 && (
        <div className="text-[12.5px] text-mut">
          Your private debts ({eur(mine.reduce((a, d) => a + d.balance, 0))}) are listed below but not in the family numbers.
        </div>
      )}

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <H2>Payoff plan</H2>
            <div className="mt-1 text-[12.5px] text-mut">
              {debtSettings.strategy === "avalanche"
                ? "Avalanche: extra money goes to the highest interest first. Saves the most."
                : "Snowball: extra money goes to the smallest debt first. Quick wins."}
            </div>
          </div>
          <Segmented
            options={[
              { value: "avalanche", label: "Avalanche" },
              { value: "snowball", label: "Snowball" },
            ]}
            value={debtSettings.strategy}
            onChange={(v) => setDebtSettings({ strategy: v as "avalanche" | "snowball" })}
          />
        </div>
        <label className="flex flex-col gap-2">
          <span className="flex justify-between text-[13px] font-bold">
            <span className="text-mut">Extra per month</span>
            <span>{eur(extra)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={400}
            step={10}
            value={extra}
            onChange={(e) => setDebtSettings({ extra_per_month: Number(e.target.value) })}
            className="h-11 w-full accent-[var(--acc)]"
          />
        </label>
        <div className="flex flex-col gap-3">
          {plan.order.map((o, i) => {
            const d = family.find((x) => x.id === o.id)!;
            return (
              <div key={o.id} className="flex items-center gap-3">
                <span className="w-5 flex-none text-center font-mono text-xs font-bold text-mut2">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2 text-[13px]">
                    <span className="truncate font-bold">{d.name}</span>
                    <span className="whitespace-nowrap text-mut">paid off {addMonthsLabel(today, o.month)}</span>
                  </div>
                  <div className="mt-1.5">
                    <ProgressBar pct={(o.month / Math.max(1, plan.months)) * 100} color={i === 0 ? "var(--acc)" : "var(--acc2)"} />
                  </div>
                </div>
              </div>
            );
          })}
          {!family.length && <EmptyNote>No debts. Nice.</EmptyNote>}
          {family.length > 0 && !Number.isFinite(plan.months) && (
            <div className="rounded-[10px] bg-badbg px-3.5 py-3 text-[13px] font-bold text-bad">
              The payments do not cover the interest. Raise a monthly payment or add extra.
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="mb-1.5 flex items-center justify-between gap-2.5">
          <H2>Your debts</H2>
          <button
            onClick={() => openForm("debt")}
            className="h-11 whitespace-nowrap rounded-full border-0 bg-inv px-[18px] text-[13.5px] font-extrabold text-white"
          >
            + Add debt
          </button>
        </div>
        {[...family, ...mine].map((d) => {
          const paid = Math.max(d.original, d.balance) > 0 ? ((Math.max(d.original, d.balance) - d.balance) / Math.max(d.original, d.balance)) * 100 : 0;
          return (
            <button
              key={d.id}
              onClick={() => openForm("debt", d.id)}
              className={`flex w-full items-center gap-3 border-0 border-b border-line bg-transparent py-3.5 text-left ${
                d.visibility === "private" ? "border-dashed" : ""
              }`}
            >
              <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[13px] bg-soft text-ink">
                <AppIcon name={d.icon} size={20} strokeWidth={1.7} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-bold text-ink">{d.name}</span>
                  <span className="whitespace-nowrap text-sm font-black text-ink">{eur(d.balance)}</span>
                </div>
                <div className="mt-1.5">
                  <ProgressBar pct={paid} color="var(--ok)" />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mut2">
                  <span>
                    {d.lender ? `${d.lender} · ` : ""}
                    {d.rate_pct}% · {eur(d.monthly_payment)}/mo
                  </span>
                  <OwnerPill member={members.find((m) => m.id === d.member_id)} />
                  {d.visibility === "private" && <PrivateMark />}
                </div>
              </div>
            </button>
          );
        })}
      </Card>
    </>
  );
}
