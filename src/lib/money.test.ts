import { describe, expect, it } from "vitest";
import {
  berlinToday,
  budgetSummary,
  buildAlerts,
  categoryStatus,
  emergencyFund,
  eur,
  goalEta,
  inScope,
  recurringState,
  spentByCategory,
  type Category,
  type Goal,
  type Recurring,
  type Today,
  type Transaction,
} from "./money";

const today: Today = { y: 2026, m: 10, d: 7, iso: "2026-10-07", ym: "2026-10", daysInMonth: 31 }; // 23% of month

const cat = (id: string, limit: number, fixed = false): Category => ({
  id,
  name: id,
  icon: "tag",
  monthly_limit: limit,
  is_fixed: fixed,
  sort: 0,
});

const tx = (category_id: string, amount: number, date = "2026-10-03", extra: Partial<Transaction> = {}): Transaction => ({
  id: Math.random().toString(),
  owner_id: "a",
  visibility: "family",
  date,
  amount,
  payee: "x",
  category_id,
  paid_by: null,
  source: "manual",
  recurring_id: null,
  note: null,
  created_at: "",
  ...extra,
});

describe("eur", () => {
  it("formats euros like the prototype", () => {
    expect(eur(917)).toBe("€917");
    expect(eur(1335)).toBe("€1,335");
    expect(eur(-12.4)).toBe("−€12.40");
  });
});

describe("berlinToday", () => {
  it("uses the Berlin date, not UTC", () => {
    // 23:30 UTC on 31 Oct is already 1 Nov 00:30 in Berlin (CET).
    expect(berlinToday(new Date("2026-10-31T23:30:00Z")).iso).toBe("2026-11-01");
  });
});

describe("categoryStatus (README → Budget statuses)", () => {
  const warn = 80;
  it("Over when spent > limit, fixed or flexible", () => {
    expect(categoryStatus(cat("s", 60, true), 88.95, 23, warn)).toBe("over");
    expect(categoryStatus(cat("g", 100), 101, 23, warn)).toBe("over");
  });
  it("Near limit when flexible spent ≥ warn%", () => {
    expect(categoryStatus(cat("g", 100), 80, 23, warn)).toBe("near");
    expect(categoryStatus(cat("g", 100), 79, 90, warn)).toBe("ontrack");
  });
  it("Fast when flexible use runs ahead of the month by more than the margin", () => {
    expect(categoryStatus(cat("g", 250), 131, 23, warn)).toBe("fast"); // 52% vs 23%
    expect(categoryStatus(cat("g", 620), 148, 23, warn)).toBe("ontrack"); // 24%
  });
  it("fixed categories are Paid once something is paid, never Near/Fast", () => {
    expect(categoryStatus(cat("r", 1335, true), 1335, 23, warn)).toBe("paid");
    expect(categoryStatus(cat("r", 1335, true), 0, 23, warn)).toBe("notyet");
  });
});

describe("budgetSummary", () => {
  const cats = [cat("rent", 1335, true), cat("food", 620), cat("fun", 250)];
  const txs = [
    tx("rent", -1335),
    tx("food", -148),
    tx("fun", -131),
    tx("fun", 20), // refund
    tx("food", -999, "2026-09-30"), // last month, ignored
  ];
  const b = budgetSummary(cats, txs, today, 80);
  it("flexible money left = Σ flexible limits − Σ flexible spent", () => {
    expect(b.flexLimit).toBe(870);
    expect(b.flexSpent).toBe(148 + 111);
    expect(b.flexLeft).toBe(870 - 259);
  });
  it("daily allowance = flexible left / days left (today included)", () => {
    expect(b.daysLeft).toBe(25);
    expect(b.perDay).toBeCloseTo(611 / 25);
  });
  it("only counts this month", () => {
    expect(spentByCategory(txs, "2026-09").get("food")).toBe(999);
  });
});

describe("emergencyFund", () => {
  const goal = (current: number): Goal => ({
    id: "ef",
    owner_id: "a",
    visibility: "family",
    name: "EF",
    icon: "life-buoy",
    target: 0,
    current,
    monthly: 500,
    deadline: null,
    is_emergency_fund: true,
  });
  const cats = [cat("a", 2000), cat("b", 1000)];
  it("months = fund / Σ category limits, with the right status", () => {
    expect(emergencyFund([goal(6000)], cats, 6).months).toBe(2);
    expect(emergencyFund([goal(6000)], cats, 6).status).toBe("below");
    expect(emergencyFund([goal(9000)], cats, 6).status).toBe("minimum");
    expect(emergencyFund([goal(18000)], cats, 6).status).toBe("full");
    expect(emergencyFund([goal(9000)], cats, 6).remaining).toBe(9000);
  });
  it("goal ETA = remaining / monthly", () => {
    expect(goalEta({ target: 1000, current: 400, monthly: 100 })).toBe(6);
    expect(goalEta({ target: 1000, current: 400, monthly: 0 })).toBe(Infinity);
  });
});

describe("recurring", () => {
  const r = (day: number, extra: Partial<Recurring> = {}): Recurring => ({
    id: "r",
    owner_id: "a",
    visibility: "family",
    name: "Rent",
    icon: "house",
    amount: -1000,
    category_id: null,
    paid_by: null,
    day_of_month: day,
    active: true,
    last_posted_month: null,
    ...extra,
  });
  it("states: Added / Due / Next / Paused", () => {
    expect(recurringState(r(1, { last_posted_month: "2026-10" }), today)).toBe("added");
    expect(recurringState(r(9), today)).toBe("due");
    expect(recurringState(r(20), today)).toBe("next");
    expect(recurringState(r(9, { active: false }), today)).toBe("paused");
  });
  it("alerts 3 days before an outgoing item", () => {
    const b = budgetSummary([], [], today, 80);
    const ef = emergencyFund([], [], 6);
    const keys = (items: Recurring[]) =>
      buildAlerts({ today, budget: b, recurring: items, ef, warnPct: 80, closed: new Set() }).map((a) => a.key);
    expect(keys([r(10)])).toEqual(["rc-r-2026-10"]);
    expect(keys([r(11)])).toEqual([]);
    expect(keys([r(10, { amount: 2000 })])).toEqual([]); // money in
  });
});

describe("alerts", () => {
  it("flags over / near / fast flexible categories and hides closed ones", () => {
    const cats = [cat("over", 100), cat("near", 100), cat("fast", 100), cat("ok", 100), cat("fixed", 50, true)];
    const txs = [tx("over", -120), tx("near", -85), tx("fast", -45), tx("ok", -10), tx("fixed", -80)];
    const budget = budgetSummary(cats, txs, today, 80);
    const ef = emergencyFund([], cats, 6);
    const all = buildAlerts({ today, budget, recurring: [], ef, warnPct: 80, closed: new Set() });
    expect(all.filter((a) => a.area === "money").map((a) => [a.key, a.sev])).toEqual([
      ["over-over-2026-10", "urgent"],
      ["near-near-2026-10", "soon"],
      ["fast-fast-2026-10", "info"],
    ]);
    const after = buildAlerts({ today, budget, recurring: [], ef, warnPct: 80, closed: new Set(["over-over-2026-10"]) });
    expect(after.map((a) => a.key)).not.toContain("over-over-2026-10");
  });
});

describe("inScope (Private / Family)", () => {
  const row = (visibility: "family" | "private", owner_id: string, paid_by: string | null) => ({ visibility, owner_id, paid_by });
  it("family view never includes private rows, not even the viewer's own", () => {
    expect(inScope(row("private", "a", "a"), "family", "a")).toBe(false);
    expect(inScope(row("family", "b", "b"), "family", "a")).toBe(true);
  });
  it("a private row only shows in its owner's own view", () => {
    expect(inScope(row("private", "a", "a"), "a", "a")).toBe(true);
    expect(inScope(row("private", "a", "a"), "a", "b")).toBe(false);
    expect(inScope(row("private", "b", "b"), "b", "a")).toBe(false);
  });
});
