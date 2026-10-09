"use client";

import Link from "next/link";
import { useAppData } from "@/components/app-data";
import { useFinance } from "@/components/finance-data";
import { useMoneyForms } from "@/components/money-forms";
import { EmptyNote, PrivateMark } from "@/components/ui";
import { assetEur, rpFull } from "@/lib/finance";
import { AppIcon } from "@/lib/icons";
import { eur, shortDate } from "@/lib/money";
import { ModuleTabs } from "./module-tabs";
import { PageHeader } from "./page-header";

export function InvestScreen() {
  const { assets, worth, rate, fxRate, fxDate } = useFinance();
  const { userId } = useAppData();
  const { openForm } = useMoneyForms();
  const family = assets.filter((a) => a.visibility === "family");
  const mine = assets.filter((a) => a.visibility === "private" && a.owner_id === userId);
  const idrTotal = family.filter((a) => a.orig_currency === "IDR").reduce((s, a) => s + assetEur(a, rate), 0);

  return (
    <>
      <div className="flex flex-col gap-3">
        <PageHeader eyebrow="Invest & career" title="Overview" />
        <ModuleTabs module="invest" active="invest" />
      </div>

      <section className="rounded-[10px] bg-inv p-6 text-white">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[.16em] text-acc2">Family net worth</div>
        <div className="mt-2 text-[46px] font-black leading-none tracking-[-0.03em]">{eur(worth.net, 0)}</div>
        <div className="mt-2 text-sm text-white/70">savings &amp; investments minus debts</div>
        <div className="mt-4 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))]">
          {[
            ["Savings & investments", eur(worth.assets, 0)],
            ["Debts", worth.debts ? `−${eur(worth.debts, 0)}` : "€0"],
            ["In Indonesia (IDR)", eur(idrTotal, 0)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[10px] border border-white/10 bg-white/[.06] px-4 py-3">
              <div className="text-[11px] text-white/55">{k}</div>
              <div className="text-xl font-black">{v}</div>
            </div>
          ))}
        </div>
        {mine.length > 0 && (
          <div className="mt-4 text-[12.5px] text-white/60">
            Your private savings ({eur(mine.reduce((s, a) => s + assetEur(a, rate), 0), 0)}) are not in these numbers.
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-extrabold">What you own</h2>
        <button
          onClick={() => openForm("asset")}
          className="h-11 whitespace-nowrap rounded-full border-0 bg-inv px-[18px] text-[13.5px] font-extrabold text-white"
        >
          + Add savings or investment
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
              Update value
            </button>
          </section>
        ))}
      </div>
      {!assets.length && <EmptyNote>Add your Tagesgeld, ETF, gold or savings in Indonesia. Update the values once a month.</EmptyNote>}

      <p className="m-0 text-[12.5px] text-mut2">
        Rupiah values converted at €1 = Rp {rate.toLocaleString("id-ID")}
        {fxRate ? ` (saved ${fxDate ? shortDate(fxDate) : ""})` : " (default — save today's rate under "}
        {!fxRate && (
          <>
            <Link href="/remit" className="font-bold text-acct">
              To Indonesia
            </Link>
            )
          </>
        )}
        .
      </p>
    </>
  );
}
