"use client";

import { useState } from "react";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { Switch } from "@/components/sheet";
import { Card, EmptyNote, H2 } from "@/components/ui";
import { assetEur } from "@/lib/finance";
import { eur } from "@/lib/money";
import { CLASS_LABEL, SCENARIO_LABEL, SCENARIO_RATES, assetClass, simulate, type AssetClass, type Scenario } from "@/lib/plan";
import { ModuleTabs } from "./module-tabs";
import { PageHeader } from "./page-header";

const SCENARIOS: Scenario[] = ["cautious", "middle", "hopeful"];
const YEARS = [0, 1, 3, 5, 10];

export function SimScreen() {
  const { goals, today } = useMoney();
  const { assets, rate } = useFinance();
  const family = assets.filter((a) => a.visibility === "family");
  const saving = goals.filter((g) => g.visibility === "family").reduce((a, g) => a + (g.monthly || 0), 0);
  const [keepSaving, setKeepSaving] = useState(true);
  const [includeIdr, setIncludeIdr] = useState(true);
  const monthly = keepSaving ? saving : 0;
  const runs = Object.fromEntries(SCENARIOS.map((s) => [s, simulate(family, rate, s, { monthly, includeIdr })])) as Record<Scenario, number[]>;

  const byClass = new Map<AssetClass, number>();
  for (const a of family) byClass.set(assetClass(a), (byClass.get(assetClass(a)) ?? 0) + assetEur(a, rate));

  const toggles = [
    { label: `Keep saving ${eur(saving)} a month`, sub: "Your goals' monthly savings, invested like an ETF", on: keepSaving, set: () => setKeepSaving((v) => !v) },
    { label: "Include Rupiah assets", sub: "Converted at your saved rate", on: includeIdr, set: () => setIncludeIdr((v) => !v) },
  ];

  return (
    <>
      <div className="flex flex-col gap-3">
        <PageHeader eyebrow="Invest & career" title="10-year simulation" />
        <ModuleTabs module="invest" active="sim" />
      </div>

      {!family.length ? (
        <EmptyNote>Add what you own under Invest → Overview (ETF, Tagesgeld, gold, Rupiah savings) to see the next ten years.</EmptyNote>
      ) : (
        <>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
            {SCENARIOS.map((s) => (
              <div key={s} className={`rounded-[10px] p-4 ${s === "middle" ? "bg-inv text-white" : "border border-line bg-card"}`}>
                <div className={`font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${s === "middle" ? "text-white/60" : "text-mut"}`}>
                  {SCENARIO_LABEL[s]} · {today.y + 10}
                </div>
                <div className="mt-1.5 text-[30px] font-black tracking-[-0.02em]">{eur(runs[s][10])}</div>
                <div className={`text-xs ${s === "middle" ? "text-white/70" : "text-mut"}`}>
                  ETF {SCENARIO_RATES[s].etf}% · cash {SCENARIO_RATES[s].cash}% · gold {SCENARIO_RATES[s].gold}% a year
                </div>
              </div>
            ))}
          </div>

          <Card className="flex flex-col gap-1">
            {toggles.map((t) => (
              <div key={t.label} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{t.label}</div>
                  <div className="mt-0.5 text-xs text-mut">{t.sub}</div>
                </div>
                <button onClick={t.set} aria-label={t.label} aria-pressed={t.on} className="flex-none border-0 bg-transparent p-0">
                  <Switch on={t.on} />
                </button>
              </div>
            ))}
          </Card>

          <Card className="overflow-x-auto">
            <H2 className="mb-2">Year by year</H2>
            <table className="w-full min-w-[320px] border-collapse text-[13.5px]">
              <thead>
                <tr className="text-left text-xs text-mut">
                  <th className="py-2 font-bold">Year</th>
                  {SCENARIOS.map((s) => (
                    <th key={s} className="py-2 text-right font-bold">
                      {SCENARIO_LABEL[s]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {YEARS.map((y) => (
                  <tr key={y} className="border-t border-line">
                    <td className="py-2.5 font-bold">{y === 0 ? "Today" : today.y + y}</td>
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
            <H2 className="mb-1">What you own today</H2>
            {[...byClass.entries()].map(([c, v]) => (
              <div key={c} className="flex justify-between border-t border-line py-2.5 text-[13.5px]">
                <span className="text-mut">{CLASS_LABEL[c]}</span>
                <span className="font-mono font-bold">{eur(v)}</span>
              </div>
            ))}
            <div className="pt-2 text-xs text-mut2">
              Simple yearly rates, no taxes or fees. It shows a range, not a forecast. Private items are not included.
            </div>
          </Card>
        </>
      )}
    </>
  );
}
