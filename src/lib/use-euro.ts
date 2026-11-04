"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";

const TAGS: Record<string, string> = { en: "en-IE", de: "de-DE", id: "id-ID" };

/** Prices keep their cents: €12.90. */
export function useEuro() {
  const locale = useLocale();
  return useMemo(() => {
    const f = new Intl.NumberFormat(TAGS[locale] ?? locale, { style: "currency", currency: "EUR" });
    return (n: number) => f.format(n);
  }, [locale]);
}
