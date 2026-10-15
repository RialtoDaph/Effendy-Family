"use client";

import { useAppData } from "@/components/app-data";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { Switch } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { EmptyNote, PrivateMark } from "@/components/ui";
import { eur, eurSigned, plural, recurringDate, recurringState, shortDate, type RecurringState } from "@/lib/money";
import { ModuleTabs } from "./module-tabs";
import { PageHeader } from "./page-header";

const STATE_STYLE: Record<RecurringState, string> = {
  added: "bg-okbg text-ok",
  due: "bg-warnbg text-warnt",
  next: "bg-soft2 text-mut",
  paused: "bg-soft2 text-mut",
};

export function RecurringScreen() {
  const { recurring, categories, incomes, today, save, reload } = useMoney();
  const fin = useFinance();
  // Recurring payments that belong to a subscription are edited there (they stay in step).
  const subOf = (id: string) => fin.subscriptions.find((x) => x.recurring_id === id);
  const { members } = useAppData();
  const { openForm } = useMoneyForms();
  const toast = useToast();

  const active = recurring.filter((r) => r.active);
  const out = active.filter((r) => r.amount < 0);
  const inc = active.filter((r) => r.amount > 0);
  // Planned income (Budget → Incomes) that is not posted automatically yet.
  const posted = new Set(recurring.filter((r) => r.amount > 0).map((r) => r.name.trim().toLowerCase()));
  const notPosted = incomes.filter((i) => !posted.has(i.name.trim().toLowerCase()));
  const plannedIncome = incomes.reduce((a, i) => a + i.monthly_amount, 0);
  const upcoming = active
    .filter((r) => r.last_posted_month !== today.ym)
    .map((r) => ({ r, date: recurringDate(r, today) }))
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  async function toggle(id: string, on: boolean) {
    const sub = subOf(id);
    const err = sub
      ? await fin.save("subscriptions", { status: on ? "active" : "cancelled", cancelled_on: on ? null : today.iso }, sub.id)
      : await save("recurring", { active: on }, id);
    if (err) toast(err);
    else if (sub) void reload();
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <PageHeader eyebrow="Money" title="Recurring" />
        <ModuleTabs module="money" active="recur" />
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        <div className="rounded-xl border border-line bg-card p-[18px]">
          <div className="text-[12.5px] text-mut">Goes out every month</div>
          <div className="text-[34px] font-black tracking-[-0.02em]">{eur(-out.reduce((a, r) => a + r.amount, 0), 0)}</div>
          <div className="text-xs text-mut2">{plural(out.length, "payment")}</div>
        </div>
        <div className="rounded-xl border border-line bg-card p-[18px]">
          <div className="text-[12.5px] text-mut">Comes in every month</div>
          <div className="text-[34px] font-black tracking-[-0.02em] text-ok">
            {eur(inc.length ? inc.reduce((a, r) => a + r.amount, 0) : plannedIncome, 0)}
          </div>
          <div className="text-xs text-mut2">
            {inc.length
              ? `${plural(inc.length, "income")} posted automatically`
              : incomes.length
                ? `${plural(incomes.length, "income source")} · planned, not posted automatically`
                : "No income added yet"}
          </div>
        </div>
        <div className="rounded-xl bg-inv p-[18px] text-white">
          <div className="text-[12.5px] text-white/60">Next up</div>
          <div className="mt-1.5 text-xl font-extrabold leading-tight">{upcoming?.r.name ?? "Nothing planned"}</div>
          {upcoming && (
            <div className="mt-1 text-[13px] font-bold text-acc2">
              {shortDate(upcoming.date)} · {eurSigned(upcoming.r.amount)}
            </div>
          )}
        </div>
      </div>

      <section className="rounded-[10px] border border-line bg-card px-5 pb-1 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 pt-3">
          <div>
            <h2 className="m-0 text-lg font-extrabold">Every month</h2>
            <div className="mt-[3px] text-[12.5px] text-mut">Added to your transactions on their day. Switch one off to skip it.</div>
          </div>
          <button
            onClick={() => openForm("recur")}
            className="h-11 whitespace-nowrap rounded-full border-0 bg-inv px-[18px] text-[13.5px] font-extrabold text-white"
          >
            + Add recurring
          </button>
        </div>
        {recurring.map((r) => {
          const state = recurringState(r, today);
          const date = shortDate(recurringDate(r, today));
          const label = { added: `Added ${date}`, due: `Due ${date}`, next: `Next ${date}`, paused: "Paused" }[state];
          const cat = categories.find((c) => c.id === r.category_id);
          const payer = members.find((m) => m.id === r.paid_by);
          return (
            <div
              key={r.id}
              className={`flex items-center gap-3 border-t border-line py-3.5 ${r.visibility === "private" ? "border-dashed" : ""}`}
              style={{ opacity: r.active ? 1 : 0.55 }}
            >
              <div className="flex h-12 w-11 flex-none flex-col items-center justify-center rounded-[10px] bg-soft2 leading-none">
                <span className="text-lg font-black">{r.day_of_month}</span>
                <span className="mt-[3px] font-mono text-[10.5px] font-bold text-mut">EACH</span>
              </div>
              <button
                onClick={() => (subOf(r.id) ? openForm("sub", subOf(r.id)!.id) : openForm("recur", r.id))}
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left"
              >
                <div className="truncate text-[14.5px] font-extrabold text-ink">{r.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${STATE_STYLE[state]}`}>{label}</span>
                  <span className="text-xs text-mut2">
                    {cat?.name ?? (r.amount > 0 ? "Income" : "No category")} · {payer?.display_name ?? "Family"}
                  </span>
                  {subOf(r.id) && <span className="rounded-full bg-tint px-2 py-0.5 text-[11px] font-extrabold text-acct">Subscription</span>}
                  {r.visibility === "private" && <PrivateMark />}
                </div>
              </button>
              <span className={`whitespace-nowrap text-[15px] font-black ${r.amount > 0 ? "text-ok" : "text-ink"}`}>
                {eurSigned(r.amount)}
              </span>
              <button
                onClick={() => toggle(r.id, !r.active)}
                aria-label={`Switch ${r.name} ${r.active ? "off" : "on"}`}
                aria-pressed={r.active}
                className="flex-none border-0 bg-transparent p-0"
              >
                <Switch on={r.active} />
              </button>
            </div>
          );
        })}
        {!recurring.length && (
          <div className="pb-4">
            <EmptyNote>Add rent, insurance, phone, salaries… once. They are added to the budget on their day each month.</EmptyNote>
          </div>
        )}
      </section>
      {notPosted.length > 0 && (
        <section className="rounded-[10px] border border-line bg-card px-5 pb-1 pt-2">
          <div className="pb-2 pt-3">
            <h2 className="m-0 text-lg font-extrabold">Income not posted automatically</h2>
            <div className="mt-[3px] text-[12.5px] text-mut">
              These are in your income list (Budget), so the plan counts them, but they only show up as money in once a transaction is added.
              Post them here to have them added on their day each month.
            </div>
          </div>
          {notPosted.map((i) => (
            <div key={i.id} className="flex items-center gap-3 border-t border-line py-3.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-extrabold text-ink">{i.name}</div>
                <div className="mt-0.5 text-xs text-mut2">
                  {i.kind} · {members.find((m) => m.id === i.member_id)?.display_name ?? "Family"}
                </div>
              </div>
              <span className="whitespace-nowrap text-[15px] font-black text-ok">{eurSigned(i.monthly_amount)}</span>
              <button
                onClick={() =>
                  openForm("recur", undefined, {
                    kind: "in",
                    name: i.name,
                    amount: String(i.monthly_amount),
                    day: "1",
                    paid_by: i.member_id ?? "family",
                    category: "",
                    visibility: i.visibility,
                  })
                }
                className="min-h-10 whitespace-nowrap rounded-full border-0 bg-tint px-3.5 text-[12.5px] font-extrabold text-acct"
              >
                Post monthly
              </button>
            </div>
          ))}
        </section>
      )}
      <p className="m-0 text-[12.5px] text-mut2">
        Nothing is paid for you — this only records what your bank already does, so the budget stays right without typing it
        every month.
      </p>
    </>
  );
}
