"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useMoney } from "@/components/money-data";
import { SampleDataButton } from "@/components/sample-data";

/** A module screen with nothing in it yet: what it is for, and the way to start. */
export function EmptyState({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section
      data-screen-label="Empty state"
      className="flex max-w-[640px] flex-col items-start gap-3 rounded-[18px] border border-dashed border-line2 bg-card px-6 py-8"
    >
      <div className="eyebrow">{eyebrow}</div>
      <h2 className="m-0 text-[22px] font-bold leading-[1.25] tracking-[-0.01em] [text-wrap:pretty]">{title}</h2>
      <div className="mt-1.5 flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

/** The prototype's fresh-account screen: one sentence, the first step, and sample data while the household is empty. */
export function ScreenEmpty({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action: string; onAction: () => void }) {
  const { categories } = useMoney();
  return (
    <EmptyState eyebrow={eyebrow} title={title}>
      <button onClick={onAction} className="min-h-[46px] rounded-full border-0 bg-acc px-5 text-sm font-bold text-onacc">
        {action}
      </button>
      {!categories.length && <SampleDataButton />}
    </EmptyState>
  );
}

type EmptyKey = "budget" | "debts" | "recur" | "remit" | "biz" | "ygoals" | "learn" | "journal";

/** ScreenEmpty with the texts of messages `empty.<screen>`. */
export function ModuleEmpty({ screen, eyebrow, onAction }: { screen: EmptyKey; eyebrow: string; onAction: () => void }) {
  const t = useTranslations("empty");
  return <ScreenEmpty eyebrow={eyebrow} title={t(`${screen}.body`)} action={t(`${screen}.action`)} onAction={onAction} />;
}
