import { describe, expect, it } from "vitest";
import { backoffMs, checkPin, makePinRecord } from "./pin";

describe("PIN", () => {
  it("is stored as a salted hash, never the PIN itself", async () => {
    const rec = await makePinRecord("1234");
    expect(JSON.stringify(rec)).not.toContain("1234");
    expect(await checkPin("1234", rec)).toBe(true);
    expect(await checkPin("4321", rec)).toBe(false);
    const again = await makePinRecord("1234");
    expect(again.hash).not.toBe(rec.hash); // different salt
  });

  it("waits 30 s after 5 wrong tries, doubling each time", () => {
    expect(backoffMs(4)).toBe(0);
    expect(backoffMs(5)).toBe(30_000);
    expect(backoffMs(6)).toBe(60_000);
    expect(backoffMs(7)).toBe(120_000);
  });
});
