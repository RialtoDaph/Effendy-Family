"use client";

import { Printer } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAppData } from "@/components/app-data";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { useTime } from "@/components/time-data";
import { Segmented } from "@/components/ui";
import { businessStats, subscriptionTotals } from "@/lib/finance";
import { MONTHS_LONG, STATUS_LABEL, budgetSummary, emergencyFund, eur, type Today } from "@/lib/money";
import { GOAL_STATUS_LABEL, goalStatus, monthShifts } from "@/lib/time";

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
    <section className="break-inside-avoid rounded-[10px] border border-line bg-card p-5 print:p-3">
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
  const money = useMoney();
  const fin = useFinance();
  const time = useTime();
  const { members, household, settings } = useAppData();
  const options = [prevYm(money.today), money.today.ym];
  const [picked, setYm] = useState<string | null>(null);
  const ym = picked && options.includes(picked) ? picked : options[0];
  const t = monthEnd(ym, money.today);
  const label = `${MONTHS_LONG[t.m - 1]} ${t.y}`;

  // Family view only: private items are never in the report.
  const txs = money.transactions.filter((x) => x.visibility === "family" && x.date.startsWith(ym));
  const income = txs.filter((x) => x.amount > 0).reduce((a, x) => a + x.amount, 0);
  const spent = -txs.filter((x) => x.amount < 0).reduce((a, x) => a + x.amount, 0);
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

  return (
    <div data-report className="flex flex-col gap-4">
      <div data-noprint className="flex flex-wrap items-center gap-2">
        <Segmented options={options.map((o) => ({ value: o, label: MONTHS_LONG[Number(o.slice(5)) - 1] }))} value={ym} onChange={setYm} />
        <button onClick={() => window.print()} className="ml-auto flex min-h-11 items-center gap-2 rounded-full border-0 bg-acc px-5 text-sm font-extrabold text-onacc">
          <Printer size={17} /> Save as PDF
        </button>
      </div>
      <div data-noprint className="text-xs text-mut2">
        In the print window, choose “Save as PDF” and paper size A4. Private items are never in the report.
      </div>

      <header>
        <div className="eyebrow">{household?.name ?? "Effendy Family"} · Monthly report</div>
        <h1 className="m-0 mt-1.5 text-[30px] font-extrabold tracking-[-0.02em]">{label}</h1>
        <div className="mt-1 text-[13px] text-mut">
          {ym === money.today.ym ? `So far, up to ${money.today.d} ${MONTHS_LONG[t.m - 1]}` : "Whole month"} · family view
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 print:gap-2">
        {[
          ["Money in", eur(income)],
          ["Money out", eur(spent)],
          ["Left over", eur(income - spent)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[10px] bg-inv p-3.5 text-white">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/60">{k}</div>
            <div className="mt-1 text-[22px] font-black tracking-[-0.02em]">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))] print:grid-cols-2">
        <Section title="Budget">
          <Row k="Flexible money" v={`${eur(budget.flexSpent)} of ${eur(budget.flexLimit)}`} strong />
          {budget.rows
            .filter((r) => r.cat.monthly_limit > 0 || r.spent > 0)
            .map((r) => (
              <Row key={r.cat.id} k={`${r.cat.name} · ${STATUS_LABEL[r.status]}`} v={`${eur(r.spent)} / ${eur(r.cat.monthly_limit)}`} />
            ))}
        </Section>

        <Section title="Where the money went">
          {topPayees.map(([p, v]) => (
            <Row key={p} k={p} v={eur(v)} />
          ))}
          {!topPayees.length && <div className="text-[13px] text-mut">No spending recorded.</div>}
          <Row k="Subscriptions (active)" v={`${eur(subs.monthly)} / month`} />
        </Section>

        <Section title="Savings & net worth">
          <Row k="Net worth" v={eur(fin.worth.net)} strong />
          <Row k="Owned" v={eur(fin.worth.assets)} />
          <Row k="Debts left" v={eur(debts)} />
          {ef.goal && <Row k="Emergency fund" v={`${ef.months.toFixed(1)} of ${ef.target} months`} />}
          {money.goals
            .filter((g) => g.visibility === "family" && !g.is_emergency_fund && g.target > 0)
            .map((g) => (
              <Row key={g.id} k={g.name} v={`${eur(g.current)} of ${eur(g.target)}`} />
            ))}
        </Section>

        {(bizMonths.length > 0 || remit.length > 0) && (
          <Section title="Business & transfers home">
            {bizMonths.map((b) => {
              const biz = fin.businesses.find((x) => x.id === b.business_id);
              return <Row key={b.id} k={biz?.name ?? "Business"} v={`${eur(b.revenue)} in · ${eur(b.revenue - b.costs)} profit`} />;
            })}
            {fin.businesses.length > 0 && bizMonths.length === 0 && <div className="text-[13px] text-mut">No business month entered yet.</div>}
            {remit.length > 0 && (
              <Row
                k={`Sent to Indonesia (${remit.length}×)`}
                v={`${eur(remit.reduce((a, r) => a + r.eur, 0))} · Rp ${remit.reduce((a, r) => a + r.idr_received, 0).toLocaleString("id-ID")}`}
              />
            )}
            {fin.businesses.map((b) => {
              const s = businessStats(fin.businessMonths.filter((m) => m.business_id === b.id && m.visibility === "family"));
              return s.months > 0 ? <Row key={b.id} k={`${b.name}, last ${s.months} months`} v={`${eur(s.perMonth)} profit / month`} /> : null;
            })}
          </Section>
        )}

        <Section title="Goals this year">
          {ygoals.map((g) => {
            const st = goalStatus(g, t.iso);
            return <Row key={g.id} k={g.name} v={`${st.pct}% · ${GOAL_STATUS_LABEL[st.status]}`} />;
          })}
          {!ygoals.length && <div className="text-[13px] text-mut">No yearly goals yet.</div>}
        </Section>

        <Section title="Time & life">
          {shiftsByMember.map(({ m, count, hours }) => (
            <Row key={m.id} k={`${m.display_name}: bar shifts`} v={`${count} · ${Math.round(hours)} h`} />
          ))}
          {gym.map(({ m, n }) => (
            <Row key={m.id} k={`${m.display_name}: gym`} v={`${n} sessions`} />
          ))}
          {learn.map(({ m, min }) => (
            <Row key={m.id} k={`${m.display_name}: learning`} v={`${Math.round(min / 6) / 10} h`} />
          ))}
          <Row k="Date nights" v={dates.length ? `${dates.length} · ${eur(dates.reduce((a, d) => a + (d.cost ?? 0), 0))}` : "0"} />
        </Section>
      </div>

      <footer className="text-xs text-mut2">
        Made by Effendy Family on {money.today.iso}. Amounts in euro; Rupiah at the saved rate.
      </footer>
    </div>
  );
}
