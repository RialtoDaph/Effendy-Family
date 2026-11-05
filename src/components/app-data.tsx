"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { BILLING_START, activePlan, type Billing, type PlanKey } from "@/lib/plans";
import { AI_NAME } from "@/lib/nav";
import { clearAllPins } from "@/lib/pin";
import { disablePushHere } from "@/lib/push";
import { supabase } from "@/lib/supabase";

export type Member = {
  id: string;
  household_id: string;
  display_name: string;
  email: string | null;
  role: string;
  avatar_bg: string | null;
  avatar_fg: string | null;
  sort: number;
  share: Record<string, boolean>;
};

export type Household = { id: string; name: string; home_city: string; currency: string };

export type MemberSettings = {
  member_id: string;
  theme: string;
  palette: string;
  default_visibility: Record<string, string>;
  notif: Record<string, unknown>;
  warn_pct: number;
  ef_months: number;
  learn_week_min?: number;
  gym_week_goal?: number;
  shift_wage?: number | null;
  memory_on?: boolean;
  memory_shared?: boolean;
  lang?: string;
  ai_name?: string;
  voice?: "text" | "audio" | "both";
  brief_at?: string;
};

type Profile = {
  userId: string;
  members: Member[];
  household: Household | null;
  settings: MemberSettings | null;
  billing?: Billing | null;
};

type AppData = Profile & {
  me: Member | undefined;
  bill: Billing;
  plan: PlanKey;
  ready: boolean;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
};

const CACHE_KEY = "ef-profile-v1";
const AppDataContext = createContext<AppData | null>(null);

export function useAppData() {
  const v = useContext(AppDataContext);
  if (!v) throw new Error("useAppData must be used inside <AppDataProvider>");
  return v;
}

/** The name each person gave their assistant. Safe outside the app shell, as on the login page. */
export function useAiName() {
  return useContext(AppDataContext)?.settings?.ai_name || AI_NAME;
}

function readCache(): Profile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

const EMPTY: Profile = { userId: "", members: [], household: null, settings: null };

/**
 * Signs the visitor in or sends them to /login, then loads the household,
 * both members and this person's settings. The last copy is kept on the
 * device so the shell can show names when opened offline.
 */
export function AppDataProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [ready, setReady] = useState(false);

  const load = useCallback(async (userId: string) => {
    const sb = supabase();
    const [m, h, s, b] = await Promise.all([
      sb.from("members").select("*").order("sort"),
      sb.from("households").select("*").limit(1).maybeSingle(),
      sb.from("member_settings").select("*").eq("member_id", userId).maybeSingle(),
      sb.from("subscriptions_billing").select("plan,interval,status,seats,current_period_end").maybeSingle(),
    ]);
    if (m.error || h.error || s.error) return; // offline or a network hiccup: keep the cached copy
    const next: Profile = {
      userId,
      members: m.data as Member[],
      household: h.data as Household | null,
      settings: s.data as MemberSettings | null,
      billing: b.data as Billing | null,
    };
    setProfile(next);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  useEffect(() => {
    const sb = supabase();
    let alive = true;

    sb.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const userId = data.session?.user.id;
      if (!userId) {
        router.replace("/login");
        return;
      }
      const cached = readCache();
      if (cached?.userId === userId) setProfile(cached);
      setReady(true);
      load(userId);
    });

    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        try {
          localStorage.removeItem(CACHE_KEY);
        } catch {}
        router.replace("/login");
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [load, router]);

  const reload = useCallback(async () => {
    if (profile.userId) await load(profile.userId);
  }, [load, profile.userId]);

  const signOut = useCallback(async () => {
    clearAllPins();
    try {
      // Clopar's chat and briefings belong to this person, not to the phone.
      for (const k of Object.keys(localStorage)) if (k.startsWith("ef-ask-") || k.startsWith("ef-brief-") || k.startsWith("ef-inbox-")) localStorage.removeItem(k);
    } catch {}
    await disablePushHere();
    await supabase().auth.signOut();
  }, []);

  const bill = profile.billing ?? BILLING_START;
  const value: AppData = {
    ...profile,
    bill,
    plan: activePlan(bill),
    me: profile.members.find((x) => x.id === profile.userId),
    ready,
    reload,
    signOut,
  };

  return <AppDataContext value={value}>{children}</AppDataContext>;
}
