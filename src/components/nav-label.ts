"use client";

import { useTranslations } from "next-intl";
import { useAiName } from "@/components/app-data";
import type { LabelKey } from "@/lib/nav";

/** Turns a nav or quick-add label key into text in the current language. */
export function useLabel() {
  const t = useTranslations() as unknown as (key: string, values?: Record<string, string>) => string;
  const name = useAiName();
  return (key: LabelKey) => t(key, { name });
}
