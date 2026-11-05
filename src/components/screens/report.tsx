"use client";

import { Printer } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAppData } from "@/components/app-data";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { useFinance } from "@/components/finance-data";
import { useLabel } from "@/components/nav-label";
import { useMoney } from "@/components/money-data";
import { useTime } from "@/components/time-data";
import { Segmented } from "@/components/ui";
import { businessStats, subscriptionTotals } from "@/lib/finance";
import { budgetSummary, emergencyFund, eur, type Today } from "@/lib/money";
import { goalStatus, monthShifts } from "@/lib/time";
import { useDates } from "@/lib/use-dates";

/** A Today for the last day of a month (or the real today for the current month). */
function monthEnd(ym: string, today: Today): Today {
  if (ym === today.ym) return today;
  const [y, m] = ym.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { y, m, d: days, iso: `${ym}-${String(days).padStart(2, "0")}`, ym, daysInMonth: days };
}

function prevYm(today: Today) {
  return today.m === 1 ? `${today.y - 1}-12` : `${today.y}-${String(today.m - 1).padStart(2, "0")}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-[18px] border border-line bg-card p-5 print:p-3">
      <h2 className="m-0 mb-3 text-[17px] font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ k, v, strong = false }: { k: ReactNode; v: ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-t border-line py-1.5 text-[13px]">
      <span className="text-mut">{k}</span>
      <span className={`text-right font-mono ${strong ? "font-black" : "font-bold"}`}>{v}</span>
    </div>
  );
}

export function ReportScreen() {
  const tt = useTranslations("t");
  const r_ = useTranslations("tools");
  const fmt = useDates();
  const navLabel = useLabel();
  const money = useMoney();
  const fin = useFinance();
  const time = useTime();
  const { members, household, settings } = useAppData();
  const options = [prevYm(money.today), money.today.ym];
  const [picked, setYm] = useState<string | null>(null);
  const ym = picked && options.includes(picked) ? picked : options[0];
  const t = monthEnd(ym, money.today);
  const label = fmt.monthFull(ym);

  // Family view only: private items are never in the report.
  const txs = money.transactions.filter((x) => x.visibility === "family" && x.date.startsWith(ym));
  const income = txs.filter((x) => x.amount > 0).reduce((a, x) => a + x.amount, 0);
  const spent = -txs.filter((x) => x.amount < 0).reduce((a, x) => a + x.amount, 0);
  const plannedIncome = money.incomes.filter((i) => i.visibility === "family").reduce((a, i) => a + i.monthly_amount, 0);
  const budget = budgetSummary(money.categories, txs, t, settings?.warn_pct ?? 80);
  const ef = emergencyFund(money.goals.filter((g) => g.visibility === "family"), money.categories, settings?.ef_months ?? 6);
  const payees = new Map<string, number>();
  for (const x of txs) if (x.amount < 0) payees.set(x.payee, (payees.get(x.payee) ?? 0) - x.amount);
  const topPayees = [...payees.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const subs = subscriptionTotals(fin.subscriptions.filter((s) => s.visibility === "family"));
  const debts = fin.debts.filter((d) => d.visibility === "family").reduce((a, d) => a + d.balance, 0);
  const remit = fin.remittances.filter((r) => r.visibility === "family" && r.date.startsWith(ym));
  const bizMonths = fin.businessMonths.filter((b) => b.visibility === "family" && b.month === ym);

  const famEvents = time.events.filter((e) => e.visibility === "family");
  const shiftsByMember = members.map((m) => ({ m, ...monthShifts(famEvents.filter((e) => e.owner_id === m.id), ym) })).filter((s) => s.count > 0);
  const gym = members.map((m) => ({ m, n: time.gym.filter((g) => g.visibility === "family" && g.owner_id === m.id && g.date.startsWith(ym)).length }));
  const learn = members.map((m) => ({
    m,
    min: time.learningMinutes.filter((l) => l.visibility === "family" && l.owner_id === m.id && l.date.startsWith(ym)).reduce((a, l) => a + l.minutes, 0),
  }));
  const dates = time.dateNights.filter((d) => d.visibility === "family" && d.date.startsWith(ym));
  const ygoals = time.yearlyGoals.filter((g) => g.visibility === "family" && g.year === t.y);

  if (money.loaded && !money.transactions.length) {
    return (
      <EmptyState eyebrow={navLabel("nav.monthly_report")} title={tt("e_report")}>
        <Link href="/setup" className="flex min-h-[46px] items-center rounded-full bg-acc px-5 text-sm font-bold text-onacc hover:text-onacc">
          {tt("b_setup")}
        </Link>
      </EmptyState>
    );
  }

  return (
    <div data-report className="flex flex-col gap-4">
      <div data-noprint className="flex flex-wrap items-center gap-2">
        <Segmented options={options.map((o) => ({ value: o, label: fmt.monthLong(Number(o.slice(5))) }))} value={ym} onChange={setYm} />
        <button onClick={() => window.print()} className="ml-auto flex min-h-11 items-center gap-2 rounded-full border-0 bg-acc px-5 text-sm font-extrabold text-onacc">
          <Printer size={17} /> {r_("re_pdf")}
        </button>
      </div>
      <div data-noprint className="text-xs text-mut2">
        {r_("re_pdf_note")}
      </div>

      <header>
        <div className="eyebrow">{r_("re_eyebrow", { name: household?.name ?? "rideff Life" })}</div>
        <h1 className="m-0 mt-1.5 text-[30px] font-extrabold tracking-[-0.02em]">{label}</h1>
        <div className="mt-1 text-[13px] text-mut">
          {ym === money.today.ym ? r_("re_sofar", { date: fmt.short(money.today.iso) }) : r_("re_whole")}
          {r_("re_family")}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 print:gap-2">
        {[
          [r_("re_in"), eur(income)],
          [r_("re_out"), eur(spent)],
          [r_("re_left"), eur(income - spent)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[10px] bg-inv p-3.5 text-white">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/60">{k}</div>
            <div className="mt-1 text-[22px] font-black tracking-[-0.02em]">{v}</div>
          </div>
        ))}
      </div>

      {plannedIncome > 0 && (
        <div className="rounded-[10px] border border-line bg-soft px-4 py-3 text-[13px] leading-normal text-mut">
          {r_.rich("re_planned", { planned: eur(plannedIncome), booked: eur(income), b: (c) => <b className="text-ink">{c}</b> })}
          {income < plannedIncome * 0.9 && r_("re_unbooked", { amount: eur(plannedIncome - income) })}
        </div>
      )}

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))] print:grid-cols-2">
        <Section title={r_("re_budget")}>
          <Row k={r_("re_flex")} v={r_("re_of", { a: eur(budget.flexSpent), b: eur(budget.flexLimit) })} strong />
          {budget.rows
            .filter((r) => r.cat.monthly_limit > 0 || r.spent > 0)
            .map((r) => (
              <Row key={r.cat.id} k={`${r.cat.name} · ${r_(`st_${r.status}`)}`} v={`${eur(r.spent)} / ${eur(r.cat.monthly_limit)}`} />
            ))}
        </Section>

        <Section title={r_("re_where")}>
          {topPayees.map(([p, v]) => (
            <Row key={p} k={p} v={eur(v)} />
          ))}
          {!topPayees.length && <div className="text-[13px] text-mut">{r_("re_nospend")}</div>}
          <Row k={r_("re_subs")} v={r_("re_permonth", { amount: eur(subs.monthly) })} />
        </Section>

        <Section title={r_("re_savings")}>
          <Row k={r_("re_net")} v={eur(fin.worth.net)} strong />
          <Row k={r_("re_owned")} v={eur(fin.worth.assets)} />
          <Row k={r_("re_debts")} v={eur(debts)} />
          {ef.goal && <Row k={r_("re_ef")} v={r_("re_months", { a: ef.months.toFixed(1), b: ef.target })} />}
          {money.goals
            .filter((g) => g.visibility === "family" && !g.is_emergency_fund && g.target > 0)
            .map((g) => (
              <Row key={g.id} k={g.name} v={r_("re_of", { a: eur(g.current), b: eur(g.target) })} />
            ))}
        </Section>

        {(bizMonths.length > 0 || remit.length > 0) && (
          <Section title={r_("re_biz")}>
            {bizMonths.map((b) => {
              const biz = fin.businesses.find((x) => x.id === b.business_id);
              return <Row key={b.id} k={biz?.name ?? r_("re_business")} v={r_("re_inprofit", { rev: eur(b.revenue), profit: eur(b.revenue - b.costs) })} />;
            })}
            {fin.businesses.length > 0 && bizMonths.length === 0 && <div className="text-[13px] text-mut">{r_("re_nobiz")}</div>}
            {remit.length > 0 && (
              <Row
                k={r_("re_sent", { n: remit.length })}
                v={`${eur(remit.reduce((a, r) => a + r.eur, 0))} · Rp ${remit.reduce((a, r) => a + r.idr_received, 0).toLocaleString("id-ID")}`}
              />
            )}
            {fin.businesses.map((b) => {
              const s = businessStats(fin.businessMonths.filter((m) => m.business_id === b.id && m.visibility === "family"));
              return s.months > 0 ? <Row key={b.id} k={r_("re_last", { name: b.name, n: s.months })} v={r_("re_profit", { amount: eur(s.perMonth) })} /> : null;
            })}
          </Section>
        )}

        <Section title={r_("re_goals")}>
          {ygoals.map((g) => {
            const st = goalStatus(g, t.iso);
            return <Row key={g.id} k={g.name} v={`${st.pct}% · ${r_(`gs_${st.status}`)}`} />;
          })}
          {!ygoals.length && <div className="text-[13px] text-mut">{r_("re_nogoals")}</div>}
        </Section>

        <Section title={r_("re_time")}>
          {shiftsByMember.map(({ m, count, hours }) => (
            <Row key={m.id} k={r_("re_shifts", { name: m.display_name })} v={`${count} · ${Math.round(hours)} h`} />
          ))}
          {gym.map(({ m, n }) => (
            <Row key={m.id} k={r_("re_gym", { name: m.display_name })} v={r_("re_sessions", { n })} />
          ))}
          {learn.map(({ m, min }) => (
            <Row key={m.id} k={r_("re_learn", { name: m.display_name })} v={`${Math.round(min / 6) / 10} h`} />
          ))}
          <Row k={r_("re_dates")} v={dates.length ? `${dates.length} · ${eur(dates.reduce((a, d) => a + (d.cost ?? 0), 0))}` : "0"} />
        </Section>
      </div>

      <footer className="text-xs text-mut2">
        {r_("re_footer", { date: fmt.full(money.today.iso) })}
      </footer>
    </div>
  );
}
