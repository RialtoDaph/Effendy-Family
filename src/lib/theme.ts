export type ThemePref = "light" | "dark" | "auto";

export const THEME_KEY = "ef-theme";

// Runs before first paint (see layout.tsx) so the page never flashes the wrong theme.
export const themeScript = `(function(){try{var p=localStorage.getItem("${THEME_KEY}")||"auto";var d=p==="dark"||(p==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`;

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch {}
  return "auto";
}

export function applyTheme(pref: ThemePref) {
  const dark =
    pref === "dark" ||
    (pref === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#0A0B0D" : "#FFFFFF");
}

export function saveThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {}
  applyTheme(pref);
}
