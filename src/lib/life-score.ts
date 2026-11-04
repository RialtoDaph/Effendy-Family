// Life Score: four pillars, each 0–100, from what the household actually logged.
// The handoff shows the score but gives no formula, so this one is ours. A pillar
// with nothing logged has no score and drops out of the total.

import type { BudgetSummary, EmergencyFund, Goal, Today } from "./money";
import {
  addDays,
  freeEvenings,
  goalStatus,
  minutesThisWeek,
  sessionsThisWeek,
  weekStart,
  type CalEvent,
  type GymSession,
  type LearningMinute,
  type WeekPriority,
  type YearlyGoal,
} from "./time";

export type PillarKey = "money" | "time" | "health" | "goals";
export type ScoreState = "ok" | "warn" | "bad" | "neu";
export type ScoreLine =
  | { key: "flex"; good: boolean; pct: number }
  | { key: "ef"; good: boolean; months: number; target: number }
  | { key: "evenings"; good: boolean; n: number }
  | { key: "focus"; good: boolean; done: number; total: number }
  | { key: "learn"; good: boolean; minutes: number }
  | { key: "gym"; good: boolean; done: number; goal: number }
  | { key: "goals"; good: boolean; done: number; total: number }
  | { key: "yearly"; good: boolean; done: number; total: number };

export type Pillar = { k: PillarKey; score: number | null; lines: ScoreLine[] };
export type LifeScore = { total: number | null; pillars: Pillar[] };

const WEIGHTS: Record<PillarKey, number> = { money: 30, time: 25, health: 20, goals: 25 };
const EVENINGS_GOAL = 3;
const LEARN_GOAL_MINUTES = 60;

const unit = (n: number) => Math.max(0, Math.min(1, n));
const toScore = (parts: number[]) => (parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) : null);

/** Green from 75, amber from 60, as on the prototype's map. */
export function scoreState(score: number | null): ScoreState {
  if (score === null) return "neu";
  return score >= 75 ? "ok" : score >= 60 ? "warn" : "bad";
}

export function lifeScore(input: {
  today: Today;
  budget: BudgetSummary;
  ef: EmergencyFund;
  goals: Goal[];
  yearlyGoals: YearlyGoal[];
  events: CalEvent[];
  people: string[];
  viewerId: string;
  priorities: WeekPriority[];
  learningMinutes: LearningMinute[];
  gym: GymSession[];
  gymGoal: number;
}): LifeScore {
  const { today, budget, ef, goals, yearlyGoals, events, people, viewerId, priorities, learningMinutes, gym, gymGoal } = input;
  const monday = weekStart(today.iso);

  // Money: spending keeps pace with the month, and the emergency fund is filling.
  const money: Pillar = { k: "money", score: null, lines: [] };
  if (budget.flexLimit > 0) {
    const used = budget.flexSpent / budget.flexLimit;
    const pace = unit(1 - Math.max(0, used - today.d / today.daysInMonth));
    const cover = ef.goal && ef.target > 0 ? unit(ef.months / ef.target) : null;
    money.score = cover === null ? Math.round(pace * 100) : Math.round((pace * 0.7 + cover * 0.3) * 100);
    money.lines.push({ key: "flex", good: pace >= 0.9, pct: Math.round(used * 100) });
    if (cover !== null) money.lines.push({ key: "ef", good: cover >= 0.5, months: Math.floor(ef.months * 10) / 10, target: ef.target });
  }

  // Time: free evenings ahead, this week's priorities, minutes spent learning.
  const time: Pillar = { k: "time", score: null, lines: [] };
  const timeParts: number[] = [];
  if (events.length) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(today.iso, i));
    const n = freeEvenings(events, people, days).length;
    timeParts.push(unit(n / EVENINGS_GOAL));
    time.lines.push({ key: "evenings", good: n >= EVENINGS_GOAL, n });
  }
  const week = priorities.filter((p) => p.week_start === monday);
  if (week.length) {
    const done = week.filter((p) => p.done).length;
    timeParts.push(done / week.length);
    time.lines.push({ key: "focus", good: done * 2 >= week.length, done, total: week.length });
  }
  // Learning and workouts are personal goals, so they count the person looking.
  if (learningMinutes.length) {
    const minutes = minutesThisWeek(learningMinutes, monday).get(viewerId) ?? 0;
    timeParts.push(unit(minutes / LEARN_GOAL_MINUTES));
    time.lines.push({ key: "learn", good: minutes >= LEARN_GOAL_MINUTES, minutes });
  }
  time.score = toScore(timeParts);

  // Health: workouts against the weekly goal.
  const health: Pillar = { k: "health", score: null, lines: [] };
  if (gym.length) {
    const done = sessionsThisWeek(gym, monday).get(viewerId) ?? 0;
    health.score = toScore([unit(done / Math.max(1, gymGoal))]);
    health.lines.push({ key: "gym", good: done >= gymGoal, done, goal: gymGoal });
  }

  // Goals: money goals with a monthly amount or already reached, and yearly goals not behind.
  const goalsP: Pillar = { k: "goals", score: null, lines: [] };
  const goalParts: number[] = [];
  const real = goals.filter((g) => !g.is_emergency_fund);
  if (real.length) {
    const moving = real.filter((g) => g.monthly > 0 || g.current >= g.target).length;
    goalParts.push(moving / real.length);
    goalsP.lines.push({ key: "goals", good: moving === real.length, done: moving, total: real.length });
  }
  if (yearlyGoals.length) {
    const fine = yearlyGoals.filter((g) => goalStatus(g, today.iso).status !== "behind").length;
    goalParts.push(fine / yearlyGoals.length);
    goalsP.lines.push({ key: "yearly", good: fine === yearlyGoals.length, done: fine, total: yearlyGoals.length });
  }
  goalsP.score = toScore(goalParts);

  const pillars = [money, time, health, goalsP];
  const scored = pillars.filter((p) => p.score !== null);
  const weight = scored.reduce((a, p) => a + WEIGHTS[p.k], 0);
  const total = weight ? Math.round(scored.reduce((a, p) => a + p.score! * WEIGHTS[p.k], 0) / weight) : null;
  return { total, pillars };
}
