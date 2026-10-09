// Money rules from docs/design/README.md and DATA_MODEL.md → "Computed".
// Pure functions only, so they can be unit tested (money.test.ts).

export type Visibility = "family" | "private";

export type Category = {
  id: string;
  name: string;
  icon: string;
  monthly_limit: number;
  is_fixed: boolean;
  sort: number;
};

export type Transaction = {
  id: string;
  owner_id: string;
  visibility: Visibility;
  date: string; // YYYY-MM-DD
  amount: number; // negative = money out
  payee: string;
  category_id: string | null;
  paid_by: string | null; // member id, null = Family
  source: "manual" | "recurring" | "import" | "receipt";
  recurring_id: string | null;
  note: string | null;
  created_at: string;
};

export type Income = {
  id: string;
  owner_id: string;
  visibility: Visibility;
  name: string;
  member_id: string | null;
  kind: "Salary" | "Business" | "Other";
  monthly_amount: number;
};

export type Recurring = {
  id: string;
  owner_id: string;
  visibility: Visibility;
  name: string;
  icon: string;
  amount: number;
  category_id: string | null;
  paid_by: string | null;
  day_of_month: number;
  active: boolean;
  last_posted_month: string | null;
};

export type Goal = {
  id: string;
  owner_id: string;
  visibility: Visibility;
  name: string;
  icon: string;
  target: number;
  current: number;
  monthly: number;
  deadline: string | null;
  is_emergency_fund: boolean;
};

/* Formatting ----------------------------------------------------------------- */

/** "1 payment", "3 payments". */
export function plural(n: number, word: string, many = `${word}s`) {
  return `${n} ${n === 1 ? word : many}`;
}

export function eur(n: number, decimals?: number) {
  const d = decimals ?? (Math.round(n * 100) % 100 === 0 ? 0 : 2);
  const s = Math.abs(n).toLocaleString("en-IE", { minimumFractionDigits: d, maximumFractionDigits: d });
  return `${n < 0 ? "−" : ""}€${s}`;
}

/** Parses "12,50" or "12.50"; NaN if it is not a number. */
export function parseAmount(v: unknown) {
  const s = String(v ?? "").trim().replace(/\s/g, "").replace(",", ".");
  return s === "" ? NaN : Number(s);
}

/** Signed amount for lists: "+€2,150" / "−€12.40". */
export function eurSigned(n: number) {
  return n > 0 ? `+${eur(n)}` : eur(n);
}

/* Dates (Europe/Berlin) ------------------------------------------------------ */

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type Today = { y: number; m: number; d: number; iso: string; ym: string; daysInMonth: number };

export function berlinToday(now = new Date()): Today {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // YYYY-MM-DD
  const [y, m, d] = parts.split("-").map(Number);
  return { y, m, d, iso: parts, ym: parts.slice(0, 7), daysInMonth: new Date(y, m, 0).getDate() };
}

export function shortDate(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/* Budget --------------------------------------------------------------------- */

export type Status = "over" | "near" | "fast" | "paid" | "notyet" | "ontrack";

export const STATUS_LABEL: Record<Status, string> = {
  over: "Over",
  near: "Near limit",
  fast: "Fast",
  paid: "Paid",
  notyet: "Not yet",
  ontrack: "On track",
};

/** Percentage points a flexible category may run ahead of the month before it is "Fast". */
export const FAST_MARGIN = 15;

/** Money spent per category in a month (refunds in a category reduce it). */
export function spentByCategory(txs: Transaction[], ym: string) {
  const out = new Map<string, number>();
  for (const t of txs) {
    if (!t.category_id || !t.date.startsWith(ym)) continue;
    out.set(t.category_id, (out.get(t.category_id) ?? 0) - t.amount);
  }
  return out;
}

/**
 * README → Budget statuses: Over if spent > limit; else (flexible only) Near
 * limit if spent ≥ warn%; else Fast if % used > % of month + margin; else Paid
 * (fixed) or On track. A fixed category with nothing paid yet shows "Not yet".
 */
export function categoryStatus(
  cat: Pick<Category, "monthly_limit" | "is_fixed">,
  spent: number,
  monthPct: number,
  warnPct: number,
): Status {
  const limit = cat.monthly_limit;
  if (spent > limit && spent > 0) return "over";
  if (cat.is_fixed) return spent > 0 ? "paid" : "notyet";
  const p = limit > 0 ? (spent / limit) * 100 : 0;
  if (p >= warnPct) return "near";
  if (p > monthPct + FAST_MARGIN) return "fast";
  return "ontrack";
}

export type BudgetSummary = {
  monthPct: number;
  daysLeft: number;
  spent: number;
  limit: number;
  flexLimit: number;
  flexSpent: number;
  flexLeft: number;
  perDay: number;
  rows: { cat: Category; spent: number; pct: number; status: Status }[];
};

export function budgetSummary(cats: Category[], txs: Transaction[], today: Today, warnPct: number): BudgetSummary {
  const spentMap = spentByCategory(txs, today.ym);
  const monthPct = Math.round((today.d / today.daysInMonth) * 100);
  const daysLeft = today.daysInMonth - today.d + 1; // today still counts
  const rows = cats.map((cat) => {
    const spent = spentMap.get(cat.id) ?? 0;
    const pct = cat.monthly_limit > 0 ? (spent / cat.monthly_limit) * 100 : 0;
    return { cat, spent, pct, status: categoryStatus(cat, spent, monthPct, warnPct) };
  });
  const flex = rows.filter((r) => !r.cat.is_fixed);
  const flexLimit = flex.reduce((a, r) => a + r.cat.monthly_limit, 0);
  const flexSpent = flex.reduce((a, r) => a + r.spent, 0);
  const flexLeft = flexLimit - flexSpent;
  return {
    monthPct,
    daysLeft,
    spent: rows.reduce((a, r) => a + r.spent, 0),
    limit: cats.reduce((a, c) => a + c.monthly_limit, 0),
    flexLimit,
    flexSpent,
    flexLeft,
    perDay: Math.max(0, flexLeft) / daysLeft,
    rows,
  };
}

/* Emergency fund ------------------------------------------------------------- */

export type EmergencyFund = {
  goal: Goal | undefined;
  saved: number;
  monthlyBudget: number;
  months: number;
  target: number;
  remaining: number;
  status: "below" | "minimum" | "full";
};

/** months = fund / Σ category limits (DATA_MODEL → Computed). */
export function emergencyFund(goals: Goal[], cats: Category[], targetMonths: number): EmergencyFund {
  const goal = goals.find((g) => g.is_emergency_fund);
  const saved = goal?.current ?? 0;
  const monthlyBudget = cats.reduce((a, c) => a + c.monthly_limit, 0);
  const months = monthlyBudget > 0 ? saved / monthlyBudget : 0;
  return {
    goal,
    saved,
    monthlyBudget,
    months,
    target: targetMonths,
    remaining: Math.max(0, targetMonths * monthlyBudget - saved),
    status: months >= targetMonths ? "full" : months >= 3 ? "minimum" : "below",
  };
}

/** Months until a goal is reached at its monthly rate; Infinity if never. */
export function goalEta(goal: Pick<Goal, "target" | "current" | "monthly">) {
  const rem = goal.target - goal.current;
  if (rem <= 0) return 0;
  return goal.monthly > 0 ? Math.ceil(rem / goal.monthly) : Infinity;
}

export function addMonthsLabel(today: Today, months: number) {
  const t = today.y * 12 + (today.m - 1) + months;
  return `${MONTHS[t % 12]} ${Math.floor(t / 12)}`;
}

/* Recurring ------------------------------------------------------------------ */

export type RecurringState = "added" | "due" | "next" | "paused";

/** "Added" this month, "Due" within 3 days, otherwise "Next", or "Paused". */
export function recurringState(r: Recurring, today: Today): RecurringState {
  if (!r.active) return "paused";
  if (r.last_posted_month === today.ym) return "added";
  if (r.day_of_month >= today.d && r.day_of_month - today.d <= 3) return "due";
  return "next";
}

/** Date the item posts next (or posted this month). */
export function recurringDate(r: Recurring, today: Today) {
  const thisMonth = r.last_posted_month === today.ym || r.day_of_month >= today.d;
  const y = thisMonth ? today.y : today.m === 12 ? today.y + 1 : today.y;
  const m = thisMonth ? today.m : today.m === 12 ? 1 : today.m + 1;
  return `${y}-${String(m).padStart(2, "0")}-${String(r.day_of_month).padStart(2, "0")}`;
}

/* Alerts --------------------------------------------------------------------- */

export type Severity = "urgent" | "soon" | "info";
export type AlertArea = "money" | "time" | "goals";

export type Alert = {
  key: string; // stable per month, used for dismiss / done
  sev: Severity;
  area: AlertArea;
  title: string;
  meta: string;
  when: string;
  href: string;
  cta: string;
};

const SEV_RANK: Record<Severity, number> = { urgent: 0, soon: 1, info: 2 };

export function buildAlerts(input: {
  today: Today;
  budget: BudgetSummary;
  recurring: Recurring[];
  ef: EmergencyFund;
  warnPct: number;
  closed: Set<string>; // alert keys dismissed or done
}): Alert[] {
  const { today, budget, recurring, ef, warnPct, closed } = input;
  const tag = today.ym;
  const left = today.daysInMonth - today.d;
  const out: Alert[] = [];

  for (const r of budget.rows) {
    if (r.cat.is_fixed || r.cat.monthly_limit <= 0) continue;
    if (r.status === "over") {
      out.push({
        key: `over-${r.cat.id}-${tag}`,
        sev: "urgent",
        area: "money",
        title: `${r.cat.name} is over budget`,
        meta: `${eur(r.spent)} of ${eur(r.cat.monthly_limit)} · ${eur(r.spent - r.cat.monthly_limit)} over with ${left} days to go`,
        when: "This month",
        href: "/budget",
        cta: "Open budget",
      });
    } else if (r.status === "near") {
      out.push({
        key: `near-${r.cat.id}-${tag}`,
        sev: "soon",
        area: "money",
        title: `${r.cat.name} at ${Math.round(r.pct)}% of budget`,
        meta: `${eur(r.cat.monthly_limit - r.spent)} left for the next ${left} days · warning at ${warnPct}%`,
        when: "This month",
        href: "/budget",
        cta: "Open budget",
      });
    } else if (r.status === "fast") {
      out.push({
        key: `fast-${r.cat.id}-${tag}`,
        sev: "info",
        area: "money",
        title: `${r.cat.name} is moving fast`,
        meta: `${Math.round(r.pct)}% used with ${budget.monthPct}% of the month gone`,
        when: "This month",
        href: "/budget",
        cta: "Open budget",
      });
    }
  }

  for (const r of recurring) {
    if (!r.active || r.amount >= 0 || r.last_posted_month === today.ym) continue;
    const n = r.day_of_month - today.d;
    if (n < 0 || n > 3) continue;
    out.push({
      key: `rc-${r.id}-${tag}`,
      sev: "soon",
      area: "money",
      title: `${r.name} goes out ${n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`}`,
      meta: `${eur(-r.amount)} · recurring`,
      when: n === 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`,
      href: "/recur",
      cta: "Open recurring",
    });
  }

  const fixedTotal = budget.rows.filter((r) => r.cat.is_fixed).reduce((a, r) => a + r.cat.monthly_limit, 0);
  if (fixedTotal > 0 && left <= 7) {
    const nextM = today.m === 12 ? 1 : today.m + 1;
    out.push({
      key: `bills-${tag}`,
      sev: left <= 3 ? "soon" : "info",
      area: "money",
      title: `Bills on 1 ${MONTHS[nextM - 1]}: ${eur(fixedTotal)}`,
      meta: budget.rows
        .filter((r) => r.cat.is_fixed && r.cat.monthly_limit > 0)
        .slice(0, 4)
        .map((r) => `${r.cat.name} ${eur(r.cat.monthly_limit)}`)
        .join(" · "),
      when: left === 0 ? "Tomorrow" : `In ${left + 1} days`,
      href: "/budget",
      cta: "Open budget",
    });
  }

  if (ef.monthlyBudget > 0 && ef.months < ef.target) {
    out.push({
      key: `ef-${ef.target}-${tag}`,
      sev: ef.months < 3 ? "soon" : "info",
      area: "goals",
      title: `Emergency fund covers ${(Math.floor(ef.months * 10) / 10).toFixed(1)} months`,
      meta: `${ef.months < 3 ? "Below the 3-month minimum. " : ""}${eur(ef.remaining)} more to reach ${ef.target} months.`,
      when: "Ongoing",
      href: "/budget",
      cta: "Open budget",
    });
  }

  return out.filter((a) => !closed.has(a.key)).sort((a, b) => SEV_RANK[a.sev] - SEV_RANK[b.sev]);
}

/* Briefing (template text, no AI yet) ---------------------------------------- */

export function briefing(input: { budget: BudgetSummary; alerts: Alert[]; ef: EmergencyFund; hasData: boolean }) {
  const { budget, alerts, ef, hasData } = input;
  if (!hasData) {
    return "Nothing to report yet. Start with the setup checklist: add your income and your first transactions, and this summary fills itself.";
  }
  const parts: string[] = [];
  parts.push(
    budget.flexLeft >= 0
      ? `You've spent ${eur(budget.flexSpent)} of this month's ${eur(budget.flexLimit)} flexible money — ${eur(budget.flexLeft)} left, about ${eur(budget.perDay)} a day for ${budget.daysLeft} days.`
      : `Flexible spending is ${eur(-budget.flexLeft)} over this month's ${eur(budget.flexLimit)}.`,
  );
  const top = alerts.find((a) => a.area === "money" && a.sev !== "info") ?? alerts.find((a) => a.area === "money");
  if (top) parts.push(`${top.title}.`);
  if (ef.goal && ef.monthlyBudget > 0) {
    parts.push(
      ef.months >= ef.target
        ? `The emergency fund is full at ${ef.months.toFixed(1)} months.`
        : `The emergency fund covers ${ef.months.toFixed(1)} of ${ef.target} months.`,
    );
  }
  return parts.join(" ");
}

/* Scope: Family / one person -------------------------------------------------- */

/**
 * Family view counts only family-visible rows. A person view counts that
 * person's rows (paid by / earned by them); private rows only ever appear in
 * their owner's own view (RLS already hides the partner's).
 */
export function inScope(
  row: { visibility: Visibility; owner_id: string; paid_by?: string | null; member_id?: string | null },
  scope: "family" | string,
  viewerId: string,
) {
  const who = row.paid_by !== undefined ? row.paid_by : (row.member_id ?? null);
  if (scope === "family") return row.visibility === "family";
  if (row.visibility === "private" && row.owner_id !== viewerId) return false;
  if (row.visibility === "private" && scope !== viewerId) return false;
  return who === scope;
}
