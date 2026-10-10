// Phase 5: What if and the 10-year simulation. Plain arithmetic, no AI.

import { assetEur, type Asset } from "./finance";
import type { Category, Goal, Income } from "./money";

/* What if ----------------------------------------------------------------------- */

/** Money that comes in each month but has no job yet: income − budget limits − goal savings. */
export function unplannedPerMonth(incomes: Income[], cats: Category[], goals: Goal[]) {
  const income = incomes.reduce((a, i) => a + i.monthly_amount, 0);
  const budget = cats.reduce((a, c) => a + c.monthly_limit, 0);
  const saving = goals.reduce((a, g) => a + (g.monthly || 0), 0);
  return Math.round(income - budget - saving);
}

export type WhatIf = {
  extra: number; // unplanned money moved into the chosen goal, € / month
  incomeChange: number; // Studio income change before tax, € / month
  taxPct: number; // share of extra income that goes to tax (default 30)
  investDelta: number; // change to the monthly invest amount, € / month
  removed: number; // expenses switched off, € / month
};

export const WHAT_IF_START: WhatIf = { extra: 0, incomeChange: 0, taxPct: 30, investDelta: 0, removed: 0 };

/** Money freed (or needed, if negative) each month for the chosen goal. */
export function freedPerMonth(w: WhatIf) {
  const income = w.incomeChange * (1 - w.taxPct / 100);
  return Math.round((w.removed + w.extra + income - w.investDelta) * 100) / 100;
}

/** Months until a goal is reached at `monthly` €; null if it never is. */
export function monthsTo(goal: Pick<Goal, "target" | "current">, monthly: number) {
  const left = goal.target - goal.current;
  if (left <= 0) return 0;
  return monthly > 0 ? Math.ceil(left / monthly) : null;
}

export type GoalChange = { goal: Goal; before: number | null; after: number | null; monthlyAfter: number };

/** Each goal's date before and after the change; freed money goes to `targetId` only. */
export function goalChanges(goals: Goal[], targetId: string | null, freed: number): GoalChange[] {
  return goals
    .filter((g) => g.target > 0)
    .map((g) => {
      const monthlyAfter = Math.max(0, (g.monthly || 0) + (g.id === targetId ? freed : 0));
      return { goal: g, before: monthsTo(g, g.monthly || 0), after: monthsTo(g, monthlyAfter), monthlyAfter };
    });
}

/** Value after `years` of saving `monthly` € at `ratePct` a year (monthly compounding). */
export function futureValue(monthly: number, ratePct: number, years: number, start = 0) {
  const i = ratePct / 100 / 12;
  const n = years * 12;
  const grow = Math.pow(1 + i, n);
  const fromStart = start * grow;
  const fromSaving = i === 0 ? monthly * n : monthly * ((grow - 1) / i);
  return Math.round(fromStart + fromSaving);
}

/* 10-year simulation ------------------------------------------------------------ */

export type AssetClass = "etf" | "cash" | "gold" | "idr";

export const CLASS_LABEL: Record<AssetClass, string> = {
  etf: "ETF & shares",
  cash: "Cash & Tagesgeld",
  gold: "Gold",
  idr: "Rupiah assets",
};

/** A best guess from the asset's currency, name and icon. */
export function assetClass(a: Pick<Asset, "name" | "icon" | "orig_currency" | "location">): AssetClass {
  if (a.orig_currency === "IDR") return "idr";
  const text = `${a.name} ${a.location ?? ""}`;
  if (/\b(gold|emas|silber|silver)\b/i.test(text)) return "gold";
  if (a.icon === "trending-up" || /\b(etf|msci|ftse|fund|fonds|aktie|stock|share|depot|sparplan)/i.test(text)) return "etf";
  return "cash";
}

export type Scenario = "cautious" | "middle" | "hopeful";

export const SCENARIO_LABEL: Record<Scenario, string> = { cautious: "Bad years", middle: "Middle", hopeful: "Good years" };

/** Yearly returns per asset class (the design's sample assumptions). */
export const SCENARIO_RATES: Record<Scenario, Record<AssetClass, number>> = {
  cautious: { etf: 3, cash: 1.5, gold: 1, idr: -1 },
  middle: { etf: 6, cash: 2, gold: 3, idr: 2 },
  hopeful: { etf: 8, cash: 2.5, gold: 5, idr: 4 },
};

export type SimOptions = { monthly: number; includeIdr: boolean; years?: number };

/** Total in € at the end of each year (index 0 = today). Monthly saving goes into ETFs. */
export function simulate(assets: Asset[], idrPerEur: number, scenario: Scenario, o: SimOptions) {
  const years = o.years ?? 10;
  const start: Record<AssetClass, number> = { etf: 0, cash: 0, gold: 0, idr: 0 };
  for (const a of assets) {
    const c = assetClass(a);
    if (c === "idr" && !o.includeIdr) continue;
    start[c] += assetEur(a, idrPerEur);
  }
  const rates = SCENARIO_RATES[scenario];
  const out: number[] = [];
  for (let y = 0; y <= years; y++) {
    let total = 0;
    for (const c of Object.keys(start) as AssetClass[]) {
      total += c === "etf" ? futureValue(o.monthly, rates.etf, y, start.etf) : start[c] * Math.pow(1 + rates[c] / 100, y);
    }
    out.push(Math.round(total));
  }
  return out;
}
