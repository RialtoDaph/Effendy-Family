"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { applyTheme, readThemePref, saveThemePref, type ThemePref } from "@/lib/theme";

export const THEME_OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "auto", label: "Auto", icon: Monitor },
];

const EVENT = "ef-theme-change";

/** Theme is stored per device (README → Theme). */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>("auto");

  useEffect(() => {
    const sync = () => {
      const p = readThemePref();
      setPref(p);
      applyTheme(p);
    };
    sync();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => readThemePref() === "auto" && applyTheme("auto");
    mq.addEventListener("change", onSystem);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      mq.removeEventListener("change", onSystem);
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function setTheme(next: ThemePref) {
    saveThemePref(next);
    window.dispatchEvent(new Event(EVENT));
  }

  const cycle = () => setTheme(pref === "light" ? "dark" : pref === "dark" ? "auto" : "light");

  return { pref, setTheme, cycle };
}
