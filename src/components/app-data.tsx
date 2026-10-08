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
};

type Profile = {
  userId: string;
  members: Member[];
  household: Household | null;
  settings: MemberSettings | null;
};

type AppData = Profile & {
  me: Member | undefined;
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
    const [m, h, s] = await Promise.all([
      sb.from("members").select("*").order("sort"),
      sb.from("households").select("*").limit(1).maybeSingle(),
      sb.from("member_settings").select("*").eq("member_id", userId).maybeSingle(),
    ]);
    if (m.error || h.error || s.error) return; // offline or a network hiccup: keep the cached copy
    const next: Profile = {
      userId,
      members: m.data as Member[],
      household: h.data as Household | null,
      settings: s.data as MemberSettings | null,
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
    await supabase().auth.signOut();
  }, []);

  const value: AppData = {
    ...profile,
    me: profile.members.find((x) => x.id === profile.userId),
    ready,
    reload,
    signOut,
  };

  return <AppDataContext value={value}>{children}</AppDataContext>;
}
