"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAppData } from "@/components/app-data";
import { ScreenEmpty } from "@/components/empty-state";
import { useFinance } from "@/components/finance-data";
import { useMoneyForms } from "@/components/money-forms";
import { useLabel } from "@/components/nav-label";
import { PrivateMark } from "@/components/ui";
import { assetEur, rpFull } from "@/lib/finance";
import { AppIcon } from "@/lib/icons";
import { eur } from "@/lib/money";
import { useDates } from "@/lib/use-dates";
import { ModuleHeader, ModuleTabs } from "./module-tabs";
import { PageHeader } from "./page-header";

export function InvestScreen() {
  const t = useTranslations();
  const ts = useTranslations("tools");
  const dates = useDates();
  const label = useLabel();
  const { assets, worth, rate, fxRate, fxDate, loaded } = useFinance();
  const { userId } = useAppData();
  const { openForm } = useMoneyForms();
  const family = assets.filter((a) => a.visibility === "family");
  const mine = assets.filter((a) => a.visibility === "private" && a.owner_id === userId);
  const idrTotal = family.filter((a) => a.orig_currency === "IDR").reduce((s, a) => s + assetEur(a, rate), 0);

  if (loaded && !assets.length) {
    return (
      <>
        <ModuleHeader module="invest" active="invest" />
        <ScreenEmpty eyebrow={label("nav.overview")} title={t("settings.e_invest")} action={t("t.b_asset")} onAction={() => openForm("asset")} />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <PageHeader eyebrow={ts("invest_career")} title={label("nav.overview")} />
        <ModuleTabs module="invest" active="invest" />
      </div>

      <section className="rounded-[10px] bg-inv p-6 text-white">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[.16em] text-acc2">{ts("iv_worth")}</div>
        <div className="mt-2 text-[46px] font-black leading-none tracking-[-0.03em]">{eur(worth.net, 0)}</div>
        <div className="mt-2 text-sm text-white/70">{ts("iv_sub")}</div>
        <div className="mt-4 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))]">
          {[
            [ts("iv_assets"), eur(worth.assets, 0)],
            [ts("iv_debts"), worth.debts ? `−${eur(worth.debts, 0)}` : "€0"],
            [ts("iv_idr"), eur(idrTotal, 0)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[10px] border border-white/10 bg-white/[.06] px-4 py-3">
              <div className="text-[11px] text-white/55">{k}</div>
              <div className="text-xl font-black">{v}</div>
            </div>
          ))}
        </div>
        {mine.length > 0 && (
          <div className="mt-4 text-[12.5px] text-white/60">
            {ts("iv_private", { amount: eur(mine.reduce((s, a) => s + assetEur(a, rate), 0), 0) })}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-extrabold">{ts("iv_own")}</h2>
        <button
          onClick={() => openForm("asset")}
          className="h-11 whitespace-nowrap rounded-full border-0 bg-inv px-[18px] text-[13.5px] font-extrabold text-white"
        >
          {ts("iv_add")}
        </button>
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        {[...family, ...mine].map((a) => (
          <section
            key={a.id}
            className={`flex flex-col gap-2 rounded-xl border bg-card p-[18px] ${a.visibility === "private" ? "border-dashed border-line2" : "border-line"}`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[13px] bg-tint text-ink">
                <AppIcon name={a.icon} size={21} strokeWidth={1.7} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-extrabold">{a.name}</div>
                <div className="truncate text-xs text-mut2">{a.location ?? " "}</div>
              </div>
            </div>
            <div className="text-[28px] font-black tracking-[-0.02em]">{eur(assetEur(a, rate), 0)}</div>
            {a.orig_currency === "IDR" && <div className="-mt-1.5 text-xs text-mut2">{rpFull(a.orig_value)}</div>}
            {a.note && <div className="text-[12.5px] text-mut">{a.note}</div>}
            {a.visibility === "private" && <PrivateMark />}
            <button
              onClick={() => openForm("asset", a.id)}
              className="mt-auto self-start min-h-10 rounded-full border-0 bg-tint px-3.5 text-[12.5px] font-extrabold text-acct"
            >
              {ts("iv_update")}
            </button>
          </section>
        ))}
      </div>
      
      <p className="m-0 text-[12.5px] text-mut2">
        {ts("iv_rate", { rate: rate.toLocaleString("id-ID") })}
        {fxRate
          ? ts("iv_saved", { date: fxDate ? dates.short(fxDate) : "" })
          : ts.rich("iv_default", {
              a: (c) => (
                <Link href="/remit" className="hit44 font-bold text-acct">
                  {c}
                </Link>
              ),
            })}
      </p>
    </>
  );
}
