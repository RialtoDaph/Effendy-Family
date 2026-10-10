// What Rialna is told. Built on the server from rows read with the asker's
// own login (Row Level Security), and filtered here once more: the partner's
// private items never reach the AI (README → Privacy: "Ask Rialna only uses
// data the asking person can see").

import { assetEur, payoffPlan, subscriptionTotals, type Asset, type BusinessMonth, type Debt, type Remittance, type Subscription, type TaxDeadline } from "./finance";
import { budgetSummary, emergencyFund, goalEta, recurringDate, type Category, type Goal, type Income, type Recurring, type Today, type Transaction } from "./money";
import { unplannedPerMonth } from "./plan";
import { addDays, goalStatus, monthShifts, shiftHours, type CalEvent, type YearlyGoal } from "./time";

type Owned = { owner_id: string; visibility: "family" | "private" };

export type AskRows = {
  members: { id: string; display_name: string }[];
  categories: Category[];
  transactions: Transaction[];
  incomes: Income[];
  recurring: Recurring[];
  goals: Goal[];
  debts: Debt[];
  subscriptions: Subscription[];
  assets: Asset[];
  remittances: Remittance[];
  businesses: { id: string; name: string }[];
  businessMonths: BusinessMonth[];
  taxDeadlines: TaxDeadline[];
  events: CalEvent[];
  yearlyGoals: YearlyGoal[];
  fxRate: number;
  warnPct: number;
  efMonths: number;
};

/** Only rows the viewer may see: family rows and the viewer's own private rows. */
export function visibleTo<T extends Owned>(rows: T[], viewerId: string) {
  return rows.filter((r) => r.visibility === "family" || r.owner_id === viewerId);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A compact summary for the model. `scope` narrows it like the Home person
 * filter: "family" = family rows only; a member id = that member's rows plus family rows.
 */
export function buildContext(raw: AskRows, viewerId: string, today: Today, scope: "family" | string = "family") {
  const v = <T extends Owned>(rows: T[]) => visibleTo(rows, viewerId);
  const inScope = <T extends Owned>(rows: T[]) =>
    scope === "family" ? rows.filter((r) => r.visibility === "family") : rows.filter((r) => r.visibility === "family" || r.owner_id === scope);
  const name = (id: string | null | undefined) => raw.members.find((m) => m.id === id)?.display_name ?? "Family";
  const priv = (r: Owned) => (r.visibility === "private" ? { private_to: name(r.owner_id) } : {});

  const txs = inScope(v(raw.transactions));
  const familyTx = txs.filter((t) => t.visibility === "family");
  const budget = budgetSummary(raw.categories, familyTx, today, raw.warnPct);
  const goals = inScope(v(raw.goals));
  const ef = emergencyFund(goals.filter((g) => g.visibility === "family"), raw.categories, raw.efMonths);
  const debts = inScope(v(raw.debts));
  const plan = payoffPlan(debts, "avalanche", 0);
  const subs = inScope(v(raw.subscriptions));
  const assets = inScope(v(raw.assets));
  const owned = assets.reduce((a, x) => a + assetEur(x, raw.fxRate), 0);
  const owedTotal = debts.reduce((a, d) => a + d.balance, 0);
  const events = inScope(v(raw.events));
  const soon = addDays(today.iso, 14);
  const monthSpentPrivate = txs.filter((t) => t.visibility === "private" && t.date.startsWith(today.ym) && t.amount < 0).reduce((a, t) => a - t.amount, 0);

  return {
    today: today.iso,
    asked_by: name(viewerId),
    view: scope === "family" ? "family" : name(scope),
    people: raw.members.map((m) => m.display_name),
    currency: "EUR (Rupiah converted at €1 = Rp " + raw.fxRate.toLocaleString("en") + ")",
    budget_this_month: {
      flexible_limit: r2(budget.flexLimit),
      flexible_spent: r2(budget.flexSpent),
      flexible_left: r2(budget.flexLeft),
      per_day_left: r2(budget.perDay),
      days_left: budget.daysLeft,
      total_limit: r2(budget.limit),
      total_spent: r2(budget.spent),
      categories: budget.rows.map((r) => ({ name: r.cat.name, limit: r.cat.monthly_limit, spent: r2(r.spent), status: r.status, fixed: r.cat.is_fixed })),
      private_spending_of_asker: r2(monthSpentPrivate),
    },
    unplanned_per_month: unplannedPerMonth(inScope(v(raw.incomes)).filter((i) => i.visibility === "family"), raw.categories, goals.filter((g) => g.visibility === "family")),
    incomes: inScope(v(raw.incomes)).map((i) => ({ name: i.name, whose: name(i.member_id), kind: i.kind, monthly: i.monthly_amount, ...priv(i) })),
    recurring_next_14_days: inScope(v(raw.recurring))
      .filter((r) => r.active)
      .map((r) => ({ name: r.name, amount: r.amount, date: recurringDate(r, today), ...priv(r) }))
      .filter((r) => r.date <= soon && r.date >= today.iso),
    savings_goals: goals.map((g) => {
      const eta = goalEta(g);
      return { name: g.name, target: g.target, saved: g.current, monthly: g.monthly, months_to_go: Number.isFinite(eta) ? eta : null, emergency_fund: g.is_emergency_fund, ...priv(g) };
    }),
    emergency_fund: ef.goal ? { months_covered: r2(ef.months), target_months: ef.target } : null,
    debts: {
      total: r2(owedTotal),
      debt_free_in_months: debts.length ? plan.months : 0,
      items: debts.map((d) => ({ name: d.name, balance: d.balance, rate_pct: d.rate_pct, monthly: d.monthly_payment, ...priv(d) })),
    },
    subscriptions: { monthly_total: r2(subscriptionTotals(subs).monthly), active: subs.filter((s) => s.status === "active").map((s) => ({ name: s.name, monthly: s.monthly_price, ...priv(s) })) },
    net_worth: { owned: Math.round(owned), owed: Math.round(owedTotal), net: Math.round(owned - owedTotal) },
    transfers_home_this_year: r2(inScope(v(raw.remittances)).filter((x) => x.date.startsWith(String(today.y))).reduce((a, x) => a + x.eur, 0)),
    business_last_months: raw.businesses.map((b) => ({
      name: b.name,
      months: inScope(v(raw.businessMonths))
        .filter((m) => m.business_id === b.id)
        .sort((a, c) => c.month.localeCompare(a.month))
        .slice(0, 3)
        .map((m) => ({ month: m.month, revenue: m.revenue, costs: m.costs, tax_set_aside: m.tax_set_aside })),
    })),
    tax_deadlines_next_60_days: inScope(v(raw.taxDeadlines))
      .filter((t) => !t.done && t.due_date >= today.iso && t.due_date <= addDays(today.iso, 60))
      .map((t) => ({ title: t.title, due: t.due_date, amount: t.amount })),
    calendar_next_14_days: events
      .filter((e) => e.date >= today.iso && e.date <= soon)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 40)
      .map((e) => ({ date: e.date, time: e.start_time?.slice(0, 5) ?? null, title: e.title, kind: e.kind, for: e.kind === "shift" ? name(e.owner_id) : e.who ? name(e.who) : "Together", ...priv(e) })),
    shifts_this_month: raw.members.map((m) => {
      const s = monthShifts(events.filter((e) => e.owner_id === m.id), today.ym);
      return { who: m.display_name, count: s.count, hours: Math.round(s.hours) };
    }).filter((s) => s.count > 0),
    next_shift_hours: events.filter((e) => e.kind === "shift" && e.date >= today.iso).slice(0, 1).map((e) => shiftHours(e.start_time, e.end_time))[0] ?? null,
    yearly_goals: inScope(v(raw.yearlyGoals))
      .filter((g) => g.year === today.y)
      .map((g) => {
        const st = goalStatus(g, today.iso);
        return { name: g.name, done: g.done, target: g.target, unit: g.unit, status: st.status, for: g.who ? name(g.who) : "Together", ...priv(g) };
      }),
    recent_transactions: txs
      .slice(0, 60)
      .map((t) => ({ date: t.date, payee: t.payee, amount: t.amount, category: raw.categories.find((c) => c.id === t.category_id)?.name ?? null, ...priv(t) })),
  };
}
