// Phase 2 money rules: remittances, debt payoff, net worth, business, taxes.
// Pure functions (tested in finance.test.ts). Formulas: docs/design/README.md.

import type { Visibility } from "./money";

type Owned = { id: string; owner_id: string; visibility: Visibility };

export type Debt = Owned & {
  name: string;
  icon: string;
  lender: string | null;
  balance: number;
  original: number;
  rate_pct: number;
  monthly_payment: number;
  member_id: string | null;
};

export type Subscription = Owned & {
  name: string;
  monthly_price: number;
  for_whom: string | null;
  status: "active" | "cancelled";
  cancelled_on: string | null;
};

export type Remittance = Owned & {
  to_name: string;
  eur: number;
  fee_eur: number;
  rate_idr_per_eur: number;
  idr_received: number;
  provider: string;
  purpose: string | null;
  date: string;
};

export type Business = Owned & { name: string; member_id: string | null; vat_mode: "none" | "monthly" | "quarterly"; sort: number };

export type FileRow = Owned & { storage_path: string; name: string; kind: string; mime: string | null; size: number | null };

export type BusinessMonth = Owned & {
  business_id: string;
  month: string;
  revenue: number;
  costs: number;
  tax_set_aside: number;
  file_id: string | null;
};

export type TaxDeadline = Owned & {
  title: string;
  due_date: string;
  amount: number | null;
  kind: "vat" | "prepayment" | "return" | "other";
  done: boolean;
};

export type TaxDeduction = Owned & { year: number; title: string; amount: number; collected: boolean };

export type Asset = Owned & {
  name: string;
  icon: string;
  location: string | null;
  orig_currency: "EUR" | "IDR";
  orig_value: number;
  note: string | null;
};

export type DebtSettings = { strategy: "avalanche" | "snowball"; extra_per_month: number };

/** Used until the household saves its own rate. */
export const DEFAULT_IDR_PER_EUR = 18000;

/* Rupiah ------------------------------------------------------------------------ */

export function rp(n: number) {
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toLocaleString("en-IE", { maximumFractionDigits: 1 })} jt`;
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

export function rpFull(n: number) {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

/* Remittance (README → Remittance maths) ---------------------------------------- */

export type ProviderQuote = { name: string; fee: number; rate: number; idr: number };

/**
 * Received = (eur − fee) × rate. Provider estimates are editable constants:
 * Wise fee 0.62 + 0.57%, mid-market rate; Bank €15, rate × 0.975;
 * Western Union €4.90, rate × 0.968.
 */
export function remittanceQuotes(eur: number, midRate: number): ProviderQuote[] {
  const q = (name: string, fee: number, rate: number) => ({
    name,
    fee: round2(fee),
    rate: round2(rate),
    idr: Math.max(0, Math.round((eur - round2(fee)) * round2(rate))),
  });
  return [
    q("Wise", 0.62 + eur * 0.0057, midRate),
    q("Bank (SWIFT)", 15, midRate * 0.975),
    q("Western Union", 4.9, midRate * 0.968),
  ];
}

export function bestQuote(quotes: ProviderQuote[]) {
  return quotes.reduce((a, b) => (b.idr > a.idr ? b : a));
}

export function received(eur: number, fee: number, rate: number) {
  return Math.max(0, Math.round((eur - fee) * rate));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/* Debt payoff simulation ------------------------------------------------------------ */

export type Payoff = {
  months: number; // until every debt is paid; Infinity if never
  interest: number;
  order: { id: string; month: number }[]; // payoff month per debt, in payoff order
};

/**
 * Month by month: interest accrues, every debt gets its minimum, then the
 * extra money (plus minimums freed by paid-off debts) goes to the target debt —
 * highest rate first (avalanche) or smallest balance first (snowball).
 */
export function payoffPlan(
  debts: Pick<Debt, "id" | "balance" | "rate_pct" | "monthly_payment">[],
  strategy: "avalanche" | "snowball",
  extra: number,
  maxMonths = 600,
): Payoff {
  const live = debts.filter((d) => d.balance > 0).map((d) => ({ ...d, bal: d.balance }));
  const budget = live.reduce((a, d) => a + d.monthly_payment, 0) + extra;
  const order: { id: string; month: number }[] = [];
  let interest = 0;
  let month = 0;
  const rank = (a: (typeof live)[number], b: (typeof live)[number]) =>
    strategy === "avalanche" ? b.rate_pct - a.rate_pct || a.bal - b.bal : a.bal - b.bal || b.rate_pct - a.rate_pct;

  while (live.some((d) => d.bal > 0.005) && month < maxMonths) {
    month++;
    for (const d of live) {
      if (d.bal <= 0) continue;
      const i = (d.bal * d.rate_pct) / 100 / 12;
      d.bal += i;
      interest += i;
    }
    let money = budget;
    for (const d of live) {
      if (d.bal <= 0) continue;
      const pay = Math.min(d.monthly_payment, d.bal, money);
      d.bal -= pay;
      money -= pay;
    }
    for (const d of [...live].filter((x) => x.bal > 0).sort(rank)) {
      if (money <= 0) break;
      const pay = Math.min(d.bal, money);
      d.bal -= pay;
      money -= pay;
    }
    for (const d of live) {
      if (d.bal <= 0.005 && !order.some((o) => o.id === d.id)) {
        d.bal = 0;
        order.push({ id: d.id, month });
      }
    }
    if (money >= budget - 1e-9 && live.some((d) => d.bal > 0)) break; // nothing could be paid
  }
  const done = live.every((d) => d.bal <= 0.005);
  return { months: done ? month : Infinity, interest: Math.round(interest * 100) / 100, order };
}

/* Net worth -------------------------------------------------------------------------- */

export function assetEur(a: Pick<Asset, "orig_currency" | "orig_value">, idrPerEur: number) {
  return a.orig_currency === "IDR" ? a.orig_value / idrPerEur : a.orig_value;
}

/** Net worth = Σ assets − Σ debts (DATA_MODEL → Computed). */
export function netWorth(assets: Asset[], debts: Debt[], idrPerEur: number) {
  const total = assets.reduce((s, a) => s + assetEur(a, idrPerEur), 0);
  const owed = debts.reduce((s, d) => s + d.balance, 0);
  return { assets: total, debts: owed, net: total - owed };
}

/* Business ---------------------------------------------------------------------------- */

export function profit(m: Pick<BusinessMonth, "revenue" | "costs">) {
  return m.revenue - m.costs;
}

/** Totals over the latest `n` months that have an entry. */
export function businessStats(months: BusinessMonth[], n = 3) {
  const latest = [...months].sort((a, b) => b.month.localeCompare(a.month)).slice(0, n);
  const revenue = latest.reduce((s, m) => s + m.revenue, 0);
  const prof = latest.reduce((s, m) => s + profit(m), 0);
  return { months: latest.length, revenue, profit: prof, perMonth: latest.length ? prof / latest.length : 0 };
}

/** Tax pot = Σ tax set aside in the year's business months. */
export function taxPot(months: BusinessMonth[], year: number) {
  return months.filter((m) => m.month.startsWith(`${year}-`)).reduce((s, m) => s + m.tax_set_aside, 0);
}

/* Subscriptions ------------------------------------------------------------------------ */

export function subscriptionTotals(subs: Subscription[]) {
  const active = subs.filter((s) => s.status === "active");
  const cancelled = subs.filter((s) => s.status === "cancelled");
  const monthly = active.reduce((a, s) => a + s.monthly_price, 0);
  return {
    activeCount: active.length,
    monthly,
    yearly: monthly * 12,
    savedYearly: cancelled.reduce((a, s) => a + s.monthly_price, 0) * 12,
  };
}
