"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DEFAULT_PALETTE,
  applyTheme,
  readPalette,
  readThemePref,
  savePalette,
  saveThemePref,
  type Palette,
  type ThemePref,
} from "@/lib/theme";

export const THEME_OPTIONS: { value: ThemePref; key: "nav.light" | "nav.dark" | "ui.auto"; icon: typeof Sun }[] = [
  { value: "light", key: "nav.light", icon: Sun },
  { value: "dark", key: "nav.dark", icon: Moon },
  { value: "auto", key: "ui.auto", icon: Monitor },
];

const EVENT = "ef-theme-change";

/** Theme and palette are stored per device (README → Theme). */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>("auto");
  const [palette, setPaletteState] = useState<Palette>(DEFAULT_PALETTE);

  useEffect(() => {
    const sync = () => {
      const p = readThemePref();
      const c = readPalette();
      setPref(p);
      setPaletteState(c);
      applyTheme(p, c);
    };
    sync();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => readThemePref() === "auto" && applyTheme("auto", readPalette());
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

  function setPalette(next: Palette) {
    savePalette(next);
    window.dispatchEvent(new Event(EVENT));
  }

  const cycle = () => setTheme(pref === "light" ? "dark" : pref === "dark" ? "auto" : "light");

  return { pref, palette, setTheme, setPalette, cycle, isNoir: palette === "noir" };
}
