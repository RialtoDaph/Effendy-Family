"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAppData } from "@/components/app-data";
import { ModuleEmpty } from "@/components/empty-state";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useLabel } from "@/components/nav-label";
import { AddButton, H2, PrivateMark } from "@/components/ui";
import { bestQuote, remittanceQuotes, rp, rpFull } from "@/lib/finance";
import { eur, parseAmount } from "@/lib/money";
import { useDates } from "@/lib/use-dates";
import { ModuleHeader } from "./module-tabs";

const QUICK = [100, 200, 300, 500];

export function RemitScreen() {
  const tm = useTranslations("money");
  const dates = useDates();
  const label = useLabel();
  const { remittances, rate, fxRate, fxDate, saveRate, loaded } = useFinance();
  const { today } = useMoney();
  const { userId } = useAppData();
  const { openForm } = useMoneyForms();
  const [amount, setAmount] = useState("200");
  const [rateText, setRateText] = useState<string | null>(null);

  const thisYear = remittances.filter((r) => r.visibility === "family" && r.date.startsWith(`${today.y}-`));
  const sentEur = thisYear.reduce((a, r) => a + r.eur, 0);
  const sentIdr = thisYear.reduce((a, r) => a + r.idr_received, 0);
  const fees = thisYear.reduce((a, r) => a + r.fee_eur, 0);
  const monthsSoFar = Math.max(1, today.m);
  const byPerson = Object.entries(
    thisYear.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.to_name]: (acc[r.to_name] ?? 0) + r.eur }), {}),
  ).sort((a, b) => b[1] - a[1]);
  const myPrivate = remittances.filter((r) => r.visibility === "private" && r.owner_id === userId && r.date.startsWith(`${today.y}-`));

  const eurAmount = parseAmount(amount);
  const shownRate = rateText ?? String(rate);
  const midRate = parseAmount(shownRate) > 0 ? parseAmount(shownRate) : rate;
  const quotes = eurAmount > 0 ? remittanceQuotes(eurAmount, midRate) : [];
  const best = quotes.length ? bestQuote(quotes) : null;

  if (loaded && !remittances.length) {
    return (
      <>
        <ModuleHeader module="money" active="remit" />
        <ModuleEmpty screen="remit" eyebrow={label("nav.to_indonesia")} onAction={() => openForm("remit")} />
      </>
    );
  }

  return (
    <>
      <ModuleHeader module="money" active="remit" />

      <section className="grid gap-6 rounded-[18px] bg-inv p-6 text-white [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <div>
          <div className="font-mono text-[11px] font-bold uppercase tracking-[.16em] text-white/55">{tm("sent_home_in", { year: today.y })}</div>
          <div className="mt-2 font-serif text-[60px] font-normal leading-none tabular-nums tracking-[-0.01em]">{eur(sentEur, 0)}</div>
          <div className="mt-0.5 text-sm font-bold text-acc2">{tm("idr_received", { idr: rp(sentIdr) })}</div>
          <div className="mt-2 text-[13px] text-white/60">
            {tm("remit_summary", { n: thisYear.length, avg: eur(sentEur / monthsSoFar, 0), fees: eur(fees, 2) })}
          </div>
          {myPrivate.length > 0 && (
            <div className="mt-2 text-[12.5px] text-white/60">{tm("remit_private", { total: eur(myPrivate.reduce((a, r) => a + r.eur, 0)) })}</div>
          )}
        </div>
        <div className="flex flex-col justify-center gap-3">
          {byPerson.map(([name, total]) => (
            <div key={name}>
              <div className="flex justify-between gap-2.5 text-[13.5px] font-bold">
                <span>{name}</span>
                <span className="tabular-nums">{eur(total, 0)}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-acc2" style={{ width: `${(total / byPerson[0][1]) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))]">
        <section className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-card p-5">
          <div>
            <H2>{tm("before_you_send")}</H2>
            <div className="mt-[3px] text-[12.5px] text-mut">{tm("compare_arrives")}</div>
          </div>
          <div className="flex h-[60px] items-center gap-2 rounded-[10px] border border-line bg-soft px-3.5">
            <span className="text-[22px] font-bold text-mut">€</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label={tm("amount_in_euro")}
              className="min-w-0 flex-1 border-0 bg-transparent text-[26px] font-bold text-ink outline-none"
            />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => setAmount(String(q))}
                className={`min-h-11 rounded-[10px] border text-[13.5px] font-bold ${eurAmount === q ? "border-ink bg-inv text-white" : "border-line bg-card text-ink"}`}
              >
                €{q}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2.5 text-[13.5px]">
            <span className="text-mut">{tm("rate_today")}</span>
            <div className="flex h-11 items-center gap-1.5 rounded-[10px] border border-line bg-card px-2.5">
              <span className="font-bold text-mut">Rp</span>
              <input
                inputMode="decimal"
                value={shownRate}
                onChange={(e) => setRateText(e.target.value)}
                aria-label={tm("rupiah_per_euro")}
                className="w-[90px] border-0 bg-transparent text-base font-bold text-ink outline-none"
              />
            </div>
            {rateText !== null && parseAmount(rateText) > 0 && parseAmount(rateText) !== fxRate && (
              <button
                onClick={async () => {
                  await saveRate(parseAmount(rateText));
                  setRateText(null);
                }}
                className="hit44 min-h-10 rounded-full border-0 bg-tint px-3.5 text-[12.5px] font-bold text-acct"
              >
                {tm("save_rate")}
              </button>
            )}
            <span className="text-xs text-mut2">{fxRate ? tm("rate_saved_on", { date: fxDate ? dates.short(fxDate) : "" }) : tm("rate_not_saved")}</span>
          </div>
          <div className="flex flex-col gap-2">
            {quotes.map((q) => {
              const isBest = q.name === best?.name;
              return (
                <div key={q.name} className={`flex items-center gap-3 rounded-[10px] px-3.5 py-3 ${isBest ? "border-2 border-ok" : "border border-line"}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">{q.name}</span>
                      {isBest && <span className="whitespace-nowrap rounded-full bg-okbg px-2 py-0.5 text-[11px] font-bold text-ok">{tm("most_arrives")}</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-mut2">{tm("quote_meta", { fee: eur(q.fee, 2), rate: Math.round(q.rate).toLocaleString("id-ID") })}</div>
                  </div>
                  <span className={`whitespace-nowrap text-[15px] font-bold tabular-nums ${isBest ? "text-ok" : ""}`}>{rpFull(q.idr)}</span>
                </div>
              );
            })}
          </div>
          {best && (
            <button
              onClick={() => openForm("remit", undefined, { eur: String(eurAmount), fee: String(best.fee), rate: String(best.rate), provider: best.name })}
              className="min-h-12 rounded-full border-0 bg-acc text-sm font-bold text-onacc"
            >
              {tm("log_this_transfer")}
            </button>
          )}
          <div className="text-xs text-mut2">{tm("fees_estimates")}</div>
        </section>

        <section className="rounded-[18px] border border-line bg-card px-5 pb-1 pt-2">
          <div className="flex items-center justify-between gap-2.5 pb-2 pt-3">
            <H2>{tm("transfers")}</H2>
            <AddButton onClick={() => openForm("remit")} />
          </div>
          {remittances.map((r) => (
            <button
              key={r.id}
              onClick={() => openForm("remit", r.id)}
              className={`flex w-full items-center gap-3 border-0 border-t border-line bg-transparent py-3 text-left ${r.visibility === "private" ? "border-dashed" : ""}`}
            >
              <span className="flex h-12 w-11 flex-none flex-col items-center justify-center rounded-[10px] bg-soft2 leading-none">
                <span className="text-[17px] font-bold text-ink">{Number(r.date.slice(8, 10))}</span>
                <span className="mt-[3px] font-mono text-[10.5px] font-bold uppercase text-mut">{dates.mon(r.date)}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-bold text-ink">{r.to_name}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-mut2">
                  <span>{r.purpose ? `${r.purpose} · ${r.provider}` : r.provider}</span>
                  {r.visibility === "private" && <PrivateMark />}
                </span>
              </span>
              <span className="flex-none text-right">
                <span className="block text-[15px] font-bold tabular-nums text-ink">{eur(r.eur)}</span>
                <span className="block text-xs tabular-nums text-mut2">{rp(r.idr_received)}</span>
              </span>
            </button>
          ))}
        </section>
      </div>
    </>
  );
}
