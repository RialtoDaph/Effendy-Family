import { describe, expect, it } from "vitest";
import { activePlan, billStatus, lockedBy, planOfPrice, priceEnv } from "./plans";

describe("plans", () => {
  it("locks screens above the plan", () => {
    expect(lockedBy("/journal", "life")).toBe("plus");
    expect(lockedBy("/together", "plus")).toBe("together");
    expect(lockedBy("/together", "together")).toBeNull();
    expect(lockedBy("/budget", "life")).toBeNull();
    expect(lockedBy("/", "life")).toBeNull();
  });

  it("falls back to Life when cancelled", () => {
    expect(activePlan({ plan: "together", status: "cancelled" })).toBe("life");
    expect(activePlan({ plan: "plus", status: "past_due" })).toBe("plus");
  });

  it("reads Stripe's status and prices", () => {
    expect(billStatus("canceled")).toBe("cancelled");
    expect(billStatus("trialing")).toBe("trial");
    expect(billStatus("something_new")).toBe("past_due");
    expect(priceEnv("plus", "year")).toBe("STRIPE_PRICE_PLUS_YEAR");
    expect(planOfPrice("p2", { STRIPE_PRICE_LIFE_MONTH: "p1", STRIPE_PRICE_TOGETHER_YEAR: "p2" })).toEqual({ plan: "together", interval: "year" });
    expect(planOfPrice("nope", {})).toBeNull();
  });
});
