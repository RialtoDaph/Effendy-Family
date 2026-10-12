"use client";

import Link from "next/link";
import { useState } from "react";
import { useFinance, type WorthPoint } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { assetEur, worthChange } from "@/lib/finance";
import { eur, plural, shortDate } from "@/lib/money";

/** Home: family net worth with its line over time, a split bar and every account. */
export function NetWorthCard() {
  const { worth, assets, debts, rate, worthHistory } = useFinance();
  const { today } = useMoney();
  const [picked, setPicked] = useState<WorthPoint | null>(null);
  if (!assets.length && !debts.length) return null;

  const famAssets = assets
    .filter((a) => a.visibility === "family")
    .map((a) => ({ id: a.id, name: a.name, eur: assetEur(a, rate) }))
    .sort((a, b) => b.eur - a.eur);
  const hasPrivate = assets.some((a) => a.visibility === "private") || debts.some((d) => d.visibility === "private");
  const change = worthChange(worthHistory, today.iso);
  const sign = (n: number) => (n >= 0 ? "+" : "−");

  return (
    <section className="flex flex-col gap-3 rounded-[10px] border border-line bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-lg font-extrabold tracking-[-0.01em]">Net worth</h2>
        <Link href="/invest" className="font-mono text-xs text-mut hover:text-ink">
          {plural(famAssets.length, "account")} →
        </Link>
      </div>
      <div>
        <div className="text-[40px] font-black leading-none tracking-[-0.03em]">{eur(worth.net, 0)}</div>
        {picked ? (
          <div className="mt-2 text-[13.5px] font-bold text-ink" aria-live="polite">
            {shortDate(picked.day)} · <span className="font-mono">{eur(picked.net, 0)}</span>
          </div>
        ) : change ? (
          <div className={`mt-2 text-[13.5px] font-bold ${change.delta >= 0 ? "text-ok" : "text-bad"}`}>
            {sign(change.delta)}
            {eur(Math.abs(change.delta), 0)} this month
            {change.pct !== null && ` · ${sign(change.pct)}${Math.abs(change.pct).toFixed(1)}%`}
          </div>
        ) : (
          <div className="mt-2 text-[12.5px] text-mut2">The line grows by one point on each day the app is opened.</div>
        )}
      </div>

      {worthHistory.length >= 2 && <Sparkline points={worthHistory.slice(-366)} onPick={setPicked} />}

      {famAssets.length > 0 && worth.assets > 0 && (
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
          {famAssets
            .filter((a) => a.eur > 0)
            .map((a) => (
              <div key={a.id} title={`${a.name} ${eur(a.eur, 0)}`} className="bg-ink first:rounded-l-full last:rounded-r-full" style={{ flex: a.eur / worth.assets }} />
            ))}
        </div>
      )}

      <ul className="m-0 flex list-none flex-col p-0">
        {worth.debts > 0 && (
          <li className="flex items-center gap-2.5 border-b border-line pb-2.5 text-[14px]">
            <span className="h-2.5 w-2.5 flex-none rounded-[3px] bg-bad" aria-hidden />
            <Link href="/debts" className="flex-1 text-ink hover:underline">
              Debts
            </Link>
            <span className="font-mono font-bold text-bad">−{eur(worth.debts, 0)}</span>
          </li>
        )}
        {famAssets.map((a) => (
          <li key={a.id} className="flex items-center gap-2.5 pt-2.5 text-[14px]">
            <span className="h-2.5 w-2.5 flex-none rounded-[3px] bg-ink" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{a.name}</span>
            <span className="font-mono font-bold">{eur(a.eur, 0)}</span>
          </li>
        ))}
      </ul>
      {hasPrivate && <div className="text-xs text-mut2">Family total only. Your private items are not counted here.</div>}
    </section>
  );
}

/** Net worth over time: one 2px line. Hover or tap shows that day's value above the line. */
function Sparkline({ points, onPick }: { points: WorthPoint[]; onPick: (p: WorthPoint | null) => void }) {
  const [hover, setHoverIndex] = useState<number | null>(null);
  const setHover = (i: number | null) => {
    setHoverIndex(i);
    onPick(i === null ? null : points[i]);
  };
  const W = 320;
  const H = 96;
  const PAD = 6;
  const t = points.map((p) => Date.parse(p.day));
  const t0 = t[0];
  const span = Math.max(1, t[t.length - 1] - t0);
  const vals = points.map((p) => p.net);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi - lo < 1) {
    lo -= 1;
    hi += 1;
  }
  const x = (i: number) => PAD + ((t[i] - t0) / span) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - (v - lo) / (hi - lo)) * (H - PAD * 2);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.net).toFixed(1)}`).join(" ");
  const h = hover === null ? null : points[hover];

  function pick(clientX: number, rect: DOMRect) {
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setHover(best);
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-[96px] w-full touch-none"
        role="img"
        aria-label={`Net worth from ${shortDate(points[0].day)} (${eur(points[0].net, 0)}) to ${shortDate(points[points.length - 1].day)} (${eur(points[points.length - 1].net, 0)})`}
        onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setHover(null)}
      >
        <path d={d} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="var(--line2)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      </svg>
      {h && hover !== null && (
        <span
          className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-ink"
          style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(h.net) / H) * 100}%` }}
        />
      )}
    </div>
  );
}
