"use client";

import { useTranslations } from "next-intl";
import { useAppData } from "@/components/app-data";
import { ModuleEmpty } from "@/components/empty-state";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useLabel } from "@/components/nav-label";
import { Switch } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { PrivateMark } from "@/components/ui";
import { isUnused, subscriptionTotals } from "@/lib/finance";
import { eur, eurSigned, recurringDate, recurringState, type RecurringState } from "@/lib/money";
import { QUEUED } from "@/lib/offline-queue";
import { useDates } from "@/lib/use-dates";
import { ModuleHeader } from "./module-tabs";

const STATE_STYLE: Record<RecurringState, string> = {
  added: "bg-okbg text-ok",
  due: "bg-warnbg text-warnt",
  next: "bg-soft2 text-mut",
  paused: "bg-soft2 text-mut",
};

const LOGO_COLORS = ["var(--inv)", "#B1060F", "#1D6F42", "#2A4B8D", "#5B616E", "#7A3E9D", "#B3541E"];
const logoColor = (name: string) => LOGO_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % LOGO_COLORS.length];

const STAT = "rounded-xl border border-line bg-card p-[18px]";
const STAT_NUM = "font-serif text-[44px] font-normal tabular-nums tracking-[-0.01em]";
const ADD = "min-h-10 flex-none whitespace-nowrap rounded-full border-0 bg-acc px-4 text-[13px] font-bold text-onacc hit44";

export function RecurringScreen() {
  const tm = useTranslations("money");
  const dates = useDates();
  const label = useLabel();
  const { recurring, categories, incomes, today, loaded, save } = useMoney();
  const { subscriptions } = useFinance();
  const { members } = useAppData();
  const { openForm } = useMoneyForms();
  const toast = useToast();

  const monthly = recurring.filter((r) => !r.is_subscription);
  const active = recurring.filter((r) => r.active);
  const out = active.filter((r) => r.amount < 0);
  const inc = active.filter((r) => r.amount > 0);
  // Planned income (Budget → Incomes) that is not posted automatically yet.
  const posted = new Set(recurring.filter((r) => r.amount > 0).map((r) => r.name.trim().toLowerCase()));
  const notPosted = incomes.filter((i) => !posted.has(i.name.trim().toLowerCase()));
  const plannedIncome = incomes.reduce((a, i) => a + i.monthly_amount, 0);
  const subTotals = subscriptionTotals(subscriptions);
  const unusedMonthly = subscriptions.filter((s) => isUnused(s, today.iso)).reduce((a, s) => a + s.monthly_price, 0);
  const subRows = subscriptions
    .map((s) => ({ s, unused: isUnused(s, today.iso), stopped: s.status === "cancelled" }))
    .sort((a, b) => Number(b.unused || b.stopped) - Number(a.unused || a.stopped));
  const memberName = (id: string | null) => members.find((m) => m.id === id)?.display_name ?? tm("family");

  async function setActive(id: string, on: boolean) {
    const err = await save("recurring", { active: on }, id);
    if (err && err !== QUEUED) toast(err);
  }

  async function setSubscription(id: string, on: boolean) {
    const err = await save("recurring", { active: on, cancelled_on: on ? null : today.iso }, id);
    if (err && err !== QUEUED) toast(err);
  }

  if (loaded && !recurring.length) {
    return (
      <>
        <ModuleHeader module="money" active="recur" />
        <ModuleEmpty screen="recur" eyebrow={label("nav.recurring_subscriptions")} onAction={() => openForm("recur")} />
      </>
    );
  }

  return (
    <>
      <ModuleHeader module="money" active="recur" />

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))]">
        <div className={STAT}>
          <div className="text-[12.5px] text-mut">{tm("goes_out_every_month")}</div>
          <div className={STAT_NUM}>{eur(-out.reduce((a, r) => a + r.amount, 0), 0)}</div>
          <div className="text-xs text-mut2">
            {tm("rc_payments", { n: out.length, added: out.filter((r) => r.last_posted_month === today.ym).length })}
          </div>
        </div>
        <div className={STAT}>
          <div className="text-[12.5px] text-mut">{tm("comes_in_every_month")}</div>
          <div className={`${STAT_NUM} text-ok`}>+{eur(inc.length ? inc.reduce((a, r) => a + r.amount, 0) : plannedIncome, 0)}</div>
          <div className="text-xs text-mut2">
            {inc.length ? inc.map((r) => r.name.split(" · ")[0]).join(", ") : incomes.length ? tm("rc_in_planned", { n: incomes.length }) : tm("rc_in_none")}
          </div>
        </div>
        <div className={STAT}>
          <div className="text-[12.5px] text-mut">{tm("unused_subscriptions")}</div>
          <div className={`${STAT_NUM} text-acct`}>{eur(unusedMonthly)}</div>
          <div className="text-xs text-mut2">{tm("rc_unused_note")}</div>
        </div>
      </div>

      <section className="rounded-[18px] border border-line bg-card px-5 pb-1 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 pt-3">
          <div>
            <h2 className="m-0 text-lg font-bold">{tm("every_month")}</h2>
            <div className="mt-[3px] text-[12.5px] text-mut">{tm("every_month_note")}</div>
          </div>
          <button onClick={() => openForm("recur")} className={ADD}>
            {tm("add_recurring")}
          </button>
        </div>
        {monthly.map((r) => {
          const state = recurringState(r, today);
          const date = dates.short(recurringDate(r, today));
          const cat = categories.find((c) => c.id === r.category_id);
          return (
            <div
              key={r.id}
              className={`flex items-center gap-3 border-t border-line py-3.5 ${r.visibility === "private" ? "border-dashed" : ""}`}
              style={{ opacity: r.active ? 1 : 0.55 }}
            >
              <div className="flex h-12 w-11 flex-none flex-col items-center justify-center rounded-[10px] bg-soft2 leading-none">
                <span className="text-lg font-bold">{r.day_of_month}</span>
                <span className="mt-[3px] font-mono text-[10.5px] font-bold uppercase text-mut">{tm("each")}</span>
              </div>
              <button onClick={() => openForm("recur", r.id)} className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left">
                <div className="truncate text-[14.5px] font-bold text-ink">{r.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${STATE_STYLE[state]}`}>{tm(`rc_state_${state}`, { date })}</span>
                  <span className="text-xs text-mut2">
                    {cat?.name ?? (r.amount > 0 ? tm("income") : tm("no_category"))} · {memberName(r.paid_by)}
                  </span>
                  {r.visibility === "private" && <PrivateMark />}
                </div>
              </button>
              <span className={`whitespace-nowrap text-[15px] font-bold tabular-nums ${r.amount > 0 ? "text-ok" : "text-ink"}`}>{eurSigned(r.amount)}</span>
              <button
                onClick={() => setActive(r.id, !r.active)}
                aria-label={tm("switch_on_off", { name: r.name })}
                aria-pressed={r.active}
                className="hit44 flex-none border-0 bg-transparent p-0"
              >
                <Switch on={r.active} />
              </button>
            </div>
          );
        })}
      </section>

      <section data-screen-label="Money · Subscriptions" className="rounded-[18px] border border-line bg-card px-5 pb-1 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line pb-2 pt-3">
          <div>
            <h2 className="m-0 text-lg font-bold">{tm("subscriptions")}</h2>
            <div className="mt-[3px] text-[12.5px] text-mut">
              {tm("subs_summary", { n: subTotals.activeCount, monthly: eur(subTotals.monthly), saved: eur(subTotals.savedYearly, 0) })}
            </div>
          </div>
          <button onClick={() => openForm("sub")} className={ADD}>
            {tm("add_subscription")}
          </button>
        </div>
        {subRows.map(({ s, unused, stopped }) => (
          <div
            key={s.id}
            className={`flex flex-wrap items-center gap-3 border-b border-line py-3.5 last:border-b-0 ${s.visibility === "private" ? "border-dashed" : ""}`}
            style={{ opacity: stopped ? 0.6 : 1 }}
          >
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-[15px] font-bold text-white" style={{ background: logoColor(s.name) }}>
              {s.name[0]?.toUpperCase()}
            </span>
            <button onClick={() => openForm("sub", s.id)} className="min-w-[160px] flex-1 border-0 bg-transparent p-0 text-left">
              <span className="flex flex-wrap items-center gap-2">
                <span className={`text-[14.5px] font-bold text-ink ${stopped ? "line-through" : ""}`}>{s.name}</span>
                <span className="rounded-full bg-soft2 px-2 py-0.5 text-[11px] font-bold text-mut">{memberName(s.for_whom)}</span>
                {s.visibility === "private" && <PrivateMark />}
              </span>
              <span className={`mt-[3px] block text-[12.5px] ${stopped ? "text-ok" : unused ? "text-acct" : "text-mut"}`}>
                {stopped
                  ? tm("sub_stopped", { date: dates.short(s.cancelled_on ?? today.iso) })
                  : s.last_used_at
                    ? `${unused ? "⚠ " : ""}${tm("sub_last_used", { date: dates.short(s.last_used_at) })}`
                    : tm("sub_charged_on", { day: s.day_of_month })}
              </span>
            </button>
            <span className="whitespace-nowrap text-[15px] font-bold tabular-nums">{eur(s.monthly_price, 2)}</span>
            {(unused || stopped) && (
              <button
                onClick={() => setSubscription(s.id, stopped)}
                className={`hit44 min-h-10 rounded-full border px-3.5 text-[12.5px] font-bold ${stopped ? "border-line bg-card text-ink" : "border-ink bg-inv text-white"}`}
              >
                {stopped ? tm("undo") : tm("cancel")}
              </button>
            )}
          </div>
        ))}
      </section>

      {notPosted.length > 0 && (
        <section className="rounded-[18px] border border-line bg-card px-5 pb-1 pt-2">
          <div className="pb-2 pt-3">
            <h2 className="m-0 text-lg font-bold">{tm("income_not_posted")}</h2>
            <div className="mt-[3px] text-[12.5px] text-mut">{tm("income_not_posted_note")}</div>
          </div>
          {notPosted.map((i) => (
            <div key={i.id} className="flex items-center gap-3 border-t border-line py-3.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-bold text-ink">{i.name}</div>
                <div className="mt-0.5 text-xs text-mut2">
                  {tm(`income_kind_${i.kind}`)} · {memberName(i.member_id)}
                </div>
              </div>
              <span className="whitespace-nowrap text-[15px] font-bold tabular-nums text-ok">{eurSigned(i.monthly_amount)}</span>
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
                className="hit44 min-h-10 whitespace-nowrap rounded-full border-0 bg-tint px-3.5 text-[12.5px] font-bold text-acct"
              >
                {tm("post_monthly")}
              </button>
            </div>
          ))}
        </section>
      )}
      <p className="m-0 text-[12.5px] text-mut2 [text-wrap:pretty]">{tm("recur_footer")}</p>
    </>
  );
}
