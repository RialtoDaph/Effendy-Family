"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ScreenEmpty } from "@/components/empty-state";
import { useFinance } from "@/components/finance-data";
import { useMoneyForms } from "@/components/money-forms";
import { useLabel } from "@/components/nav-label";
import { useMoney } from "@/components/money-data";
import { Switch } from "@/components/sheet";
import { Card, EmptyNote, H2 } from "@/components/ui";
import { assetEur } from "@/lib/finance";
import { eur } from "@/lib/money";
import { SCENARIO_RATES, assetClass, simulate, type AssetClass, type Scenario } from "@/lib/plan";
import { ModuleHeader, ModuleTabs } from "./module-tabs";
import { PageHeader } from "./page-header";

const SCENARIOS: Scenario[] = ["cautious", "middle", "hopeful"];
const YEARS = [0, 1, 3, 5, 10];

export function SimScreen() {
  const { goals, today } = useMoney();
  const { assets, rate, loaded } = useFinance();
  const t = useTranslations();
  const ts = useTranslations("tools");
  const label = useLabel();
  const { openForm } = useMoneyForms();
  const family = assets.filter((a) => a.visibility === "family");
  const saving = goals.filter((g) => g.visibility === "family").reduce((a, g) => a + (g.monthly || 0), 0);
  const [keepSaving, setKeepSaving] = useState(true);
  const [includeIdr, setIncludeIdr] = useState(true);
  const monthly = keepSaving ? saving : 0;
  const runs = Object.fromEntries(SCENARIOS.map((s) => [s, simulate(family, rate, s, { monthly, includeIdr })])) as Record<Scenario, number[]>;

  const byClass = new Map<AssetClass, number>();
  for (const a of family) byClass.set(assetClass(a), (byClass.get(assetClass(a)) ?? 0) + assetEur(a, rate));

  const toggles = [
    { label: ts("si_keep", { amount: eur(saving) }), sub: ts("si_keep_sub"), on: keepSaving, set: () => setKeepSaving((v) => !v) },
    { label: ts("si_idr"), sub: ts("si_idr_sub"), on: includeIdr, set: () => setIncludeIdr((v) => !v) },
  ];

  if (loaded && !assets.length) {
    return (
      <>
        <ModuleHeader module="invest" active="sim" />
        <ScreenEmpty eyebrow={label("nav.10_year_simulation")} title={t("t.e_sim")} action={t("t.b_asset")} onAction={() => openForm("asset")} />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <PageHeader eyebrow={ts("invest_career")} title={label("nav.10_year_simulation")} />
        <ModuleTabs module="invest" active="sim" />
      </div>

      {!family.length ? (
        <EmptyNote>{ts("si_none")}</EmptyNote>
      ) : (
        <>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
            {SCENARIOS.map((s) => (
              <div key={s} className={`rounded-[10px] p-4 ${s === "middle" ? "bg-inv text-white" : "border border-line bg-card"}`}>
                <div className={`font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${s === "middle" ? "text-white/60" : "text-mut"}`}>
                  {ts(`sc_${s}`)} · {today.y + 10}
                </div>
                <div className="mt-1.5 text-[30px] font-black tracking-[-0.02em]">{eur(runs[s][10])}</div>
                <div className={`text-xs ${s === "middle" ? "text-white/70" : "text-mut"}`}>
                  {ts("si_rates", SCENARIO_RATES[s])}
                </div>
              </div>
            ))}
          </div>

          <Card className="flex flex-col gap-1">
            {toggles.map((o) => (
              <div key={o.label} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{o.label}</div>
                  <div className="mt-0.5 text-xs text-mut">{o.sub}</div>
                </div>
                <button onClick={o.set} aria-label={o.label} aria-pressed={o.on} className="flex-none border-0 bg-transparent p-0">
                  <Switch on={o.on} />
                </button>
              </div>
            ))}
          </Card>

          <Card className="overflow-x-auto">
            <H2 className="mb-2">{ts("si_byyear")}</H2>
            <table className="w-full min-w-[320px] border-collapse text-[13.5px]">
              <thead>
                <tr className="text-left text-xs text-mut">
                  <th className="py-2 font-bold">{ts("si_year")}</th>
                  {SCENARIOS.map((s) => (
                    <th key={s} className="py-2 text-right font-bold">
                      {ts(`sc_${s}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {YEARS.map((y) => (
                  <tr key={y} className="border-t border-line">
                    <td className="py-2.5 font-bold">{y === 0 ? ts("today") : today.y + y}</td>
                    {SCENARIOS.map((s) => (
                      <td key={s} className={`py-2.5 text-right font-mono ${s === "middle" ? "font-bold" : ""}`}>
                        {eur(runs[s][y])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="flex flex-col gap-1">
            <H2 className="mb-1">{ts("si_own")}</H2>
            {[...byClass.entries()].map(([c, v]) => (
              <div key={c} className="flex justify-between border-t border-line py-2.5 text-[13.5px]">
                <span className="text-mut">{ts(`cl_${c}`)}</span>
                <span className="font-mono font-bold">{eur(v)}</span>
              </div>
            ))}
            <div className="pt-2 text-xs text-mut2">
              {ts("si_note")}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
