import { describe, expect, it } from "vitest";
import type { Asset } from "./finance";
import type { Category, Goal, Income } from "./money";
import { assetClass, freedPerMonth, futureValue, goalChanges, simulate, unplannedPerMonth, WHAT_IF_START } from "./plan";

const goal = (p: Partial<Goal>): Goal =>
  ({ id: "g", owner_id: "r", visibility: "family", name: "Car", icon: "car", target: 14000, current: 3200, monthly: 300, deadline: null, is_emergency_fund: false, ...p }) as Goal;

describe("what if", () => {
  it("finds money without a job", () => {
    const incomes = [{ monthly_amount: 2150 }, { monthly_amount: 1400 }] as Income[];
    const cats = [{ monthly_limit: 2390 }, { monthly_limit: 300 }] as Category[];
    const goals = [goal({ monthly: 500 }), goal({ monthly: 300 })];
    expect(unplannedPerMonth(incomes, cats, goals)).toBe(60);
  });

  it("counts extra income after tax and what is switched off", () => {
    expect(freedPerMonth({ ...WHAT_IF_START, removed: 85, incomeChange: 500 })).toBe(85 + 350);
    expect(freedPerMonth({ ...WHAT_IF_START, incomeChange: 500, taxPct: 40 })).toBe(300);
    expect(freedPerMonth({ ...WHAT_IF_START, extra: 100, investDelta: 150 })).toBe(-50);
  });

  it("moves a goal date when money goes to it", () => {
    // Car: 10,800 left at 300/month = 36 months; with tobacco money (+85) = 29 months.
    const [car] = goalChanges([goal({})], "g", 85);
    expect(car.before).toBe(36);
    expect(car.after).toBe(29);
    const [other] = goalChanges([goal({ id: "x" })], "g", 85);
    expect(other.after).toBe(other.before);
    expect(goalChanges([goal({ monthly: 0 })], null, 0)[0].before).toBeNull();
  });

  it("compounds monthly savings", () => {
    expect(futureValue(100, 0, 10)).toBe(12000);
    expect(futureValue(400, 6, 10)).toBe(65552);
    expect(futureValue(0, 6, 10, 10000)).toBe(18194);
  });
});

describe("10-year simulation", () => {
  const asset = (p: Partial<Asset>): Asset =>
    ({ id: Math.random().toString(), owner_id: "r", visibility: "family", name: "x", icon: "wallet", location: null, orig_currency: "EUR", orig_value: 0, note: null, ...p }) as Asset;

  it("sorts assets into classes", () => {
    expect(assetClass(asset({ name: "ETF savings plan" }))).toBe("etf");
    expect(assetClass(asset({ name: "Tagesgeld" }))).toBe("cash");
    expect(assetClass(asset({ name: "Gold bars" }))).toBe("gold");
    expect(assetClass(asset({ name: "BCA savings", orig_currency: "IDR" }))).toBe("idr");
  });

  it("grows each scenario, bad below good", () => {
    const assets = [asset({ name: "ETF", orig_value: 10000 }), asset({ name: "Tagesgeld", orig_value: 5000 }), asset({ name: "BCA", orig_currency: "IDR", orig_value: 18_000_000 })];
    const bad = simulate(assets, 18000, "cautious", { monthly: 0, includeIdr: true });
    const good = simulate(assets, 18000, "hopeful", { monthly: 0, includeIdr: true });
    expect(bad).toHaveLength(11);
    expect(bad[0]).toBe(16000);
    expect(good[10]).toBeGreaterThan(bad[10]);
    expect(simulate(assets, 18000, "middle", { monthly: 0, includeIdr: false })[0]).toBe(15000);
  });
});
