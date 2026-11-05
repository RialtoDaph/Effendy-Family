"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { useLabel } from "@/components/nav-label";
import type { LabelKey } from "@/lib/nav";

/** Holds a route the shell links to until its phase is built. */
export function ComingSoon({ title, phase }: { title: LabelKey; phase: number }) {
  const t = useTranslations("ui");
  const label = useLabel();
  return (
    <EmptyState eyebrow={label(title)} title={t("soon_title", { phase })}>
      <Link
        href="/"
        className="flex min-h-[46px] items-center rounded-full bg-acc px-5 text-sm font-bold text-onacc hover:text-onacc"
      >
        {t("back_home")}
      </Link>
    </EmptyState>
  );
}
