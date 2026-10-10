import { describe, expect, it } from "vitest";
import {
  clashes,
  dayLabel,
  goalStatus,
  goalTip,
  monthShifts,
  nextFriday,
  shiftHours,
  shiftTags,
  weekLabel,
  weekStart,
  weekStrip,
  type CalEvent,
} from "./time";

const ev = (p: Partial<CalEvent>): CalEvent => ({
  id: Math.random().toString(36),
  owner_id: "r",
  visibility: "family",
  kind: "event",
  title: "x",
  date: "2026-10-14",
  start_time: null,
  end_time: null,
  who: null,
  remind_min: null,
  source: "manual",
  note: null,
  ...p,
});

describe("weeks", () => {
  it("starts on Monday and labels days", () => {
    expect(weekStart("2026-10-14")).toBe("2026-10-12"); // Wed → Mon
    expect(weekStart("2026-10-18")).toBe("2026-10-12"); // Sun → Mon
    expect(weekStart("2026-10-12")).toBe("2026-10-12");
    expect(dayLabel("2026-10-14")).toBe("Wed 14 Oct");
    expect(weekLabel("2026-09-28")).toBe("28 Sep – 4 Oct");
    expect(weekLabel("2026-10-12")).toBe("12 – 18 Oct");
    expect(nextFriday("2026-10-14")).toBe("2026-10-16");
    expect(nextFriday("2026-10-16")).toBe("2026-10-16");
  });
});

describe("shifts", () => {
  it("counts hours across midnight", () => {
    expect(shiftHours("18:00:00", "01:00:00")).toBe(7);
    expect(shiftHours("17:00", "02:00")).toBe(9);
    expect(shiftHours("10:00", "14:30")).toBe(4.5);
    expect(shiftHours(null, "14:00")).toBe(0);
  });

  it("tags night and Sunday shifts", () => {
    expect(shiftTags({ date: "2026-10-14", start_time: "18:00", end_time: "01:00" })).toEqual(["Night"]);
    expect(shiftTags({ date: "2026-10-18", start_time: "16:00", end_time: "23:00" })).toEqual(["Night", "Sunday"]);
    expect(shiftTags({ date: "2026-10-14", start_time: "10:00", end_time: "16:00" })).toEqual([]);
  });

  it("finds clashes with the worker's or shared plans only", () => {
    const shift = ev({ kind: "shift", start_time: "18:00", end_time: "01:00", owner_id: "r" });
    const study = ev({ title: "Study group", start_time: "19:00", end_time: "21:00", who: "r" });
    const together = ev({ title: "Dinner", start_time: "20:00" });
    const amnah = ev({ title: "Amnah call", start_time: "19:00", who: "a" });
    const morning = ev({ title: "Gym", start_time: "07:30", end_time: "08:30", who: "r" });
    expect(clashes(shift, [shift, study, together, amnah, morning]).map((e) => e.title)).toEqual(["Study group", "Dinner"]);
  });

  it("sums the month", () => {
    const list = [
      ev({ kind: "shift", date: "2026-10-14", start_time: "18:00", end_time: "01:00" }),
      ev({ kind: "shift", date: "2026-10-17", start_time: "17:00", end_time: "02:00" }),
      ev({ kind: "shift", date: "2026-11-01", start_time: "17:00", end_time: "02:00" }),
      ev({ date: "2026-10-15", start_time: "09:00", end_time: "17:00" }),
    ];
    expect(monthShifts(list, "2026-10")).toEqual({ count: 2, hours: 16 });
  });
});

describe("yearly goals", () => {
  const today = "2026-07-02"; // about half the year
  it("Ahead, On track, Behind against an even pace", () => {
    expect(goalStatus({ done: 80, target: 100, year: 2026 }, today).status).toBe("ahead");
    expect(goalStatus({ done: 50, target: 100, year: 2026 }, today).status).toBe("ontrack");
    expect(goalStatus({ done: 30, target: 100, year: 2026 }, today).status).toBe("behind");
    expect(goalStatus({ done: 100, target: 100, year: 2026 }, today).status).toBe("done");
  });

  it("tells the pace needed when behind", () => {
    expect(goalTip({ done: 30, target: 100, year: 2026, unit: "ECTS" }, today)).toMatch(/^To catch up: 2\.7 ECTS a week until 31 Dec\.$/);
    expect(goalTip({ done: 80, target: 100, year: 2026, unit: "orders" }, today)).toMatch(/^Ahead: it could be reached by \d+ \w{3}\.$/);
    // On track, but the even pace lands just after New Year: say what is needed instead.
    expect(goalTip({ done: 21, target: 30, year: 2026, unit: "ECTS" }, "2026-10-10")).toBe("At this pace about 27.1 ECTS by 31 Dec. 0.8 ECTS a week reaches 30.");
  });

  it("fills the 52-week strip", () => {
    const strip = weekStrip(
      [
        { date: "2026-01-02", amount: 5 }, // week 1, a full share (100/52 ≈ 1.9)
        { date: "2026-01-09", amount: 1 }, // week 2, part
      ],
      { target: 100, year: 2026 },
      "2026-01-20",
    );
    expect(strip).toHaveLength(52);
    expect(strip.slice(0, 4).map((s) => s.level)).toEqual([2, 1, 0, 0]);
    expect(strip[2].now).toBe(true);
    expect(strip[3].future).toBe(true);
  });
});
