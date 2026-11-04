"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useAppData } from "@/components/app-data";
import { useLabel } from "@/components/nav-label";
import { MODULES, type LabelKey } from "@/lib/nav";
import { lockedBy, PLANS, type PlanKey } from "@/lib/plans";
import { useEuro } from "@/lib/use-euro";

const tabKey = (id: string): LabelKey | undefined =>
  Object.values(MODULES)
    .flatMap((m) => m.tabs)
    .find((t) => t.id === id)?.key;

/** Screens above this person's plan show what the plan adds; their data stays as it is. */
export function PlanGate({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { locale } = useParams<{ locale?: string }>();
  const { plan } = useAppData();
  const bare = locale && path.startsWith(`/${locale}`) ? path.slice(locale.length + 1) || "/" : path;
  const need = lockedBy(bare, plan);
  return need ? <Upsell id={bare.split("/")[1]} need={need} /> : children;
}

function Upsell({ id, need }: { id: string; need: PlanKey }) {
  const t = useTranslations("t");
  const ts = useTranslations("settings");
  const tp = useTranslations("plans");
  const label = useLabel();
  const euro = useEuro();
  const key = tabKey(id);
  const feats = (tp.raw(need) as string[]).slice(1);
  return (
    <section data-screen-label="Upsell" className="mx-auto mt-6 flex w-full max-w-[460px] flex-col gap-3.5 rounded-[18px] border border-line bg-card p-6">
      <span className="eyebrow">{PLANS[need].name}</span>
      <h1 className="m-0 font-serif text-[32px] font-normal leading-[1.1]">
        {key ? label(key) : ts("gate_map")} {t("upT")} {PLANS[need].name}
      </h1>
      <p className="m-0 text-[14px] leading-normal text-mut">{t("upSub")}</p>
      <div className="flex flex-col gap-2">
        {feats.map((f) => (
          <div key={f} className="flex gap-2 text-[13.5px] leading-snug">
            <Check size={15} strokeWidth={2.6} className="mt-0.5 flex-none text-ok" />
            <span>{f}</span>
          </div>
        ))}
      </div>
      <Link href="/plan" className="hit44 flex min-h-[50px] items-center justify-center rounded-full bg-acc px-4 text-center text-sm font-bold text-onacc hover:text-onacc">
        {t("upBtn")} {PLANS[need].name} · {euro(PLANS[need].month)} {t("perMo")}
      </Link>
      <Link href="/" className="hit44 flex min-h-11 items-center justify-center text-sm font-bold text-mut">
        {t("notNow")}
      </Link>
    </section>
  );
}
