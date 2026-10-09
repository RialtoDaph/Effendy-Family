"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useAppData } from "@/components/app-data";
import { useToast } from "@/components/toast";
import {
  berlinToday,
  budgetSummary,
  buildAlerts,
  emergencyFund,
  type Alert,
  type BudgetSummary,
  type Category,
  type EmergencyFund,
  type Goal,
  type Income,
  type Recurring,
  type Today,
  type Transaction,
} from "@/lib/money";
import { supabase } from "@/lib/supabase";

type AlertState = { alert_key: string; dismissed_at: string | null; done_at: string | null };

type MoneyRows = {
  categories: Category[];
  transactions: Transaction[];
  incomes: Income[];
  recurring: Recurring[];
  goals: Goal[];
  alertsState: AlertState[];
};

export type MoneyTable = "categories" | "transactions" | "incomes" | "recurring" | "goals";

type Money = MoneyRows & {
  loaded: boolean;
  today: Today;
  warnPct: number;
  efMonths: number;
  /** Family totals: private rows never count here. */
  budget: BudgetSummary;
  ef: EmergencyFund;
  alerts: Alert[];
  reload: () => Promise<void>;
  save: (table: MoneyTable, values: Record<string, unknown>, id?: string) => Promise<string | null>;
  remove: (table: MoneyTable, id: string) => Promise<string | null>;
  closeAlert: (key: string, how: "dismissed" | "done") => Promise<void>;
  setSetting: (patch: { warn_pct?: number; ef_months?: number }) => Promise<void>;
};

const EMPTY: MoneyRows = { categories: [], transactions: [], incomes: [], recurring: [], goals: [], alertsState: [] };
const MoneyContext = createContext<Money | null>(null);

export function useMoney() {
  const v = useContext(MoneyContext);
  if (!v) throw new Error("useMoney must be used inside <MoneyProvider>");
  return v;
}

const cacheKey = (userId: string) => `ef-money-v1-${userId}`;
const seenKey = (userId: string) => `ef-recurring-seen-${userId}`;

// Today's date is read in the browser only (pages are prerendered without a clock).
const SERVER_TODAY: Today = { y: 2026, m: 1, d: 1, iso: "2026-01-01", ym: "2026-01", daysInMonth: 31 };
let cachedToday: Today | null = null;
function clientToday() {
  const t = berlinToday();
  if (!cachedToday || cachedToday.iso !== t.iso) cachedToday = t;
  return cachedToday;
}
function subscribeDay(cb: () => void) {
  const id = setInterval(cb, 60_000);
  return () => clearInterval(id);
}

const OFFLINE_MSG = "Could not save. Check your internet connection.";

export function MoneyProvider({ children }: { children: ReactNode }) {
  const { userId, settings, reload: reloadProfile } = useAppData();
  const toast = useToast();
  const [rows, setRows] = useState<MoneyRows>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const today = useSyncExternalStore(subscribeDay, clientToday, () => SERVER_TODAY);

  const load = useCallback(async () => {
    if (!userId) return;
    const sb = supabase();
    const t = clientToday();
    // This month and last month are enough for budget, lists and alerts.
    const from = t.m === 1 ? `${t.y - 1}-12-01` : `${t.y}-${String(t.m - 1).padStart(2, "0")}-01`;
    const [c, tx, inc, rec, g, al] = await Promise.all([
      sb.from("categories").select("id,name,icon,monthly_limit,is_fixed,sort").order("sort").order("name"),
      sb.from("transactions").select("*").gte("date", from).order("date", { ascending: false }).order("created_at", { ascending: false }).limit(2000),
      sb.from("incomes").select("*").order("monthly_amount", { ascending: false }),
      sb.from("recurring").select("*").order("day_of_month"),
      sb.from("goals").select("*").order("created_at"),
      sb.from("alerts_state").select("alert_key,dismissed_at,done_at"),
    ]);
    const err = c.error || tx.error || inc.error || rec.error || g.error || al.error;
    if (err) return; // offline: keep what we have
    const next: MoneyRows = {
      categories: c.data as Category[],
      transactions: tx.data as Transaction[],
      incomes: inc.data as Income[],
      recurring: rec.data as Recurring[],
      goals: g.data as Goal[],
      alertsState: al.data as AlertState[],
    };
    setRows(next);
    setLoaded(true);
    try {
      localStorage.setItem(cacheKey(userId), JSON.stringify(next));
    } catch {}

    // "N recurring items added · …" once, after the server posted them.
    try {
      const seen = localStorage.getItem(seenKey(userId));
      const fresh = next.transactions.filter((x) => x.source === "recurring" && (!seen || x.created_at > seen));
      if (seen && fresh.length) {
        toast(`${fresh.length} recurring item${fresh.length > 1 ? "s" : ""} added · ${fresh.slice(0, 2).map((x) => x.payee).join(", ")}${fresh.length > 2 ? "…" : ""}`);
      }
      localStorage.setItem(seenKey(userId), new Date().toISOString());
    } catch {}
  }, [userId, toast]);

  useEffect(() => {
    if (!userId) return;
    let cached: MoneyRows | null = null;
    try {
      const raw = localStorage.getItem(cacheKey(userId));
      cached = raw ? (JSON.parse(raw) as MoneyRows) : null;
    } catch {}
    if (cached) {
      // Show the last copy from this device right away (offline / fast start).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows(cached);
      setLoaded(true);
    }
    load();
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [userId, load]);

  const save = useCallback(
    async (table: MoneyTable, values: Record<string, unknown>, id?: string) => {
      const sb = supabase();
      const { error } = id ? await sb.from(table).update(values).eq("id", id) : await sb.from(table).insert(values);
      if (error) return navigator.onLine ? `Could not save: ${error.message}` : OFFLINE_MSG;
      await load();
      return null;
    },
    [load],
  );

  const remove = useCallback(
    async (table: MoneyTable, id: string) => {
      const { error } = await supabase().from(table).delete().eq("id", id);
      if (error) return navigator.onLine ? `Could not delete: ${error.message}` : OFFLINE_MSG;
      await load();
      return null;
    },
    [load],
  );

  const closeAlert = useCallback(
    async (key: string, how: "dismissed" | "done") => {
      const stamp = new Date().toISOString();
      setRows((r) => ({
        ...r,
        alertsState: [...r.alertsState, { alert_key: key, dismissed_at: how === "dismissed" ? stamp : null, done_at: how === "done" ? stamp : null }],
      }));
      await supabase()
        .from("alerts_state")
        .upsert({ alert_key: key, [how === "done" ? "done_at" : "dismissed_at"]: stamp }, { onConflict: "member_id,alert_key" });
    },
    [],
  );

  const setSetting = useCallback(
    async (patch: { warn_pct?: number; ef_months?: number }) => {
      if (!userId) return;
      const { error } = await supabase().from("member_settings").update(patch).eq("member_id", userId);
      if (error) toast(OFFLINE_MSG);
      await reloadProfile();
    },
    [userId, reloadProfile, toast],
  );

  const warnPct = settings?.warn_pct ?? 80;
  const efMonths = settings?.ef_months ?? 6;

  const derived = useMemo(() => {
    const familyTx = rows.transactions.filter((t) => t.visibility === "family");
    const budget = budgetSummary(rows.categories, familyTx, today, warnPct);
    const familyGoals = rows.goals.filter((g) => g.visibility === "family");
    const ef = emergencyFund(familyGoals, rows.categories, efMonths);
    const closed = new Set(rows.alertsState.map((a) => a.alert_key));
    const familyRecurring = rows.recurring.filter((r) => r.visibility === "family" || r.owner_id === userId);
    const alerts = buildAlerts({ today, budget, recurring: familyRecurring, ef, warnPct, closed });
    return { budget, ef, alerts };
  }, [rows, today, warnPct, efMonths, userId]);

  const value: Money = {
    ...rows,
    ...derived,
    loaded,
    today,
    warnPct,
    efMonths,
    reload: load,
    save,
    remove,
    closeAlert,
    setSetting,
  };

  return <MoneyContext value={value}>{children}</MoneyContext>;
}
