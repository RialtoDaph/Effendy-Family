import { describe, expect, it } from "vitest";
import { buildMap } from "./life-map";
import type { LifeScore } from "./life-score";
import type { Today } from "./money";

const today: Today = { y: 2026, m: 11, d: 4, iso: "2026-11-04", ym: "2026-11", daysInMonth: 30 };
const score: LifeScore = {
  total: 70,
  pillars: (["money", "time", "health", "goals"] as const).map((k) => ({ k, score: k === "health" ? null : 70, lines: [] })),
};
const text = {
  hub: (k: string) => k,
  coreLabel: "Life Score",
  score: "Score",
  perMonth: "Per month",
  balance: "Balance",
  rate: "Interest",
  spent: "Spent",
  saved: "Saved",
  progress: "Progress",
  when: "When",
  eur: (n: number) => `€${n}`,
  day: (d: string) => d,
};
const base = { score, viewerId: "me", today, subscriptions: [], debts: [], categories: [], transactions: [], goals: [], events: [], learning: [], gym: [], text };
const goal = (id: string, owner_id: string, visibility: "family" | "private") =>
  ({ id, owner_id, visibility, name: id, target: 100, current: 10, monthly: 0 }) as never;

describe("buildMap", () => {
  it("always has the core, four areas and their links", () => {
    const { nodes, edges } = buildMap(base);
    expect(nodes.map((n) => n.kind)).toEqual(["core", "hub", "hub", "hub", "hub"]);
    expect(edges).toHaveLength(8);
  });

  it("shows an area without a score as neutral", () => {
    expect(buildMap(base).nodes.find((n) => n.id === "h-health")?.st).toBe("neu");
  });

  it("shows your own private goal but never a partner's", () => {
    const { nodes } = buildMap({ ...base, goals: [goal("shared", "partner", "family"), goal("mine", "me", "private"), goal("theirs", "partner", "private")] });
    const labels = nodes.filter((n) => n.kind === "goal").map((n) => n.label);
    expect(labels).toEqual(["shared", "mine"]);
  });

  it("only places events from today through the next 6 days", () => {
    const ev = (id: string, date: string) => ({ id, date, title: id, kind: "event", visibility: "family", owner_id: "me", start_time: null }) as never;
    const { nodes } = buildMap({ ...base, events: [ev("past", "2026-11-03"), ev("soon", "2026-11-10"), ev("late", "2026-11-11")] });
    expect(nodes.filter((n) => n.kind === "event").map((n) => n.label)).toEqual(["soon"]);
  });

  it("links every item to its area", () => {
    const { nodes, edges } = buildMap({ ...base, goals: [goal("a", "me", "family")] });
    const item = nodes.find((n) => n.kind === "goal")!;
    expect(edges).toContainEqual(["h-goals", item.id]);
    expect(item.pos).not.toEqual([0, 0, 0]);
  });
});
