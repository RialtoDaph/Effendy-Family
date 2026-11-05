"use client";

import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAppData } from "@/components/app-data";
import { useToast } from "@/components/toast";
import {
  DEFAULT_IDR_PER_EUR,
  asSubscription,
  netWorth,
  type Asset,
  type Business,
  type BusinessMonth,
  type Debt,
  type DebtSettings,
  type FileRow,
  type Remittance,
  type Subscription,
  type TaxDeadline,
  type TaxDeduction,
} from "@/lib/finance";
import { SYNCED_EVENT, useMoney } from "@/components/money-data";
import { QUEUED, enqueue, isNetworkError } from "@/lib/offline-queue";
import { supabase } from "@/lib/supabase";

type FinanceRows = {
  debts: Debt[];
  debtSettings: DebtSettings;
  remittances: Remittance[];
  businesses: Business[];
  businessMonths: BusinessMonth[];
  files: FileRow[];
  taxDeadlines: TaxDeadline[];
  taxDeductions: TaxDeduction[];
  taxYears: { year: number; refund_estimate: number | null; note: string | null }[];
  assets: Asset[];
  fxRate: number | null; // latest saved IDR per EUR
  fxDate: string | null;
  /** One family net-worth point per day, oldest first (networth_history). */
  worthHistory: WorthPoint[];
};

export type WorthPoint = { day: string; assets: number; debts: number; net: number };

export type FinanceTable =
  | "debts"
  | "remittances"
  | "businesses"
  | "business_months"
  | "tax_deadlines"
  | "tax_deductions"
  | "assets";

type Finance = FinanceRows & {
  loaded: boolean;
  /** The is_subscription rows of Recurring, most expensive first. */
  subscriptions: Subscription[];
  /** Saved rate, or the default until one is saved. */
  rate: number;
  /** Family net worth: private rows never count here. */
  worth: ReturnType<typeof netWorth>;
  reload: () => Promise<void>;
  save: (table: FinanceTable, values: Record<string, unknown>, id?: string) => Promise<string | null>;
  remove: (table: FinanceTable, id: string) => Promise<string | null>;
  setDebtSettings: (patch: Partial<DebtSettings>) => Promise<void>;
  saveRate: (idrPerEur: number) => Promise<void>;
  setRefund: (year: number, refund: number | null) => Promise<void>;
  upload: (file: File, kind: "business_report" | "receipt" | "statement", visibility: string) => Promise<{ id?: string; error?: string }>;
  openFile: (fileId: string) => Promise<void>;
};

const EMPTY: FinanceRows = {
  debts: [],
  debtSettings: { strategy: "avalanche", extra_per_month: 0 },
  remittances: [],
  businesses: [],
  businessMonths: [],
  files: [],
  taxDeadlines: [],
  taxDeductions: [],
  taxYears: [],
  assets: [],
  fxRate: null,
  worthHistory: [],
  fxDate: null,
};

const FinanceContext = createContext<Finance | null>(null);

export function useFinance() {
  const v = useContext(FinanceContext);
  if (!v) throw new Error("useFinance must be used inside <FinanceProvider>");
  return v;
}

const cacheKey = (userId: string) => `ef-finance-v1-${userId}`;

const ROW_KEY: Record<FinanceTable, keyof FinanceRows> = {
  debts: "debts",
  remittances: "remittances",
  businesses: "businesses",
  business_months: "businessMonths",
  tax_deadlines: "taxDeadlines",
  tax_deductions: "taxDeductions",
  assets: "assets",
};

/** Today in Eichstätt (YYYY-MM-DD), shifted by `offsetDays`. */
function berlinDay(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Saves today's family net worth once a day (and again when it changed), so Home can draw the line. */
async function saveTodayWorth(rows: FinanceRows): Promise<WorthPoint[]> {
  const fam = <T extends { visibility: string }>(xs: T[]) => xs.filter((x) => x.visibility === "family");
  if (!rows.assets.length && !rows.debts.length) return rows.worthHistory;
  const w = netWorth(fam(rows.assets), fam(rows.debts), rows.fxRate ?? DEFAULT_IDR_PER_EUR);
  const point: WorthPoint = { day: berlinDay(), assets: Math.round(w.assets * 100) / 100, debts: Math.round(w.debts * 100) / 100, net: Math.round(w.net * 100) / 100 };
  const last = rows.worthHistory.at(-1);
  if (last && last.day === point.day && last.net === point.net && last.assets === point.assets) return rows.worthHistory;
  const { error } = await supabase()
    .from("networth_history")
    .upsert({ ...point, updated_at: new Date().toISOString() }, { onConflict: "household_id,day" });
  if (error) return rows.worthHistory;
  return [...rows.worthHistory.filter((h) => h.day !== point.day), point];
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const tm = useTranslations("money");
  const { userId, household } = useAppData();
  const { recurring } = useMoney();
  const toast = useToast();
  const [rows, setRows] = useState<FinanceRows>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const sb = supabase();
    const res = await Promise.all([
      sb.from("debts").select("*").order("created_at"),
      sb.from("debt_settings").select("strategy,extra_per_month").maybeSingle(),
      sb.from("remittances").select("*").order("date", { ascending: false }).limit(500),
      sb.from("businesses").select("*").order("sort"),
      sb.from("business_months").select("*").order("month", { ascending: false }),
      sb.from("files").select("id,owner_id,visibility,storage_path,name,kind,mime,size"),
      sb.from("tax_deadlines").select("*").order("due_date"),
      sb.from("tax_deductions").select("*").order("created_at"),
      sb.from("tax_years").select("year,refund_estimate,note"),
      sb.from("assets").select("*").order("created_at"),
      sb.from("fx_rates").select("idr_per_eur,date").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      sb.from("networth_history").select("day,assets,debts,net").gte("day", berlinDay(-400)).order("day"),
    ]);
    if (res.some((r) => r.error)) return; // offline: keep what we have
    const [debts, ds, rem, biz, bm, files, dl, ded, ty, assets, fx, hist] = res.map((r) => r.data);
    const next: FinanceRows = {
      debts: debts as Debt[],
      debtSettings: (ds as DebtSettings | null) ?? EMPTY.debtSettings,
      remittances: rem as Remittance[],
      businesses: biz as Business[],
      businessMonths: bm as BusinessMonth[],
      files: files as FileRow[],
      taxDeadlines: dl as TaxDeadline[],
      taxDeductions: ded as TaxDeduction[],
      taxYears: ty as FinanceRows["taxYears"],
      assets: assets as Asset[],
      fxRate: (fx as { idr_per_eur: number } | null)?.idr_per_eur ?? null,
      fxDate: (fx as { date: string } | null)?.date ?? null,
      worthHistory: ((hist ?? []) as WorthPoint[]).map((h) => ({ day: h.day, assets: Number(h.assets), debts: Number(h.debts), net: Number(h.net) })),
    };
    next.worthHistory = await saveTodayWorth(next);
    setRows(next);
    setLoaded(true);
    try {
      localStorage.setItem(cacheKey(userId), JSON.stringify(next));
    } catch {}
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(cacheKey(userId));
      if (raw) {
        // Show the last copy from this device right away (offline / fast start).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRows({ ...EMPTY, ...(JSON.parse(raw) as FinanceRows) });
        setLoaded(true);
      }
    } catch {}
    load();
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [userId, load]);

  const applyLocal = useCallback(
    (table: FinanceTable, kind: "insert" | "update" | "delete", id: string, values?: Record<string, unknown>) => {
      const key = ROW_KEY[table];
      setRows((r) => {
        const list = r[key] as unknown as Record<string, unknown>[];
        const next =
          kind === "insert"
            ? [{ owner_id: userId, visibility: "family", created_at: new Date().toISOString(), ...values, id }, ...list]
            : kind === "update"
              ? list.map((x) => (x.id === id ? { ...x, ...values } : x))
              : list.filter((x) => x.id !== id);
        return { ...r, [key]: next };
      });
    },
    [userId],
  );

  const save = useCallback(
    async (table: FinanceTable, values: Record<string, unknown>, id?: string) => {
      const sb = supabase();
      const rowId = id ?? crypto.randomUUID();
      const { error } = id
        ? await sb.from(table).update(values).eq("id", id)
        : await sb.from(table).insert({ ...values, id: rowId });
      if (error && isNetworkError(error)) {
        await enqueue({ table, kind: id ? "update" : "insert", id: rowId, values });
        applyLocal(table, id ? "update" : "insert", rowId, values);
        return QUEUED;
      }
      if (error) return tm("could_not_save", { message: error.message });
      await load();
      return null;
    },
    [tm, load, applyLocal],
  );

  const remove = useCallback(
    async (table: FinanceTable, id: string) => {
      const { error } = await supabase().from(table).delete().eq("id", id);
      if (error && isNetworkError(error)) {
        await enqueue({ table, kind: "delete", id });
        applyLocal(table, "delete", id);
        return QUEUED;
      }
      if (error) return tm("could_not_delete", { message: error.message });
      await load();
      return null;
    },
    [tm, load, applyLocal],
  );

  useEffect(() => {
    const onSynced = () => load();
    window.addEventListener(SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(SYNCED_EVENT, onSynced);
  }, [load]);

  // The slider fires on every step: show it at once, save once it settles.
  const pendingSettings = useRef<Partial<DebtSettings>>({});
  const settingsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const setDebtSettings = useCallback(
    async (patch: Partial<DebtSettings>) => {
      setRows((r) => ({ ...r, debtSettings: { ...r.debtSettings, ...patch } }));
      pendingSettings.current = { ...pendingSettings.current, ...patch };
      clearTimeout(settingsTimer.current);
      settingsTimer.current = setTimeout(async () => {
        const body = pendingSettings.current;
        pendingSettings.current = {};
        const { error } = await supabase().from("debt_settings").update(body).eq("household_id", household?.id);
        if (error) toast(tm("offline_save"));
      }, 600);
    },
    [tm, household?.id, toast],
  );

  const saveRate = useCallback(
    async (idrPerEur: number) => {
      const { error } = await supabase().from("fx_rates").insert({ idr_per_eur: idrPerEur });
      if (error) toast(tm("offline_save"));
      else {
        toast(tm("rate_saved_1_rp", { toLocaleString: idrPerEur.toLocaleString("id-ID") }));
        await load();
      }
    },
    [tm, load, toast],
  );

  const setRefund = useCallback(
    async (year: number, refund: number | null) => {
      // Update the year if it exists, otherwise add it (only refund_estimate is updatable).
      const sb = supabase();
      const upd = await sb.from("tax_years").update({ refund_estimate: refund }).eq("year", year).select("year");
      const error = upd.error ?? (upd.data?.length ? null : (await sb.from("tax_years").insert({ year, refund_estimate: refund })).error);
      if (error) toast(tm("offline_save"));
      await load();
    },
    [tm, load, toast],
  );

  const upload = useCallback(
    async (file: File, kind: "business_report" | "receipt" | "statement", visibility: string) => {
      if (!household || !userId) return { error: tm("not_signed_in") };
      if (file.size > 20 * 1024 * 1024) return { error: tm("the_file_is_larger_than_20_mb") };
      const sb = supabase();
      const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const path = `${household.id}/${userId}/${Date.now()}-${safe}`;
      const up = await sb.storage.from("files").upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (up.error) return { error: navigator.onLine ? tm("upload_failed_2", { message: up.error.message }) : tm("offline_save") };
      const { data, error } = await sb
        .from("files")
        .insert({ storage_path: path, name: file.name, kind, mime: file.type || null, size: file.size, visibility })
        .select("id")
        .single();
      if (error || !data) return { error: tm("upload_failed_3", { v: error?.message ?? "unknown" }) };
      return { id: data.id as string };
    },
    [tm, household, userId],
  );

  const openFile = useCallback(
    async (fileId: string) => {
      const f = rows.files.find((x) => x.id === fileId);
      if (!f) return toast(tm("file_not_found"));
      // Open the tab first (iOS blocks pop-ups opened after an await).
      const win = window.open("", "_blank");
      const { data, error } = await supabase().storage.from("files").createSignedUrl(f.storage_path, 60);
      if (error || !data) {
        win?.close();
        toast(navigator.onLine ? tm("could_not_open_the_file") : tm("files_need_the_internet"));
        return;
      }
      if (win) win.location.href = data.signedUrl;
      else window.location.href = data.signedUrl;
    },
    [tm, rows.files, toast],
  );

  const rate = rows.fxRate ?? DEFAULT_IDR_PER_EUR;
  const worth = useMemo(
    () =>
      netWorth(
        rows.assets.filter((a) => a.visibility === "family"),
        rows.debts.filter((d) => d.visibility === "family"),
        rate,
      ),
    [rows.assets, rows.debts, rate],
  );

  const subscriptions = useMemo(
    () => recurring.filter((r) => r.is_subscription).map(asSubscription).sort((a, b) => b.monthly_price - a.monthly_price),
    [recurring],
  );

  const value: Finance = {
    ...rows,
    loaded,
    subscriptions,
    rate,
    worth,
    reload: load,
    save,
    remove,
    setDebtSettings,
    saveRate,
    setRefund,
    upload,
    openFile,
  };
  return <FinanceContext value={value}>{children}</FinanceContext>;
}
