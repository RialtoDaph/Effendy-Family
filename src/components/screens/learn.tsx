"use client";

import { useTranslations } from "next-intl";
import { useAppData } from "@/components/app-data";
import { ModuleEmpty } from "@/components/empty-state";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useLabel } from "@/components/nav-label";
import { avatarColors } from "@/components/shell/avatar";
import { useTime } from "@/components/time-data";
import { useToast } from "@/components/toast";
import { AddButton, Card, H2, PrivateMark } from "@/components/ui";
import { QUEUED } from "@/lib/offline-queue";
import { weekStart, weekTotals } from "@/lib/time";
import { ModuleHeader } from "./module-tabs";

/** Eight weeks as bars: this week in the accent, weeks that met the goal dark. */
export function WeekBars({ totals, goal }: { totals: number[]; goal: number }) {
  const top = Math.max(...totals, goal, 1);
  return (
    <div aria-hidden className="flex h-14 items-end gap-1.5">
      {totals.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded"
          style={{ height: `${Math.max(4, Math.round((v / top) * 100))}%`, background: i === totals.length - 1 ? "var(--acc)" : v >= goal ? "var(--inv)" : "var(--line2)" }}
        />
      ))}
    </div>
  );
}

export function LearningScreen() {
  const tt = useTranslations("time");
  const tm = useTranslations("money");
  const label = useLabel();
  const { today } = useMoney();
  const { members, settings, userId } = useAppData();
  const time = useTime();
  const { openForm } = useMoneyForms();
  const toast = useToast();
  const monday = weekStart(today.iso);
  const goal = settings?.learn_week_min ?? 180;
  const tracks = [...new Set(time.learningItems.map((i) => i.track))].sort();

  async function logQuick() {
    const err = await time.save("learning_minutes", { minutes: 25, date: today.iso, visibility: settings?.default_visibility?.learning ?? "family" });
    if (err && err !== QUEUED) return toast(err);
    toast(err === QUEUED ? tm("queued") : tt("minutes_logged", { n: 25 }));
  }

  if (time.loaded && !time.learningItems.length && !time.learningMinutes.length) {
    return (
      <>
        <ModuleHeader module="time" active="learn" />
        <ModuleEmpty screen="learn" eyebrow={label("nav.learning")} onAction={() => openForm("litem")} />
      </>
    );
  }

  return (
    <>
      <ModuleHeader module="time" active="learn" />

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        {members.map((m) => {
          const totals = weekTotals(
            time.learningMinutes.filter((r) => r.owner_id === m.id),
            monday,
            8,
            (r) => r.minutes,
          );
          const min = totals[7];
          const c = avatarColors(m);
          return (
            <Card key={m.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full font-bold" style={{ background: c.bg, color: c.fg }}>
                  {m.display_name[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold">{m.display_name}</div>
                  <div className="text-xs text-mut2">{tt("goal_min_week", { n: goal })}</div>
                </div>
                <span className="text-[26px] font-bold tabular-nums">
                  {min}
                  <span className="text-[13px] font-bold text-mut2"> {tt("min")}</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-soft2">
                <div className="h-full rounded-full bg-acc" style={{ width: `${Math.min(100, (min / Math.max(1, goal)) * 100)}%` }} />
              </div>
              <WeekBars totals={totals} goal={goal} />
              <div className="text-[11px] text-mut2">{tt("last_8_weeks")}</div>
              {m.id === userId && (
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={logQuick} className="min-h-11 flex-1 whitespace-nowrap rounded-full border border-line bg-card px-3 text-[13px] font-bold hover:bg-soft">
                    {tt("log_25")}
                  </button>
                  <button onClick={() => openForm("lmin")} className="min-h-11 whitespace-nowrap rounded-full border border-line bg-card px-4 text-[13px] font-bold hover:bg-soft">
                    {tt("log_other")}
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="flex">
        <AddButton onClick={() => openForm("litem")} label={tt("add_to_learn")} />
      </div>
      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))]">
        {tracks.map((track) => (
          <Card key={track}>
            <div className="mb-1.5 flex items-center justify-between gap-2.5">
              <H2>{track}</H2>
              <button onClick={() => openForm("litem", undefined, { track })} className="min-h-10 whitespace-nowrap rounded-full border-0 bg-tint px-3 text-[12.5px] font-bold text-acct">
                {tm("add")}
              </button>
            </div>
            {time.learningItems
              .filter((i) => i.track === track)
              .sort((a, b) => a.pct - b.pct)
              .map((i) => (
                <button
                  key={i.id}
                  onClick={() => openForm("litem", i.id)}
                  className={`block w-full border-0 border-b border-line bg-transparent py-3 text-left ${i.visibility === "private" ? "border-dashed" : ""}`}
                >
                  <span className="flex items-baseline justify-between gap-2.5">
                    <span className="text-sm font-bold text-ink">{i.title}</span>
                    <span className="text-[13px] font-bold tabular-nums text-acc">{i.pct}%</span>
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-mut2">
                    <span>
                      {[tt(`type_${i.type}`), members.find((m) => m.id === i.who)?.display_name ?? tt("together"), i.pct >= 100 ? tt("finished") : i.next ? tt("next_step", { next: i.next }) : tt("just_started")].join(" · ")}
                    </span>
                    {i.visibility === "private" && <PrivateMark />}
                  </span>
                  <span className="mt-2 block h-[5px] overflow-hidden rounded-full bg-soft2">
                    <span className="block h-full rounded-full bg-acc" style={{ width: `${Math.min(100, i.pct)}%` }} />
                  </span>
                </button>
              ))}
          </Card>
        ))}
      </div>
    </>
  );
}
