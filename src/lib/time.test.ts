import { describe, expect, it } from "vitest";
import {
  addMonths,
  afterMidnightHours,
  clashes,
  freeEvenings,
  isGymName,
  shiftBonus,
  weekOfYear,
  weekStreak,
  weekTotals,
  monthGrid,
  monthLabel,
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

describe("month grid", () => {
  it("shows six weeks starting on the Monday before the 1st", () => {
    const g = monthGrid("2026-10"); // 1 Oct 2026 is a Thursday
    expect(g).toHaveLength(42);
    expect(g[0]).toBe("2026-09-28");
    expect(g[3]).toBe("2026-10-01");
    expect(g[41]).toBe("2026-11-08");
    expect(monthGrid("2026-06")[0]).toBe("2026-06-01"); // starts on a Monday
  });

  it("moves between months and names them", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthLabel("2026-10")).toBe("October 2026");
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
    expect(goalTip({ done: 30, target: 100, year: 2026 }, today)).toEqual({ key: "tip_behind", rate: 2.7 });
    expect(goalTip({ done: 80, target: 100, year: 2026 }, today)).toMatchObject({ key: "tip_ahead", date: expect.stringMatching(/^2026-/) });
    // On track, but the even pace lands just after New Year: say what is needed instead.
    expect(goalTip({ done: 21, target: 30, year: 2026 }, "2026-10-10")).toEqual({ key: "tip_pace", rate: 0.8, byEnd: 27.1 });
    expect(goalTip({ done: 30, target: 30, year: 2026 }, today)).toEqual({ key: "tip_done" });
  });

  it("counts ISO weeks", () => {
    expect(weekOfYear("2026-10-07")).toBe(41);
    expect(weekOfYear("2026-01-01")).toBe(1);
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

describe("shift pay and free evenings", () => {
  const shift = (date: string, start: string, end: string) => ev({ kind: "shift", date, start_time: start, end_time: end });

  it("counts hours after midnight", () => {
    expect(afterMidnightHours(shift("2026-10-16", "18:00", "01:30"))).toBe(1.5);
    expect(afterMidnightHours(shift("2026-10-16", "10:00", "18:00"))).toBe(0);
  });

  it("estimates the night and Sunday bonus", () => {
    // Friday: 4 h at 25%, 1 h at 40%.
    expect(shiftBonus(shift("2026-10-16", "18:00", "01:00"), 15)).toBeCloseTo(21);
    // Sunday 10–14: 4 h at 50%.
    expect(shiftBonus(shift("2026-10-18", "10:00", "14:00"), 20)).toBeCloseTo(40);
    // Saturday into Sunday: the hour after midnight is night and Sunday.
    expect(shiftBonus(shift("2026-10-17", "23:00", "01:00"), 10)).toBeCloseTo(0.25 * 10 + 0.9 * 10);
    expect(shiftBonus(shift("2026-10-16", "09:00", "17:00"), 15)).toBe(0);
    expect(shiftBonus(shift("2026-10-16", "18:00", "01:00"), 0)).toBe(0);
  });

  it("finds evenings free for everyone", () => {
    const days = ["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"];
    const events = [
      ev({ kind: "shift", owner_id: "a", date: days[0], start_time: "18:00", end_time: "01:00" }),
      ev({ who: "b", date: days[1], start_time: "19:00" }),
      ev({ who: "b", date: days[2], start_time: "09:00", end_time: "12:00" }),
      ev({ who: null, date: days[3] }),
    ];
    expect(freeEvenings(events, ["a", "b"], days)).toEqual([days[2], days[3]]);
    expect(freeEvenings(events, ["a"], days)).toEqual([days[1], days[2], days[3]]);
  });
});

describe("weekly history", () => {
  it("adds rows into their week, oldest first", () => {
    const rows = [
      { date: "2026-10-12", n: 30 },
      { date: "2026-10-18", n: 10 },
      { date: "2026-10-05", n: 5 },
      { date: "2026-09-01", n: 99 },
      { date: "2026-10-19", n: 99 },
    ];
    expect(weekTotals(rows, "2026-10-12", 3, (r) => r.n)).toEqual([0, 5, 40]);
  });

  it("keeps a streak while this week is still open", () => {
    expect(weekStreak([3, 1, 3, 4, 0], 3)).toBe(2);
    expect(weekStreak([3, 3, 3], 3)).toBe(3);
    expect(weekStreak([1, 1, 3], 3)).toBe(1);
    expect(weekStreak([3, 3], 0)).toBe(0);
  });

  it("spots a gym membership", () => {
    expect(isGymName("FitStudio")).toBe(true);
    expect(isGymName("McFIT Mitgliedschaft")).toBe(true);
    expect(isGymName("Netflix")).toBe(false);
    expect(isGymName("Profit share")).toBe(false);
  });
});
