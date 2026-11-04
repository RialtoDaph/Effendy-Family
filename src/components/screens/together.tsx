"use client";

import { Pencil, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { ScreenEmpty } from "@/components/empty-state";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useLabel } from "@/components/nav-label";
import { useTime } from "@/components/time-data";
import { AddButton, Card, H2 } from "@/components/ui";
import { AppIcon } from "@/lib/icons";
import { eur } from "@/lib/money";
import { hm, nextFriday, weekStart, weekTotals } from "@/lib/time";
import { useDates } from "@/lib/use-dates";
import { ModuleHeader } from "./module-tabs";

const STAT = "rounded-[10px] border border-white/10 bg-white/5 px-3.5 py-2.5";

export function DateNightsScreen() {
  const tt = useTranslations("time");
  const t = useTranslations("t");
  const dates = useDates();
  const label = useLabel();
  const { today } = useMoney();
  const time = useTime();
  const { openForm } = useMoneyForms();
  const friday = nextFriday(today.iso);
  const planned = time.dateNights.filter((d) => d.date >= today.iso).sort((a, b) => a.date.localeCompare(b.date));
  const next = planned[0];
  const nextAt = next && hm(time.events.find((e) => e.id === next.event_id)?.start_time);
  const past = time.dateNights.filter((d) => d.date < today.iso);
  const count = past.filter((d) => d.date.startsWith(String(today.y))).length;

  // The target comes from a yearly goal such as "45 date nights".
  const target = time.yearlyGoals.find((g) => g.year === today.y && /date/i.test(`${g.name} ${g.unit}`))?.target;
  const weeks = weekTotals(past, weekStart(today.iso), 12, () => 1);
  const weeksLeft = Math.max(0, Math.floor((Date.UTC(today.y, 11, 31) - Date.parse(`${today.iso}T00:00:00Z`)) / (7 * 864e5)));

  if (time.loaded && !time.dateNights.length && !time.dateIdeas.length) {
    return (
      <>
        <ModuleHeader module="life" active="together" />
        <ScreenEmpty eyebrow={label("nav.date_nights")} title={t("e_together")} action={t("b_date")} onAction={() => openForm("datenight", undefined, { date: friday })} />
      </>
    );
  }

  return (
    <>
      <ModuleHeader module="life" active="together" />

      <div className="grid items-stretch gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
        <section className="flex flex-col gap-3 rounded-[18px] bg-inv p-6 text-white">
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-acc2">
            {next ? tt("next_date", { when: [dates.day(next.date), nextAt].filter(Boolean).join(" · ") }) : tt("next_date", { when: dates.day(friday) })}
          </div>
          {next ? (
            <>
              <button onClick={() => openForm("datenight", next.id)} className="border-0 bg-transparent p-0 text-left text-white">
                <span className="font-serif text-[36px] font-normal leading-[1.15] tracking-[-0.01em]">{next.name}</span>
              </button>
              {next.note && <div className="text-sm text-white/75">{next.note}</div>}
              <div className="mt-auto flex flex-wrap gap-2.5">
                <div className={STAT}>
                  <div className="text-[11px] text-white/55">{tt("budget")}</div>
                  <div className="text-[18px] font-bold">{next.cost != null ? eur(next.cost, 0) : "—"}</div>
                </div>
                {planned.length > 1 && (
                  <div className={STAT}>
                    <div className="text-[11px] text-white/55">{tt("also_planned")}</div>
                    <div className="text-[18px] font-bold">{planned.length - 1}</div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="font-serif text-[36px] font-normal leading-[1.15] tracking-[-0.01em]">{tt("nothing_planned_yet")}</div>
              <button onClick={() => openForm("datenight", undefined, { date: friday })} className="mt-auto h-11 self-start rounded-full border-0 bg-acci px-5 text-sm font-bold text-onacci">
                {tt("plan_friday")}
              </button>
            </>
          )}
        </section>

        <Card className="flex flex-col gap-3">
          <div className="eyebrow">{tt("year_so_far", { year: today.y })}</div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[62px] font-normal tracking-[-0.01em]">{count}</span>
            <span className="text-[15px] font-semibold text-mut2">{target ? tt("of_date_nights", { n: target }) : tt("date_nights_lower")}</span>
          </div>
          {target != null && (
            <div className="h-2 overflow-hidden rounded-full bg-soft2">
              <div className="h-full rounded-full bg-acc" style={{ width: `${Math.min(100, (count / target) * 100)}%` }} />
            </div>
          )}
          <div className="text-[13px] text-mut">{tt("dates_pace", { n: count + weeksLeft })}</div>
          <div aria-hidden className="flex gap-1.5">
            {weeks.map((n, i) => (
              <span key={i} className="h-7 flex-1 rounded-lg" style={{ background: i === 11 && !n ? "var(--tint2)" : n ? "var(--acc)" : "var(--soft2)" }} />
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-1.5 flex items-center justify-between gap-2.5">
          <H2>{tt("date_log")}</H2>
          <AddButton onClick={() => openForm("datenight")} label={tt("log_date")} />
        </div>
        {past.map((d) => (
          <button key={d.id} onClick={() => openForm("datenight", d.id)} className="flex w-full items-center gap-3 rounded-lg border-0 border-b border-line bg-transparent px-1 py-[11px] text-left hover:bg-soft">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-soft text-ink">
              <AppIcon name={d.icon} size={18} strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-ink">{d.name}</span>
              <span className="block text-xs text-mut2">
                {dates.day(d.date)}
                {d.cost != null && ` · ${eur(d.cost)}`}
              </span>
            </span>
            {d.rating ? (
              <span className="flex gap-0.5 text-ink" aria-label={tt("rating_of", { n: d.rating })}>
                {Array.from({ length: d.rating }, (_, i) => (
                  <Star key={i} size={13} fill="currentColor" strokeWidth={0} />
                ))}
              </span>
            ) : (
              <span className="text-xs font-bold text-acct">{tt("rate")}</span>
            )}
          </button>
        ))}
        {!past.length && <div className="py-3 text-[13px] text-mut">{tt("log_empty")}</div>}
      </Card>

      <Card>
        <H2 className="mb-1">{tt("date_ideas")}</H2>
        <div className="mb-3 flex items-center justify-between gap-2.5">
          <p className="m-0 text-[13px] text-mut">{tt("tap_idea")}</p>
          <AddButton onClick={() => openForm("idea")} />
        </div>
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          {time.dateIdeas.map((i) => (
            <div key={i.id} className="flex min-h-16 items-center rounded-[10px] border-2 border-line bg-card">
              <button
                onClick={() => openForm("datenight", undefined, { name: i.name, cost: i.cost == null ? "" : String(i.cost), icon: i.icon, date: friday, idea_id: i.id })}
                className="flex min-w-0 flex-1 items-center gap-3 border-0 bg-transparent py-3.5 pl-3.5 text-left"
              >
                <span className="flex-none text-ink">
                  <AppIcon name={i.icon} size={23} strokeWidth={1.7} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">{i.name}</span>
                  {i.short && <span className="block text-xs text-mut">{i.short}</span>}
                </span>
                {i.cost != null && <span className="whitespace-nowrap text-[13px] font-bold text-ink">{eur(i.cost, 0)}</span>}
              </button>
              <button onClick={() => openForm("idea", i.id)} aria-label={tt("edit_idea_name", { name: i.name })} className="flex h-11 w-11 flex-none items-center justify-center border-0 bg-transparent text-mut">
                <Pencil size={15} />
              </button>
            </div>
          ))}
        </div>
        {!time.dateIdeas.length && <div className="py-3 text-[13px] text-mut">{tt("ideas_empty")}</div>}
      </Card>
    </>
  );
}
