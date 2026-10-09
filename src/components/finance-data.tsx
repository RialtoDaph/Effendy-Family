"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAppData } from "@/components/app-data";
import { useToast } from "@/components/toast";
import {
  DEFAULT_IDR_PER_EUR,
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
import { SYNCED_EVENT } from "@/components/money-data";
import { QUEUED, enqueue, isNetworkError } from "@/lib/offline-queue";
import { supabase } from "@/lib/supabase";

type FinanceRows = {
  debts: Debt[];
  debtSettings: DebtSettings;
  subscriptions: Subscription[];
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
};

export type FinanceTable =
  | "debts"
  | "subscriptions"
  | "remittances"
  | "businesses"
  | "business_months"
  | "tax_deadlines"
  | "tax_deductions"
  | "assets";

type Finance = FinanceRows & {
  loaded: boolean;
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
  upload: (file: File, kind: "business_report", visibility: string) => Promise<{ id: string } | { error: string }>;
  openFile: (fileId: string) => Promise<void>;
};

const EMPTY: FinanceRows = {
  debts: [],
  debtSettings: { strategy: "avalanche", extra_per_month: 0 },
  subscriptions: [],
  remittances: [],
  businesses: [],
  businessMonths: [],
  files: [],
  taxDeadlines: [],
  taxDeductions: [],
  taxYears: [],
  assets: [],
  fxRate: null,
  fxDate: null,
};

const FinanceContext = createContext<Finance | null>(null);

export function useFinance() {
  const v = useContext(FinanceContext);
  if (!v) throw new Error("useFinance must be used inside <FinanceProvider>");
  return v;
}

const cacheKey = (userId: string) => `ef-finance-v1-${userId}`;
const OFFLINE_MSG = "Could not save. Check your internet connection.";

const ROW_KEY: Record<FinanceTable, keyof FinanceRows> = {
  debts: "debts",
  subscriptions: "subscriptions",
  remittances: "remittances",
  businesses: "businesses",
  business_months: "businessMonths",
  tax_deadlines: "taxDeadlines",
  tax_deductions: "taxDeductions",
  assets: "assets",
};

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { userId, household } = useAppData();
  const toast = useToast();
  const [rows, setRows] = useState<FinanceRows>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const sb = supabase();
    const res = await Promise.all([
      sb.from("debts").select("*").order("created_at"),
      sb.from("debt_settings").select("strategy,extra_per_month").maybeSingle(),
      sb.from("subscriptions").select("*").order("monthly_price", { ascending: false }),
      sb.from("remittances").select("*").order("date", { ascending: false }).limit(500),
      sb.from("businesses").select("*").order("sort"),
      sb.from("business_months").select("*").order("month", { ascending: false }),
      sb.from("files").select("id,owner_id,visibility,storage_path,name,kind,mime,size"),
      sb.from("tax_deadlines").select("*").order("due_date"),
      sb.from("tax_deductions").select("*").order("created_at"),
      sb.from("tax_years").select("year,refund_estimate,note"),
      sb.from("assets").select("*").order("created_at"),
      sb.from("fx_rates").select("idr_per_eur,date").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (res.some((r) => r.error)) return; // offline: keep what we have
    const [debts, ds, subs, rem, biz, bm, files, dl, ded, ty, assets, fx] = res.map((r) => r.data);
    const next: FinanceRows = {
      debts: debts as Debt[],
      debtSettings: (ds as DebtSettings | null) ?? EMPTY.debtSettings,
      subscriptions: subs as Subscription[],
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
    };
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
      if (error) return `Could not save: ${error.message}`;
      await load();
      return null;
    },
    [load, applyLocal],
  );

  const remove = useCallback(
    async (table: FinanceTable, id: string) => {
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
        if (error) toast(OFFLINE_MSG);
      }, 600);
    },
    [household?.id, toast],
  );

  const saveRate = useCallback(
    async (idrPerEur: number) => {
      const { error } = await supabase().from("fx_rates").insert({ idr_per_eur: idrPerEur });
      if (error) toast(OFFLINE_MSG);
      else {
        toast(`Rate saved: €1 = Rp ${idrPerEur.toLocaleString("id-ID")}`);
        await load();
      }
    },
    [load, toast],
  );

  const setRefund = useCallback(
    async (year: number, refund: number | null) => {
      // Update the year if it exists, otherwise add it (only refund_estimate is updatable).
      const sb = supabase();
      const upd = await sb.from("tax_years").update({ refund_estimate: refund }).eq("year", year).select("year");
      const error = upd.error ?? (upd.data?.length ? null : (await sb.from("tax_years").insert({ year, refund_estimate: refund })).error);
      if (error) toast(OFFLINE_MSG);
      await load();
    },
    [load, toast],
  );

  const upload = useCallback(
    async (file: File, kind: "business_report", visibility: string) => {
      if (!household || !userId) return { error: "Not signed in." };
      if (file.size > 20 * 1024 * 1024) return { error: "The file is larger than 20 MB." };
      const sb = supabase();
      const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const path = `${household.id}/${userId}/${Date.now()}-${safe}`;
      const up = await sb.storage.from("files").upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (up.error) return { error: navigator.onLine ? `Upload failed: ${up.error.message}` : OFFLINE_MSG };
      const { data, error } = await sb
        .from("files")
        .insert({ storage_path: path, name: file.name, kind, mime: file.type || null, size: file.size, visibility })
        .select("id")
        .single();
      if (error || !data) return { error: `Upload failed: ${error?.message ?? "unknown"}` };
      return { id: data.id as string };
    },
    [household, userId],
  );

  const openFile = useCallback(
    async (fileId: string) => {
      const f = rows.files.find((x) => x.id === fileId);
      if (!f) return toast("File not found.");
      // Open the tab first (iOS blocks pop-ups opened after an await).
      const win = window.open("", "_blank");
      const { data, error } = await supabase().storage.from("files").createSignedUrl(f.storage_path, 60);
      if (error || !data) {
        win?.close();
        toast(navigator.onLine ? "Could not open the file." : "Files need the internet.");
        return;
      }
      if (win) win.location.href = data.signedUrl;
      else window.location.href = data.signedUrl;
    },
    [rows.files, toast],
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

  const value: Finance = {
    ...rows,
    loaded,
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
