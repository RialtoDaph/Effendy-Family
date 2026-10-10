"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAppData } from "@/components/app-data";
import { SYNCED_EVENT, useMoney } from "@/components/money-data";
import { QUEUED, enqueue, isNetworkError } from "@/lib/offline-queue";
import { supabase } from "@/lib/supabase";
import {
  addDays,
  type CalEvent,
  type CareerStep,
  type DateIdea,
  type DateNight,
  type GoalProgress,
  type GymSession,
  type JournalEntry,
  type LearningItem,
  type LearningMinute,
  type WeekPriority,
  type YearlyGoal,
} from "@/lib/time";

type TimeRows = {
  events: CalEvent[];
  priorities: WeekPriority[];
  yearlyGoals: YearlyGoal[];
  goalProgress: GoalProgress[];
  learningItems: LearningItem[];
  learningMinutes: LearningMinute[];
  gym: GymSession[];
  journal: JournalEntry[];
  dateIdeas: DateIdea[];
  dateNights: DateNight[];
  careerSteps: CareerStep[];
};

export type TimeTable =
  | "events"
  | "week_priorities"
  | "yearly_goals"
  | "goal_progress"
  | "learning_items"
  | "learning_minutes"
  | "gym_sessions"
  | "journal_entries"
  | "date_ideas"
  | "date_nights"
  | "career_steps";

const ROW_KEY: Record<TimeTable, keyof TimeRows> = {
  events: "events",
  week_priorities: "priorities",
  yearly_goals: "yearlyGoals",
  goal_progress: "goalProgress",
  learning_items: "learningItems",
  learning_minutes: "learningMinutes",
  gym_sessions: "gym",
  journal_entries: "journal",
  date_ideas: "dateIdeas",
  date_nights: "dateNights",
  career_steps: "careerSteps",
};

type Time = TimeRows & {
  loaded: boolean;
  reload: () => Promise<void>;
  /** Insert (no id) or update; returns an error text, QUEUED when offline, or null. */
  save: (table: TimeTable, values: Record<string, unknown>, id?: string) => Promise<string | null>;
  remove: (table: TimeTable, id: string) => Promise<string | null>;
  /** Several inserts at once (roster). Duplicates are skipped. Returns how many were new. */
  insertMany: (table: TimeTable, rows: Record<string, unknown>[]) => Promise<{ added: number; error?: string }>;
};

const EMPTY: TimeRows = {
  events: [],
  priorities: [],
  yearlyGoals: [],
  goalProgress: [],
  learningItems: [],
  learningMinutes: [],
  gym: [],
  journal: [],
  dateIdeas: [],
  dateNights: [],
  careerSteps: [],
};

const TimeContext = createContext<Time | null>(null);

export function useTime() {
  const v = useContext(TimeContext);
  if (!v) throw new Error("useTime must be used inside <TimeProvider>");
  return v;
}

const cacheKey = (userId: string) => `ef-time-v1-${userId}`;

export function TimeProvider({ children }: { children: ReactNode }) {
  const { userId } = useAppData();
  const { today } = useMoney();
  const [rows, setRows] = useState<TimeRows>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!userId || today.y < 2026) return; // wait for the real date
    const sb = supabase();
    const recent = addDays(today.iso, -120);
    const yearStart = `${today.y}-01-01`;
    const res = await Promise.all([
      sb.from("events").select("*").gte("date", addDays(today.iso, -62)).order("date").order("start_time").limit(2000),
      sb.from("week_priorities").select("*").gte("week_start", addDays(today.iso, -62)).order("sort"),
      sb.from("yearly_goals").select("*").gte("year", today.y - 1).order("created_at"),
      sb.from("goal_progress").select("*").gte("date", `${today.y - 1}-01-01`).order("date"),
      sb.from("learning_items").select("*").order("created_at"),
      sb.from("learning_minutes").select("*").gte("date", recent).order("date", { ascending: false }),
      sb.from("gym_sessions").select("*").gte("date", yearStart).order("date", { ascending: false }).order("time", { ascending: false }),
      sb.from("journal_entries").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }).limit(300),
      sb.from("date_ideas").select("*").order("created_at"),
      sb.from("date_nights").select("*").order("date", { ascending: false }).limit(300),
      sb.from("career_steps").select("*").order("plan").order("sort").order("created_at"),
    ]);
    if (res.some((r) => r.error)) return; // offline: keep what we have
    const [events, pr, yg, gp, li, lm, gym, jn, di, dn, cs] = res.map((r) => r.data);
    const next: TimeRows = {
      events: events as CalEvent[],
      priorities: pr as WeekPriority[],
      yearlyGoals: yg as YearlyGoal[],
      goalProgress: gp as GoalProgress[],
      learningItems: li as LearningItem[],
      learningMinutes: lm as LearningMinute[],
      gym: gym as GymSession[],
      journal: jn as JournalEntry[],
      dateIdeas: di as DateIdea[],
      dateNights: dn as DateNight[],
      careerSteps: cs as CareerStep[],
    };
    setRows(next);
    setLoaded(true);
    try {
      localStorage.setItem(cacheKey(userId), JSON.stringify(next));
    } catch {}
  }, [userId, today.iso, today.y]);

  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(cacheKey(userId));
      if (raw) {
        // Show the last copy from this device right away (offline / fast start).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRows({ ...EMPTY, ...(JSON.parse(raw) as TimeRows) });
        setLoaded(true);
      }
    } catch {}
    load();
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener(SYNCED_EVENT, load);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener(SYNCED_EVENT, load);
    };
  }, [userId, load]);

  const applyLocal = useCallback(
    (table: TimeTable, kind: "insert" | "update" | "delete", id: string, values?: Record<string, unknown>) => {
      const key = ROW_KEY[table];
      setRows((r) => {
        const list = r[key] as unknown as Record<string, unknown>[];
        const next =
          kind === "insert"
            ? [...list, { owner_id: userId, visibility: table === "journal_entries" ? "private" : "family", ...values, id }]
            : kind === "update"
              ? list.map((x) => (x.id === id ? { ...x, ...values } : x))
              : list.filter((x) => x.id !== id);
        return { ...r, [key]: next };
      });
    },
    [userId],
  );

  const save = useCallback(
    async (table: TimeTable, values: Record<string, unknown>, id?: string) => {
      const sb = supabase();
      const rowId = id ?? (values.id as string | undefined) ?? crypto.randomUUID();
      const { error } = id
        ? await sb.from(table).update(values).eq("id", id)
        : await sb.from(table).insert({ ...values, id: rowId });
      if (error && isNetworkError(error)) {
        await enqueue({ table, kind: id ? "update" : "insert", id: rowId, values });
        applyLocal(table, id ? "update" : "insert", rowId, values);
        return QUEUED;
      }
      if (error) return error.code === "23505" ? "That is already saved." : `Could not save: ${error.message}`;
      await load();
      return null;
    },
    [load, applyLocal],
  );

  const remove = useCallback(
    async (table: TimeTable, id: string) => {
      const { error } = await supabase().from(table).delete().eq("id", id);
      if (error && isNetworkError(error)) {
        await enqueue({ table, kind: "delete", id });
        applyLocal(table, "delete", id);
        return QUEUED;
      }
      if (error) return `Could not delete: ${error.message}`;
      await load();
      return null;
    },
    [load, applyLocal],
  );

  const insertMany = useCallback(
    async (table: TimeTable, list: Record<string, unknown>[]) => {
      const sb = supabase();
      let added = 0;
      for (const values of list) {
        const { error } = await sb.from(table).insert({ ...values, id: crypto.randomUUID() });
        if (!error) added++;
        else if (error.code !== "23505") {
          await load();
          return { added, error: isNetworkError(error) ? "This needs the internet." : `Could not save: ${error.message}` };
        }
      }
      await load();
      return { added };
    },
    [load],
  );

  return <TimeContext value={{ ...rows, loaded, reload: load, save, remove, insertMany }}>{children}</TimeContext>;
}
