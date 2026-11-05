"use client";

import { useTranslations } from "next-intl";
import { useAppData } from "@/components/app-data";
import { ModuleEmpty } from "@/components/empty-state";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useLabel } from "@/components/nav-label";
import { useTime } from "@/components/time-data";
import { AddButton, Card, OwnerPill, PrivateMark } from "@/components/ui";
import { AppIcon } from "@/lib/icons";
import { addDays, goalStatus, goalTip, weekOfYear, weekStart, weekStrip, type GoalStatus, type YearlyGoal } from "@/lib/time";
import { useDates } from "@/lib/use-dates";
import { ModuleHeader } from "./module-tabs";

const STATUS_STYLE: Record<GoalStatus, string> = {
  ahead: "bg-okbg text-ok",
  ontrack: "bg-soft2 text-ink",
  behind: "bg-badbg text-bad",
  done: "bg-okbg text-ok",
};

export function YearlyGoalsScreen() {
  const tt = useTranslations("time");
  const label = useLabel();
  const { today } = useMoney();
  const time = useTime();
  const { openForm } = useMoneyForms();
  const goals = time.yearlyGoals.filter((g) => g.year === today.y);
  const week = Math.min(52, weekOfYear(today.iso));
  const gone = Math.round((week / 52) * 100);
  const behind = goals.filter((g) => goalStatus(g, today.iso).status === "behind").length;

  if (time.loaded && !goals.length) {
    return (
      <>
        <ModuleHeader module="time" active="ygoals" />
        <ModuleEmpty screen="ygoals" eyebrow={label("nav.yearly_goals")} onAction={() => openForm("ygoal")} />
      </>
    );
  }

  return (
    <>
      <ModuleHeader module="time" active="ygoals" />
      <Card className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <div className="eyebrow">{tt("year_week", { year: today.y, n: week })}</div>
          <div className="mt-1 font-serif text-[34px] font-normal tracking-[-0.01em]">{tt("goals_summary", { ok: goals.length - behind, behind })}</div>
          <div className="mt-2.5">
            <AddButton onClick={() => openForm("ygoal")} />
          </div>
        </div>
        <div className="min-w-[200px] max-w-[420px] flex-1">
          <div className="h-2.5 overflow-hidden rounded-full bg-soft2">
            <div className="h-full rounded-full bg-acc" style={{ width: `${gone}%` }} />
          </div>
          <div className="mt-1.5 text-xs text-mut">{tt("year_gone", { pct: gone, n: 52 - week })}</div>
        </div>
      </Card>
      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
        {goals.map((g) => (
          <GoalCard key={g.id} g={g} pace={gone} />
        ))}
      </div>
      <p className="m-0 text-[12.5px] text-mut2">{tt("squares_note")}</p>
    </>
  );
}

function GoalCard({ g, pace }: { g: YearlyGoal; pace: number }) {
  const tt = useTranslations("time");
  const dates = useDates();
  const { today } = useMoney();
  const { members } = useAppData();
  const time = useTime();
  const { openForm } = useMoneyForms();
  const { status, pct } = goalStatus(g, today.iso);
  const progress = time.goalProgress.filter((p) => p.goal_id === g.id);
  const strip = weekStrip(progress, g, today.iso);
  const monday = weekStart(today.iso);
  const thisWeek = progress.filter((p) => p.date >= monday && p.date < addDays(monday, 7)).reduce((a, p) => a + p.amount, 0);
  const share = Math.max(1, Math.round((g.target / 52) * 10) / 10);
  const tip = goalTip(g, today.iso);
  const tipText = () => {
    switch (tip.key) {
      case "tip_done":
        return tt("tip_done");
      case "tip_pace":
        return tt("tip_pace", { rate: dates.num(tip.rate), byEnd: dates.num(tip.byEnd), target: dates.num(g.target), unit: g.unit });
      case "tip_ahead":
      case "tip_on_pace":
        return tt(tip.key, { date: dates.short(tip.date) });
      default:
        return tt(tip.key, { rate: dates.num(tip.rate), unit: g.unit });
    }
  };

  return (
    <Card className={`flex flex-col gap-3 ${g.visibility === "private" ? "border-dashed" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[13px] bg-tint text-ink">
          <AppIcon name={g.icon} size={21} strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold leading-[1.3] text-ink">{g.name}</div>
          <div className="mt-[5px] flex flex-wrap items-center gap-1.5">
            <OwnerPill member={members.find((m) => m.id === g.who)} fallback={tt("together")} />
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[status]}`}>{tt(`status_${status}`)}</span>
            {g.visibility === "private" && <PrivateMark />}
          </div>
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-serif text-[44px] font-normal tabular-nums tracking-[-0.01em]">{dates.num(g.done)}</span>
        <span className="whitespace-nowrap text-sm font-semibold text-mut2">
          / {dates.num(g.target)} {g.unit}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-soft2">
        <div className="h-full rounded-full bg-acc" style={{ width: `${pct}%` }} />
        <span className="absolute -top-[3px] h-3.5 w-0.5 bg-acc" style={{ left: `${pace}%` }} />
      </div>
      <div role="img" aria-label={tt("weeks_of_progress")} className="flex flex-wrap gap-[3px]">
        {strip.map((w, i) => {
          const bg = w.future || w.now ? "var(--card)" : w.level === 2 ? "var(--ink)" : w.level === 1 ? "var(--tint2)" : "var(--soft2)";
          return <span key={i} className="h-[9px] w-[9px] rounded-[2px] border" style={{ background: bg, borderColor: w.now ? "var(--acc)" : w.future ? "var(--line)" : bg }} />;
        })}
      </div>
      <div className="rounded-[10px] bg-soft px-3.5 py-3">
        <div className="flex justify-between gap-2">
          <span className="text-[12.5px] text-mut">{g.step ? tt("this_week_step", { step: g.step }) : tt("this_week")}</span>
          <span className="whitespace-nowrap text-[13px] font-bold tabular-nums">
            {dates.num(thisWeek)} / {dates.num(share)}
          </span>
        </div>
        <div className="mt-1.5 text-[12.5px] font-bold text-ink">{tipText()}</div>
        <div className="mt-1 flex flex-wrap gap-x-4">
          <button onClick={() => openForm("progress", undefined, { goal_id: g.id })} className="min-h-10 border-0 bg-transparent p-0 text-[12.5px] font-bold text-acc">
            {tt("add_progress")}
          </button>
          <button onClick={() => openForm("ygoal", g.id)} className="min-h-10 border-0 bg-transparent p-0 text-[12.5px] font-bold text-acc">
            {tt("edit_goal")}
          </button>
        </div>
      </div>
    </Card>
  );
}
