import { describe, expect, it } from "vitest";
import { lifeScore, scoreState } from "./life-score";
import type { BudgetSummary, EmergencyFund, Goal, Today } from "./money";

const today: Today = { y: 2026, m: 11, d: 15, iso: "2026-11-15", ym: "2026-11", daysInMonth: 30 };
const budget = (flexSpent: number, flexLimit = 1000) => ({ flexSpent, flexLimit }) as BudgetSummary;
const noFund = { goal: null, months: 0, target: 6 } as unknown as EmergencyFund;
const base = { today, budget: budget(0, 0), ef: noFund, goals: [], yearlyGoals: [], events: [], people: ["a"], viewerId: "a", priorities: [], learningMinutes: [], gym: [], gymGoal: 3 };
const goal = (monthly: number, current = 0, target = 100) => ({ monthly, current, target, is_emergency_fund: false }) as Goal;

describe("lifeScore", () => {
  it("has no score when nothing is logged", () => {
    const s = lifeScore(base);
    expect(s.total).toBeNull();
    expect(s.pillars.every((p) => p.score === null)).toBe(true);
  });

  it("gives full money marks while spending keeps pace with the month", () => {
    expect(lifeScore({ ...base, budget: budget(500) }).pillars[0].score).toBe(100);
    expect(lifeScore({ ...base, budget: budget(800) }).pillars[0].score).toBe(70);
  });

  it("counts a goal as moving when it has a monthly amount or is reached", () => {
    const s = lifeScore({ ...base, goals: [goal(50), goal(0, 100), goal(0), goal(0)] });
    expect(s.pillars[3].score).toBe(50);
  });

  it("leaves the emergency fund out of the goals pillar", () => {
    const fund = { ...goal(0), is_emergency_fund: true };
    expect(lifeScore({ ...base, goals: [fund] }).pillars[3].score).toBeNull();
  });

  it("counts only the viewer's workouts against their goal", () => {
    const row = (owner_id: string) => ({ owner_id, date: "2026-11-11" }) as never;
    const s = lifeScore({ ...base, gym: [row("a"), row("b"), row("b")] });
    expect(s.pillars[2].score).toBe(33);
  });

  it("weighs only the pillars that have a score", () => {
    const s = lifeScore({ ...base, budget: budget(500), goals: [goal(0)] });
    expect(s.total).toBe(Math.round((100 * 30) / 55));
  });
});

describe("scoreState", () => {
  it("uses the map's colour steps", () => {
    expect([scoreState(75), scoreState(60), scoreState(59), scoreState(null)]).toEqual(["ok", "warn", "bad", "neu"]);
  });
});
