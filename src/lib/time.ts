// Phase 4: week board, shifts, yearly goals, learning, gym, journal, dates.
// Dates are YYYY-MM-DD in Europe/Berlin; times are "HH:MM" (the database
// sends "HH:MM:SS", which every helper here accepts).

import type { Visibility } from "@/lib/money";

type Owned = { id: string; owner_id: string; visibility: Visibility; created_at?: string };

export type CalEvent = Owned & {
  kind: "event" | "shift";
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  who: string | null; // member id, null = Together
  remind_min: number | null;
  source: "manual" | "roster";
  note: string | null;
};
export type WeekPriority = Owned & { week_start: string; title: string; who: string | null; done: boolean; sort: number };
export type YearlyGoal = Owned & {
  year: number;
  name: string;
  icon: string;
  target: number;
  unit: string;
  done: number;
  step: string | null;
  who: string | null;
};
export type GoalProgress = Owned & { goal_id: string; date: string; amount: number };
export type LearningItem = Owned & {
  track: string;
  title: string;
  type: "book" | "course" | "other";
  who: string | null;
  pct: number;
  next: string | null;
};
export type LearningMinute = Owned & { date: string; minutes: number; item_id: string | null };
export type GymSession = Owned & { type: string; icon: string; date: string; time: string | null };
export type JournalEntry = Owned & { date: string; text: string };
export type DateIdea = Owned & { name: string; short: string | null; icon: string; cost: number | null };
export type DateNight = Owned & {
  name: string;
  icon: string;
  date: string;
  cost: number | null;
  rating: number | null;
  note: string | null;
  idea_id: string | null;
  event_id: string | null;
};

export type CareerStep = Owned & { plan: string; title: string; timing: string | null; status: "done" | "now" | "next"; sort: number };

/* Dates ----------------------------------------------------------------------- */

const utc = (iso: string) => new Date(`${iso}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(day: string, n: number) {
  const d = utc(day);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

/** 1 = Monday … 7 = Sunday. */
export function isoDow(day: string) {
  return utc(day).getUTCDay() || 7;
}

/** The Monday of the week that contains `day`. */
export function weekStart(day: string) {
  return addDays(day, 1 - isoDow(day));
}

export function weekDays(monday: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Wed 14 Oct". */
export function dayLabel(day: string) {
  const d = utc(day);
  return `${DOW[isoDow(day) - 1]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}

export function dowShort(day: string) {
  return DOW[isoDow(day) - 1];
}

/** "5 – 11 Oct" or "28 Sep – 4 Oct". */
export function weekLabel(monday: string) {
  const a = utc(monday);
  const b = utc(addDays(monday, 6));
  const left = a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()}` : `${a.getUTCDate()} ${MON[a.getUTCMonth()]}`;
  return `${left} – ${b.getUTCDate()} ${MON[b.getUTCMonth()]}`;
}

/** "2026-10" → the 42 days (6 weeks, Monday first) shown in a month grid. */
export function monthGrid(ym: string) {
  const first = weekStart(`${ym}-01`);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function addMonths(ym: string, n: number) {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** "October 2026". */
export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1]} ${y}`;
}

/* Times and shifts ------------------------------------------------------------ */

/** "18:00:00" → "18:00". */
export const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

const minutesOf = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Length in hours; an end earlier than the start means after midnight. */
export function shiftHours(start: string | null, end: string | null) {
  if (!start || !end) return 0;
  let mins = minutesOf(end) - minutesOf(start);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

/** "18:00 – 01:00". */
export function timeRange(e: Pick<CalEvent, "start_time" | "end_time">, allDay = "All day") {
  if (!e.start_time) return allDay;
  return e.end_time ? `${hm(e.start_time)} – ${hm(e.end_time)}` : hm(e.start_time);
}

/** README: upcoming shifts with Night / Sunday tags. Night = still working at 23:00 or later. */
export function shiftTags(e: Pick<CalEvent, "date" | "start_time" | "end_time">) {
  const tags: string[] = [];
  if (e.start_time && e.end_time) {
    const s = minutesOf(e.start_time);
    const end = minutesOf(e.end_time);
    if (end <= s || end >= 23 * 60) tags.push("Night");
  }
  if (isoDow(e.date) === 7) tags.push("Sunday");
  return tags;
}

/** Minutes from the start of `e.date`; overnight ends go past 24:00. */
function span(e: Pick<CalEvent, "start_time" | "end_time">): [number, number] | null {
  if (!e.start_time) return null;
  const s = minutesOf(e.start_time);
  let end = e.end_time ? minutesOf(e.end_time) : s + 60;
  if (end <= s) end += 24 * 60;
  return [s, end];
}

/** Other plans that overlap a shift: same day, for the person working or for both of you. */
export function clashes(shift: CalEvent, events: CalEvent[]) {
  const a = span(shift);
  if (!a) return [];
  return events.filter((e) => {
    if (e.id === shift.id || e.date !== shift.date || e.kind === "shift") return false;
    if (e.who && e.who !== shift.owner_id) return false;
    const b = span(e);
    return !!b && b[0] < a[1] && a[0] < b[1];
  });
}

export function monthShifts(events: CalEvent[], ym: string) {
  const list = events.filter((e) => e.kind === "shift" && e.date.startsWith(ym));
  return { count: list.length, hours: list.reduce((h, e) => h + shiftHours(e.start_time, e.end_time), 0) };
}

/** Hours worked after midnight, for "9 of them after midnight". */
export function afterMidnightHours(e: Pick<CalEvent, "start_time" | "end_time">) {
  const s = span(e);
  return s ? Math.max(0, s[1] - Math.max(s[0], 24 * 60)) / 60 : 0;
}

/**
 * Tax-free bonus a shift can carry under §3b EStG, in euro, on an hourly wage
 * (capped at €50): 25% from 20:00 to 06:00, 40% from 00:00 to 04:00 when the
 * shift began before midnight, 50% on Sundays until 04:00 Monday. They add up.
 */
export function shiftBonus(e: Pick<CalEvent, "date" | "start_time" | "end_time">, wage: number) {
  const s = e.end_time ? span(e) : null;
  if (!s || wage <= 0) return 0;
  let rateMinutes = 0;
  for (let t = s[0]; t < s[1]; t++) {
    const nextDay = t >= 24 * 60;
    const h = (t % (24 * 60)) / 60;
    const dow = isoDow(addDays(e.date, nextDay ? 1 : 0));
    if (h < 4 && nextDay) rateMinutes += 0.4;
    else if (h >= 20 || h < 6) rateMinutes += 0.25;
    if (dow === 7 || (nextDay && h < 4 && isoDow(e.date) === 7)) rateMinutes += 0.5;
  }
  return (rateMinutes / 60) * Math.min(wage, 50);
}

/** Days whose evening (17:00–23:00) nobody in `people` has a plan or a shift. All-day items do not block an evening. */
export function freeEvenings(events: CalEvent[], people: string[], days: string[]) {
  return days.filter(
    (d) =>
      !events.some((e) => {
        const who = e.kind === "shift" ? e.owner_id : e.who;
        if (e.date !== d || (who && !people.includes(who))) return false;
        const b = span(e);
        return !!b && b[0] < 23 * 60 && 17 * 60 < b[1];
      }),
  );
}

/** Events for one day, earliest first; all-day items on top. */
export function dayEvents(events: CalEvent[], day: string) {
  return events
    .filter((e) => e.date === day)
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? "") || a.title.localeCompare(b.title));
}

/* Yearly goals ---------------------------------------------------------------- */

function dayOfYear(day: string) {
  const d = utc(day);
  return Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1, 12)) / 864e5) + 1;
}

const daysInYear = (y: number) => (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 366 : 365);

export type GoalStatus = "ahead" | "ontrack" | "behind" | "done";

/** Compares progress with where an even pace would be today. */
export function goalStatus(goal: Pick<YearlyGoal, "done" | "target" | "year">, today: string) {
  const y = Number(today.slice(0, 4));
  const share = goal.year < y ? 1 : goal.year > y ? 0 : dayOfYear(today) / daysInYear(y);
  const expected = goal.target * share;
  const pct = Math.min(100, Math.round((goal.done / goal.target) * 100));
  if (goal.done >= goal.target) return { status: "done" as GoalStatus, pct, expected };
  if (expected <= 0) return { status: "ontrack" as GoalStatus, pct, expected };
  const ratio = goal.done / expected;
  const status: GoalStatus = ratio >= 1.05 ? "ahead" : ratio >= 0.9 ? "ontrack" : "behind";
  return { status, pct, expected };
}

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  ahead: "Ahead",
  ontrack: "On track",
  behind: "Behind",
  done: "Done",
};

const tenth = (n: number) => Math.round(n * 10) / 10;

export type GoalTip =
  | { key: "tip_done" }
  | { key: "tip_behind" | "tip_start"; rate: number }
  | { key: "tip_pace"; rate: number; byEnd: number }
  | { key: "tip_ahead" | "tip_on_pace"; date: string };

/** The pace needed or the date it could be reached, as a message key and its values. */
export function goalTip(goal: Pick<YearlyGoal, "done" | "target" | "year">, today: string): GoalTip {
  const { status } = goalStatus(goal, today);
  const y = goal.year;
  const doy = Number(today.slice(0, 4)) === y ? dayOfYear(today) : 1;
  const left = goal.target - goal.done;
  const weeksLeft = Math.max(1, (daysInYear(y) - doy) / 7);
  const rate = tenth(left / weeksLeft);
  if (status === "done") return { key: "tip_done" };
  if (status === "behind") return { key: "tip_behind", rate };
  const perDay = goal.done / Math.max(1, doy);
  if (perDay <= 0) return { key: "tip_start", rate };
  const date = addDays(today, Math.ceil(left / perDay));
  if (Number(date.slice(0, 4)) > y) return { key: "tip_pace", rate, byEnd: tenth(goal.done + perDay * (daysInYear(y) - doy)) };
  return { key: status === "ahead" ? "tip_ahead" : "tip_on_pace", date };
}

/** ISO week number, 1–53. */
export function weekOfYear(day: string) {
  return Math.floor((dayOfYear(addDays(weekStart(day), 3)) - 1) / 7) + 1;
}

/** 52 squares: 0 = nothing logged, 1 = some, 2 = a full week's share; `future` after this week. */
export function weekStrip(progress: Pick<GoalProgress, "date" | "amount">[], goal: Pick<YearlyGoal, "target" | "year">, today: string) {
  const sums = new Array<number>(52).fill(0);
  for (const p of progress) {
    if (Number(p.date.slice(0, 4)) !== goal.year) continue;
    sums[Math.min(51, Math.floor((dayOfYear(p.date) - 1) / 7))] += p.amount;
  }
  const y = Number(today.slice(0, 4));
  const current = y > goal.year ? 52 : y < goal.year ? -1 : Math.min(51, Math.floor((dayOfYear(today) - 1) / 7));
  const share = goal.target / 52;
  return sums.map((s, i) => ({ level: s <= 0 ? 0 : s >= share ? 2 : 1, future: i > current, now: i === current }));
}

/* Learning and gym ------------------------------------------------------------ */

/** Minutes this week per member id. */
export function minutesThisWeek(rows: LearningMinute[], monday: string) {
  const end = addDays(monday, 7);
  const out = new Map<string, number>();
  for (const r of rows) if (r.date >= monday && r.date < end) out.set(r.owner_id, (out.get(r.owner_id) ?? 0) + r.minutes);
  return out;
}

/** Sessions this week per member id. */
export function sessionsThisWeek(rows: GymSession[], monday: string) {
  const end = addDays(monday, 7);
  const out = new Map<string, number>();
  for (const r of rows) if (r.date >= monday && r.date < end) out.set(r.owner_id, (out.get(r.owner_id) ?? 0) + 1);
  return out;
}

/** The last `n` weeks, oldest first, ending with the week of `monday`: one total per week. */
export function weekTotals<T extends { date: string }>(rows: T[], monday: string, n: number, value: (row: T) => number) {
  const out = new Array<number>(n).fill(0);
  const first = addDays(monday, -7 * (n - 1));
  const end = addDays(monday, 7);
  for (const r of rows) {
    if (r.date < first || r.date >= end) continue;
    out[Math.floor((utc(r.date).getTime() - utc(first).getTime()) / (7 * 864e5))] += value(r);
  }
  return out;
}

/** Weeks in a row at or above the goal. This week counts once it is met, and never breaks the run. */
export function weekStreak(totals: number[], goal: number) {
  if (goal <= 0) return 0;
  const past = totals.slice(0, -1);
  let n = 0;
  for (let i = past.length - 1; i >= 0 && past[i] >= goal; i--) n++;
  return n + ((totals.at(-1) ?? 0) >= goal ? 1 : 0);
}

/** A recurring payment that looks like a gym membership. */
export const isGymName = (name: string) => /\b(gym|fitness|fit\w*|mcfit|sport\w*|clever fit|urban sports)\b/i.test(name);

/** The coming Friday (today if it is Friday). */
export function nextFriday(today: string) {
  return addDays(today, (5 - isoDow(today) + 7) % 7);
}
