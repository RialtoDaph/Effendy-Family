"use client";

import { Star } from "lucide-react";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useTime } from "@/components/time-data";
import { AddButton, Card, EmptyNote, H2 } from "@/components/ui";
import { AppIcon } from "@/lib/icons";
import { eur } from "@/lib/money";
import { dayLabel, nextFriday } from "@/lib/time";
import { ModuleTabs } from "./module-tabs";
import { PageHeader } from "./page-header";

export function DateNightsScreen() {
  const { today } = useMoney();
  const time = useTime();
  const { openForm } = useMoneyForms();
  const friday = nextFriday(today.iso);
  const planned = time.dateNights.filter((d) => d.date >= today.iso).sort((a, b) => a.date.localeCompare(b.date));
  const next = planned[0];
  const history = time.dateNights.filter((d) => d.date < today.iso);
  const year = history.filter((d) => d.date.startsWith(String(today.y)));
  const spent = year.reduce((a, d) => a + (d.cost ?? 0), 0);

  return (
    <>
      <div className="flex flex-col gap-3">
        <PageHeader eyebrow="Life" title="Date nights" />
        <ModuleTabs module="life" active="together" />
      </div>

      <div className="rounded-[10px] bg-inv p-5 text-white">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">
          {next ? (next.date === friday ? "This Friday" : dayLabel(next.date)) : `This Friday · ${dayLabel(friday)}`}
        </div>
        {next ? (
          <button onClick={() => openForm("datenight", next.id)} className="mt-2 block border-0 bg-transparent p-0 text-left text-white">
            <div className="text-[24px] font-black leading-tight tracking-[-0.02em]">{next.name}</div>
            <div className="mt-1 text-[13px] text-white/70">
              {next.cost != null ? `About ${eur(next.cost)}` : "No cost set"}
              {planned.length > 1 && ` · ${planned.length - 1} more planned`}
            </div>
          </button>
        ) : (
          <>
            <div className="mt-2 text-[22px] font-black leading-tight">Nothing planned yet</div>
            <button
              onClick={() => openForm("datenight", undefined, { date: friday })}
              className="mt-3 min-h-11 rounded-full border-0 bg-acc px-5 text-[13.5px] font-extrabold text-onacc"
            >
              Plan Friday
            </button>
          </>
        )}
      </div>

      <Card className="flex flex-col gap-1">
        <div className="mb-1 flex items-baseline justify-between">
          <H2>Ideas</H2>
          <AddButton onClick={() => openForm("idea")} />
        </div>
        {time.dateIdeas.map((i) => (
          <div key={i.id} className="flex items-center gap-3 border-t border-line py-3">
            <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl bg-soft text-ink">
              <AppIcon name={i.icon} size={19} strokeWidth={1.7} />
            </span>
            <button onClick={() => openForm("idea", i.id)} className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left">
              <div className="text-sm font-bold text-ink">{i.name}</div>
              <div className="text-xs text-mut2">
                {[i.short, i.cost != null ? `about ${eur(i.cost)}` : ""].filter(Boolean).join(" · ")}
              </div>
            </button>
            <button
              onClick={() => openForm("datenight", undefined, { name: i.name, cost: i.cost == null ? "" : String(i.cost), icon: i.icon, date: friday, idea_id: i.id })}
              className="min-h-10 whitespace-nowrap rounded-full border-0 bg-tint px-3.5 text-[12.5px] font-extrabold text-acct"
            >
              Plan
            </button>
          </div>
        ))}
        {!time.dateIdeas.length && <EmptyNote>Collect ideas you both like: a restaurant, a walk, a day trip. Tap + Add.</EmptyNote>}
      </Card>

      <Card className="flex flex-col gap-1">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <H2>History</H2>
          {year.length > 0 && (
            <span className="text-xs text-mut">
              {year.length} this year · {eur(spent)}
            </span>
          )}
        </div>
        {history.map((d) => (
          <button key={d.id} onClick={() => openForm("datenight", d.id)} className="flex w-full items-center gap-3 border-0 border-t border-line bg-transparent py-3 text-left">
            <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl bg-soft text-ink">
              <AppIcon name={d.icon} size={19} strokeWidth={1.7} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-ink">{d.name}</div>
              <div className="text-xs text-mut2">
                {dayLabel(d.date)}
                {d.cost != null && ` · ${eur(d.cost)}`}
              </div>
            </div>
            {d.rating ? (
              <span className="flex gap-0.5 text-ink" aria-label={`${d.rating} of 5`}>
                {Array.from({ length: d.rating }, (_, i) => (
                  <Star key={i} size={13} fill="currentColor" strokeWidth={0} />
                ))}
              </span>
            ) : (
              <span className="text-xs font-bold text-acct">Rate</span>
            )}
          </button>
        ))}
        {!history.length && <EmptyNote>Past date nights show up here, with how they were.</EmptyNote>}
      </Card>
    </>
  );
}
