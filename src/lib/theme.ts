export type ThemePref = "light" | "dark" | "auto";

export const THEME_KEY = "ef-theme";
export const PALETTE_KEY = "rl-palette";

// id, page background, ink and accent, as in the prototype's THEMES (swatches only).
export const PALETTES = [
  ["noir", "#000000", "#F4F2EC", "#E8D9B5"],
  ["classic", "#FFFFFF", "#0B0D10", "#3355FF"],
  ["mono", "#FFFFFF", "#0B0D10", "#0B0D10"],
  ["midnight", "#0B0D1C", "#E9EBEF", "#7C8CFF"],
  ["ocean", "#FFFFFF", "#0B0D10", "#0E8C7E"],
  ["forest", "#FBFAF6", "#14201A", "#2F6B47"],
  ["sand", "#FAF6EF", "#2A2118", "#B4692B"],
  ["rose", "#FFFFFF", "#1A0F14", "#D6336C"],
  ["sunset", "#FFFFFF", "#1A120D", "#EE5D2B"],
] as const;

export type Palette = (typeof PALETTES)[number][0];

export const DEFAULT_PALETTE: Palette = "noir";

const isPalette = (v: string | null): v is Palette => PALETTES.some(([id]) => id === v);

// Runs before first paint (see layout.tsx) so the page never flashes the wrong look.
// Noir has no light variant, so it always resolves to dark.
export const themeScript = `(function(){try{var r=document.documentElement,p=localStorage.getItem("${THEME_KEY}")||"auto",c=localStorage.getItem("${PALETTE_KEY}"),k=${JSON.stringify(PALETTES.map(([id]) => id))};if(k.indexOf(c)<0)c="${DEFAULT_PALETTE}";var d=c==="noir"||p==="dark"||(p==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches);r.dataset.palette=c;r.dataset.theme=d?"dark":"light";}catch(e){}})();`;

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch {}
  return "auto";
}

export function readPalette(): Palette {
  try {
    const v = localStorage.getItem(PALETTE_KEY);
    if (isPalette(v)) return v;
  } catch {}
  return DEFAULT_PALETTE;
}

export function applyTheme(pref: ThemePref, palette: Palette) {
  const root = document.documentElement;
  const dark =
    palette === "noir" ||
    pref === "dark" ||
    (pref === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.palette = palette;
  root.dataset.theme = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", getComputedStyle(root).getPropertyValue("--bg").trim());
}

export function saveThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {}
  applyTheme(pref, readPalette());
}

export function savePalette(palette: Palette) {
  try {
    localStorage.setItem(PALETTE_KEY, palette);
  } catch {}
  applyTheme(readThemePref(), palette);
}
