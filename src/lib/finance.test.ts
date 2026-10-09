import { describe, expect, it } from "vitest";
import {
  bestQuote,
  businessStats,
  netWorth,
  payoffPlan,
  received,
  remittanceQuotes,
  subscriptionTotals,
  taxPot,
  type Asset,
  type BusinessMonth,
  type Debt,
  type Subscription,
} from "./finance";

describe("remittance maths (README)", () => {
  it("received = (eur − fee) × rate", () => {
    expect(received(200, 1.76, 18010)).toBe(Math.round((200 - 1.76) * 18010));
  });
  it("provider estimates use the README constants", () => {
    const [wise, bank, wu] = remittanceQuotes(200, 18000);
    expect(wise.fee).toBeCloseTo(0.62 + 200 * 0.0057, 2); // 1.76
    expect(wise.rate).toBe(18000);
    expect(wise.idr).toBe(Math.round((200 - 1.76) * 18000));
    expect(bank.fee).toBe(15);
    expect(bank.rate).toBe(17550);
    expect(bank.idr).toBe(Math.round((200 - 15) * 17550));
    expect(wu.fee).toBe(4.9);
    expect(wu.rate).toBe(17424);
    expect(wu.idr).toBe(Math.round((200 - 4.9) * 17424));
  });
  it("the best provider is the one where most arrives", () => {
    expect(bestQuote(remittanceQuotes(200, 18000)).name).toBe("Wise");
  });
});

const debt = (id: string, balance: number, rate_pct: number, monthly_payment: number) => ({ id, balance, rate_pct, monthly_payment });

describe("debt payoff", () => {
  it("a 0% debt is paid in balance / payment months", () => {
    expect(payoffPlan([debt("a", 600, 0, 100)], "avalanche", 0).months).toBe(6);
  });
  it("extra money shortens the plan", () => {
    const ds = [debt("a", 3840, 6.9, 160), debt("b", 1390, 0, 60), debt("c", 456, 0, 38)];
    const base = payoffPlan(ds, "avalanche", 0);
    const more = payoffPlan(ds, "avalanche", 100);
    expect(more.months).toBeLessThan(base.months);
    expect(more.interest).toBeLessThan(base.interest);
  });
  it("avalanche pays the highest rate first, snowball the smallest balance", () => {
    const ds = [debt("big-rate", 1000, 12, 50), debt("small", 900, 0, 50)];
    expect(payoffPlan(ds, "avalanche", 300).order[0].id).toBe("big-rate");
    expect(payoffPlan(ds, "snowball", 300).order[0].id).toBe("small");
  });
  it("never ends when payments do not cover interest", () => {
    expect(payoffPlan([debt("a", 10000, 24, 50)], "avalanche", 0).months).toBe(Infinity);
  });
});

describe("net worth", () => {
  const asset = (orig_value: number, orig_currency: "EUR" | "IDR" = "EUR") =>
    ({ id: "x", owner_id: "a", visibility: "family", name: "x", icon: "x", location: null, orig_currency, orig_value, note: null }) as Asset;
  const d = (balance: number) => ({ id: "d", balance }) as Debt;
  it("net worth = assets − debts, IDR converted at the saved rate", () => {
    const nw = netWorth([asset(10000), asset(180_000_000, "IDR")], [d(3840), d(1390)], 18000);
    expect(nw.assets).toBe(20000);
    expect(nw.debts).toBe(5230);
    expect(nw.net).toBe(14770);
  });
});

describe("business and taxes", () => {
  const m = (month: string, revenue: number, costs: number, tax: number) =>
    ({ month, revenue, costs, tax_set_aside: tax }) as BusinessMonth;
  const months = [m("2026-09", 2840, 410, 690), m("2026-08", 2350, 395, 560), m("2026-07", 2610, 420, 630), m("2026-06", 9999, 0, 100), m("2025-12", 1, 0, 50)];
  it("3-month revenue and profit use the latest months", () => {
    const s = businessStats(months);
    expect(s.revenue).toBe(2840 + 2350 + 2610);
    expect(s.profit).toBe(2430 + 1955 + 2190);
    expect(s.perMonth).toBeCloseTo((2430 + 1955 + 2190) / 3);
  });
  it("tax pot = tax set aside in that year", () => {
    expect(taxPot(months, 2026)).toBe(690 + 560 + 630 + 100);
  });
});

describe("subscriptions", () => {
  const s = (price: number, status: "active" | "cancelled") => ({ monthly_price: price, status }) as Subscription;
  it("totals active ones and counts what cancelling saves", () => {
    const t = subscriptionTotals([s(10, "active"), s(5, "active"), s(35, "cancelled")]);
    expect(t.monthly).toBe(15);
    expect(t.yearly).toBe(180);
    expect(t.savedYearly).toBe(420);
  });
});
