"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "@/components/theme";
import { routing, type Locale } from "@/i18n/routing";
import { switchLocale } from "@/lib/locale";
import { PALETTES } from "@/lib/theme";

export function PalettePicker() {
  const t = useTranslations("ui");
  const { palette, setPalette } = useTheme();
  return (
    <div className="grid grid-cols-4 gap-2">
      {PALETTES.map(([id, bg, , acc]) => (
        <button
          key={id}
          onClick={() => setPalette(id)}
          aria-pressed={palette === id}
          className={`flex min-h-11 flex-col items-center gap-1.5 rounded-[10px] border-2 bg-card px-1 pb-2 pt-1.5 text-[11.5px] font-bold text-ink ${
            palette === id ? "border-acc" : "border-line"
          }`}
        >
          <span
            className="flex h-[30px] w-full items-end justify-end rounded-[7px] p-[5px] shadow-[inset_0_0_0_1px_rgba(0,0,0,.08)]"
            style={{ background: bg }}
          >
            <span className="h-3.5 w-3.5 rounded-full" style={{ background: acc }} />
          </span>
          {t(`palette_${id}`)}
        </button>
      ))}
    </div>
  );
}

const LANGUAGES: Record<Locale, string> = { en: "English", de: "Deutsch", id: "Bahasa Indonesia" };

export function LanguagePicker() {
  const current = useLocale();
  return (
    <div className="flex flex-col gap-2">
      {routing.locales.map((locale) => (
        <button
          key={locale}
          onClick={() => switchLocale(locale)}
          aria-pressed={locale === current}
          className={`flex min-h-12 items-center gap-3 rounded-[12px] border-2 bg-card px-3.5 py-3 text-left text-sm font-bold text-ink ${
            locale === current ? "border-acc" : "border-line"
          }`}
        >
          <span className="flex-1">{LANGUAGES[locale]}</span>
          {locale === current && <span aria-hidden>✓</span>}
        </button>
      ))}
    </div>
  );
}
