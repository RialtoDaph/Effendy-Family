import { describe, expect, it } from "vitest";
import { buildContext, type AskRows } from "./ask-context";
import type { Today } from "./money";

const today: Today = { y: 2026, m: 10, d: 10, iso: "2026-10-10", ym: "2026-10", daysInMonth: 31 };
const R = "rialto";
const A = "amnah";

const tx = (owner: string, visibility: "family" | "private", payee: string, amount: number) =>
  ({ id: payee, owner_id: owner, visibility, date: "2026-10-05", amount, payee, category_id: "g", paid_by: owner, source: "manual", recurring_id: null, note: null, created_at: "" }) as AskRows["transactions"][number];

function rows(): AskRows {
  return {
    members: [
      { id: R, display_name: "Rialto" },
      { id: A, display_name: "Amnah" },
    ],
    categories: [{ id: "g", name: "Groceries", icon: "x", monthly_limit: 600, is_fixed: false, sort: 0 } as AskRows["categories"][number]],
    transactions: [tx(R, "family", "Rewe", -50), tx(A, "private", "Secret anniversary gift", -120), tx(R, "private", "Rialto's own thing", -30)],
    incomes: [],
    recurring: [],
    goals: [
      { id: "g1", owner_id: A, visibility: "private", name: "Surprise trip for Rialto", icon: "x", target: 900, current: 100, monthly: 50, deadline: null, is_emergency_fund: false },
      { id: "g2", owner_id: R, visibility: "family", name: "Family car", icon: "x", target: 14000, current: 3200, monthly: 300, deadline: null, is_emergency_fund: false },
    ],
    debts: [],
    subscriptions: [],
    assets: [],
    remittances: [],
    businesses: [],
    businessMonths: [],
    taxDeadlines: [],
    events: [],
    yearlyGoals: [],
    fxRate: 18000,
    warnPct: 80,
    efMonths: 6,
  };
}

describe("Rialna's context", () => {
  it("never contains the partner's private items, even if the rows were passed in", () => {
    const ctx = JSON.stringify(buildContext(rows(), R, today, R));
    expect(ctx).not.toContain("Secret anniversary gift");
    expect(ctx).not.toContain("Surprise trip");
    expect(ctx).toContain("Family car");
    expect(ctx).toContain("Rialto's own thing"); // the asker's own private item is fine
  });

  it("the family view leaves out every private item", () => {
    const ctx = JSON.stringify(buildContext(rows(), R, today, "family"));
    expect(ctx).not.toContain("Rialto's own thing");
    expect(ctx).not.toContain("Secret anniversary gift");
  });

  it("budget totals count family spending only", () => {
    const ctx = buildContext(rows(), A, today, A);
    expect(ctx.budget_this_month.flexible_spent).toBe(50);
    expect(ctx.budget_this_month.private_spending_of_asker).toBe(120);
    expect(JSON.stringify(ctx)).not.toContain("Rialto's own thing");
  });
});
