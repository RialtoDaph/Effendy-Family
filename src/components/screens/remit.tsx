"use client";

import { useState } from "react";
import { useAppData } from "@/components/app-data";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { AddButton, Card, EmptyNote, H2, PrivateMark } from "@/components/ui";
import { bestQuote, remittanceQuotes, rp, rpFull } from "@/lib/finance";
import { eur, parseAmount, shortDate } from "@/lib/money";
import { ModuleTabs } from "./module-tabs";
import { PageHeader } from "./page-header";

const QUICK = [100, 200, 300, 500];

export function RemitScreen() {
  const { remittances, rate, fxRate, fxDate, saveRate } = useFinance();
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

  return (
    <>
      <div className="flex flex-col gap-3">
        <PageHeader eyebrow="Money" title="To Indonesia" />
        <ModuleTabs module="money" active="remit" />
      </div>

      <section className="rounded-[10px] bg-inv p-6 text-white">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[.16em] text-acc2">Sent in {today.y}</div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-[46px] font-black leading-none tracking-[-0.03em]">{eur(sentEur, 0)}</span>
          <span className="text-base font-bold text-white/70">≈ {rp(sentIdr)} received</span>
        </div>
        <div className="mt-4 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
          {[
            ["Transfers", String(thisYear.length)],
            ["Per month", eur(sentEur / monthsSoFar, 0)],
            ["Fees paid", eur(fees)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[10px] border border-white/10 bg-white/[.06] px-4 py-3">
              <div className="text-[11px] text-white/55">{k}</div>
              <div className="text-xl font-black">{v}</div>
            </div>
          ))}
        </div>
        {byPerson.length > 0 && (
          <div className="mt-4 flex flex-col gap-2.5">
            {byPerson.map(([name, total]) => (
              <div key={name}>
                <div className="flex justify-between text-[13px]">
                  <span className="text-white/80">{name}</span>
                  <span className="font-bold">{eur(total, 0)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-acc2" style={{ width: `${(total / byPerson[0][1]) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {myPrivate.length > 0 && (
          <div className="mt-4 text-[12.5px] text-white/60">
            Your private transfers this year: {eur(myPrivate.reduce((a, r) => a + r.eur, 0))} · not in these numbers
          </div>
        )}
      </section>

      <Card className="flex flex-col gap-4">
        <div>
          <H2>Before you send</H2>
          <div className="mt-1 text-[12.5px] text-mut">Compare what arrives in Indonesia.</div>
        </div>
        <div className="flex h-14 items-center gap-2 rounded-[10px] border border-line bg-soft px-3.5">
          <span className="text-xl font-black text-mut2">€</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount to send in euros"
            className="min-w-0 flex-1 border-0 bg-transparent text-[22px] font-black text-ink outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => setAmount(String(q))}
              className={`min-h-10 rounded-full border px-3.5 text-[13px] font-bold ${
                eurAmount === q ? "border-ink bg-inv text-white" : "border-line bg-card text-ink"
              }`}
            >
              €{q}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-bold text-mut">Rate today: 1 € = Rp</span>
          <input
            inputMode="decimal"
            value={shownRate}
            onChange={(e) => setRateText(e.target.value)}
            aria-label="Rupiah per euro"
            className="h-11 w-[120px] rounded-[10px] border border-line bg-soft px-3 text-base font-bold text-ink outline-none"
          />
          {rateText !== null && parseAmount(rateText) > 0 && parseAmount(rateText) !== fxRate && (
            <button
              onClick={async () => {
                await saveRate(parseAmount(rateText));
                setRateText(null);
              }}
              className="min-h-10 rounded-full border-0 bg-tint px-3.5 text-[12.5px] font-extrabold text-acct"
            >
              Save rate
            </button>
          )}
          <span className="text-xs text-mut2">
            {fxRate ? `saved ${fxDate ? shortDate(fxDate) : ""}` : "not saved yet · using Rp 18,000"}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {quotes.map((q) => {
            const isBest = q.name === best?.name;
            return (
              <div
                key={q.name}
                className={`flex flex-wrap items-center gap-3 rounded-[10px] border-2 px-4 py-3 ${isBest ? "border-ok" : "border-line"}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold">{q.name}</span>
                    {isBest && (
                      <span className="rounded-full bg-okbg px-2 py-0.5 text-[11px] font-extrabold text-ok">Most arrives</span>
                    )}
                  </div>
                  <div className="text-xs text-mut2">
                    fee {eur(q.fee)} · 1 € = Rp {q.rate.toLocaleString("id-ID")}
                  </div>
                </div>
                <span className={`text-base font-black ${isBest ? "text-ok" : ""}`}>{rpFull(q.idr)}</span>
              </div>
            );
          })}
        </div>
        {best && (
          <button
            onClick={() =>
              openForm("remit", undefined, {
                eur: String(eurAmount),
                fee: String(best.fee),
                rate: String(best.rate),
                provider: best.name,
              })
            }
            className="min-h-12 rounded-full border-0 bg-acc text-sm font-extrabold text-onacc"
          >
            Log this transfer
          </button>
        )}
        <div className="text-xs text-mut2">Fees and rates are estimates. Check the live rate in the app before you send.</div>
      </Card>

      <Card>
        <div className="mb-1.5 flex items-center justify-between gap-2.5">
          <H2>Transfers</H2>
          <AddButton onClick={() => openForm("remit")} />
        </div>
        {remittances.map((r) => (
          <button
            key={r.id}
            onClick={() => openForm("remit", r.id)}
            className={`flex w-full items-center gap-3 border-0 border-b border-line bg-transparent py-3 text-left ${
              r.visibility === "private" ? "border-dashed" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-ink">{r.to_name}</div>
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-mut2">
                <span>
                  {shortDate(r.date)} · {r.provider}
                  {r.purpose ? ` · ${r.purpose}` : ""}
                </span>
                {r.visibility === "private" && <PrivateMark />}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black text-ink">{eur(r.eur)}</div>
              <div className="text-xs text-mut2">{rpFull(r.idr_received)}</div>
            </div>
          </button>
        ))}
        {!remittances.length && <EmptyNote>No transfers logged yet. Use the calculator above, then “Log this transfer”.</EmptyNote>}
      </Card>
    </>
  );
}
