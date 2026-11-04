"use client";

import { useLocale } from "next-intl";
import type { ReactNode } from "react";
import { LogoTile } from "@/components/logo";
import { routing } from "@/i18n/routing";
import { switchLocale } from "@/lib/locale";

export const authInput =
  "h-[54px] w-full rounded-[12px] border border-line bg-card px-4 text-base text-ink outline-none focus:border-line2";
export const authPrimary =
  "min-h-[54px] w-full rounded-[14px] border-0 bg-acc text-base font-bold text-onacc hover:bg-acc2 disabled:opacity-60";
export const authSecondary =
  "flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-[14px] border border-line2 bg-card text-base font-bold text-ink disabled:opacity-60";
export const authTitle = "m-0 font-serif text-[42px] font-normal leading-[1.1] tracking-[-0.01em] [text-wrap:pretty]";
export const authSub = "m-0 mt-2 text-[15px] leading-normal text-mut [text-wrap:pretty]";

/** Full-screen sign-in frame: logo and language on top, content below. */
export function AuthScreen({ children }: { children: ReactNode }) {
  const current = useLocale();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col gap-7 px-5 pb-[calc(22px+env(safe-area-inset-bottom))] pt-[calc(18px+env(safe-area-inset-top))]">
      <div className="flex min-h-11 items-center gap-2.5">
        <LogoTile />
        <div className="text-[15px] font-bold tracking-[-0.01em]">rideff Life</div>
        <div className="ml-auto flex gap-0.5 rounded-full bg-soft2 p-[3px]">
          {routing.locales.map((locale) => (
            <button
              key={locale}
              onClick={() => switchLocale(locale)}
              aria-pressed={locale === current}
              className={`min-h-8 min-w-10 rounded-full border-0 px-2.5 font-mono text-xs font-bold uppercase ${
                locale === current ? "bg-card text-ink shadow-[0_1px_3px_rgba(0,0,0,.12)]" : "bg-transparent text-mut"
              }`}
            >
              {locale}
            </button>
          ))}
        </div>
      </div>
      {children}
    </main>
  );
}
