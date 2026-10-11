import { describe, expect, it } from "vitest";
import { searchData, type SearchData } from "./search";

const base: SearchData = {
  viewerId: "r",
  transactions: [],
  recurring: [],
  incomes: [],
  goals: [],
  categories: [],
  subscriptions: [],
  debts: [],
  assets: [],
  events: [],
  yearlyGoals: [],
  learningItems: [],
  dateIdeas: [],
  journal: [],
};

const data: SearchData = {
  ...base,
  recurring: [{ id: "rent", owner_id: "r", visibility: "family", name: "Rent", icon: "house", amount: -1335, category_id: null, paid_by: null, day_of_month: 1, active: true, last_posted_month: null }],
  categories: [{ id: "c1", name: "Rent & utilities", icon: "house", monthly_limit: 1335, is_fixed: true, sort: 0 } as SearchData["categories"][number]],
  transactions: Array.from({ length: 8 }, (_, i) => ({
    id: `t${i}`,
    owner_id: "r",
    visibility: "family" as const,
    date: `2026-10-0${i + 1}`,
    amount: -10,
    payee: "Rewe Markt",
    category_id: null,
    paid_by: null,
    source: "manual" as const,
    recurring_id: null,
    note: null,
    created_at: "",
  })),
  journal: [
    { id: "j1", owner_id: "r", visibility: "private", date: "2026-10-01", text: "Rent talk with the landlord" },
    { id: "j2", owner_id: "a", visibility: "family", date: "2026-10-02", text: "Rent is going up" },
  ],
};

describe("search", () => {
  it("finds data by name, best match first", () => {
    const hits = searchData("rent", data);
    expect(hits[0]).toMatchObject({ kind: "recurring", label: "Rent", form: "recur" });
    expect(hits.map((h) => h.kind)).toContain("category");
  });

  it("ignores case and accents, needs every word", () => {
    expect(searchData("RENT utilities", data).map((h) => h.id)).toEqual(["c1"]);
    expect(searchData("rént", data)[0].id).toBe("rent");
    expect(searchData("rent garage", data)).toEqual([]);
  });

  it("shows at most 5 transactions", () => {
    expect(searchData("rewe", data).filter((h) => h.kind === "transaction")).toHaveLength(5);
  });

  it("only offers your own journal notes", () => {
    const ids = searchData("rent", data).filter((h) => h.kind === "journal").map((h) => h.id);
    expect(ids).toEqual(["j1"]);
  });
});
