// Plans, prices and which screens each plan opens (README → Plans).

export type PlanKey = "life" | "plus" | "together";
export type BillInterval = "month" | "year";
export type BillStatus = "trial" | "active" | "past_due" | "cancelled";

export const PLAN_ORDER: PlanKey[] = ["life", "plus", "together"];

export const PLANS: Record<PlanKey, { name: string; month: number; year: number; seats: number; ai: number; voiceMin: number; level: number; short: string }> = {
  life: { name: "Life", month: 12.9, year: 129, seats: 1, ai: 20, voiceMin: 0, level: 0, short: "L" },
  plus: { name: "Life Plus", month: 19.9, year: 199, seats: 1, ai: 0, voiceMin: 60, level: 1, short: "L+" },
  together: { name: "Together", month: 29.9, year: 299, seats: 4, ai: 0, voiceMin: 120, level: 2, short: "T" },
};

/** Screens above the Life plan: 1 = Life Plus and up, 2 = Together. */
export const GATE: Record<string, 1 | 2> = { map: 1, tax: 1, biz: 1, invest: 1, sim: 1, career: 1, gym: 1, journal: 1, learn: 1, together: 2 };

export const planForLevel = (level: number): PlanKey => (level > 1 ? "together" : "plus");

export type Billing = { plan: PlanKey; interval: BillInterval; status: BillStatus; seats: number; current_period_end: string | null };

/** No row yet reads as the trial's default, the same as private.ai_plan(). */
export const BILLING_START: Billing = { plan: "together", interval: "month", status: "trial", seats: 4, current_period_end: null };

/** A cancelled plan falls back to Life, also the rule for the assistant's quota. */
export const activePlan = (b: Pick<Billing, "plan" | "status">): PlanKey => (b.status === "cancelled" ? "life" : b.plan);

/** The plan a screen needs, or null when this plan opens it. `path` has no locale. */
export function lockedBy(path: string, plan: PlanKey): PlanKey | null {
  const level = GATE[path.split("/")[1] ?? ""];
  return level && level > PLANS[plan].level ? planForLevel(level) : null;
}

const STRIPE_STATUS: Record<string, BillStatus> = {
  trialing: "trial",
  active: "active",
  past_due: "past_due",
  unpaid: "past_due",
  incomplete: "past_due",
  canceled: "cancelled",
  incomplete_expired: "cancelled",
  paused: "cancelled",
};

export const billStatus = (stripe: string): BillStatus => STRIPE_STATUS[stripe] ?? "past_due";

/** The env name holding the Stripe price of a plan, e.g. STRIPE_PRICE_PLUS_YEAR. */
export const priceEnv = (plan: PlanKey, interval: BillInterval) => `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`;

/** Finds the plan behind a Stripe price id. */
export function planOfPrice(priceId: string, env: Record<string, string | undefined>): { plan: PlanKey; interval: BillInterval } | null {
  for (const plan of PLAN_ORDER) {
    for (const interval of ["month", "year"] as const) {
      if (env[priceEnv(plan, interval)] === priceId) return { plan, interval };
    }
  }
  return null;
}
