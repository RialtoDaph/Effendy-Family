"use client";

import { useAppData } from "@/components/app-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useTime } from "@/components/time-data";
import { AddButton, Card, EmptyNote, OwnerPill, PrivateMark, ProgressBar } from "@/components/ui";
import { AppIcon } from "@/lib/icons";
import { GOAL_STATUS_LABEL, goalStatus, goalTip, weekStrip, type GoalStatus, type YearlyGoal } from "@/lib/time";
import { ModuleTabs } from "./module-tabs";
import { PageHeader } from "./page-header";

const STATUS_STYLE: Record<GoalStatus, string> = {
  ahead: "bg-okbg text-ok",
  ontrack: "bg-soft2 text-mut",
  behind: "bg-warnbg text-warnt",
  done: "bg-okbg text-ok",
};

const n = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-GB");

export function YearlyGoalsScreen() {
  const { today } = useMoney();
  const time = useTime();
  const { openForm } = useMoneyForms();
  const goals = time.yearlyGoals.filter((g) => g.year === today.y);

  return (
    <>
      <div className="flex flex-col gap-3">
        <PageHeader eyebrow="Time & goals" title={`Yearly goals ${today.y}`} />
        <ModuleTabs module="time" active="ygoals" />
      </div>
      <div className="flex justify-end">
        <AddButton onClick={() => openForm("ygoal")} label="+ Add goal" />
      </div>
      {!goals.length && (
        <EmptyNote>
          Set a few goals for this year, e.g. “30 ECTS”, “8 new clients”, “500 orders” or “45 date nights”. Each gets a 52-week strip and
          tells you if you are ahead or behind.
        </EmptyNote>
      )}
      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))]">
        {goals.map((g) => (
          <GoalCard key={g.id} g={g} />
        ))}
      </div>
    </>
  );
}

function GoalCard({ g }: { g: YearlyGoal }) {
  const { today } = useMoney();
  const { members } = useAppData();
  const time = useTime();
  const { openForm } = useMoneyForms();
  const { status, pct } = goalStatus(g, today.iso);
  const strip = weekStrip(
    time.goalProgress.filter((p) => p.goal_id === g.id),
    g,
    today.iso,
  );

  return (
    <Card className={`flex flex-col gap-3 ${g.visibility === "private" ? "border-dashed" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-soft text-ink">
          <AppIcon name={g.icon} size={21} strokeWidth={1.7} />
        </span>
        <button onClick={() => openForm("ygoal", g.id)} className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left">
          <div className="text-[15.5px] font-extrabold leading-snug text-ink">{g.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <OwnerPill member={members.find((m) => m.id === g.who)} fallback="Together" />
            {g.visibility === "private" && <PrivateMark />}
          </div>
        </button>
        <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-extrabold ${STATUS_STYLE[status]}`}>{GOAL_STATUS_LABEL[status]}</span>
      </div>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[22px] font-black tracking-[-0.02em]">
            {n(g.done)} <span className="text-[14px] font-bold text-mut">/ {n(g.target)} {g.unit}</span>
          </span>
          <span className="font-mono text-[13px] font-bold text-mut">{pct}%</span>
        </div>
        <ProgressBar pct={pct} color={status === "behind" ? "var(--warn)" : "var(--ink)"} />
      </div>
      <div aria-label="52 weeks of progress" className="grid grid-cols-[repeat(26,1fr)] gap-[3px]">
        {strip.map((w, i) => (
          <span
            key={i}
            title={`Week ${i + 1}`}
            className={`aspect-square rounded-[2px] ${w.now ? "ring-2 ring-acc ring-offset-1 ring-offset-card" : ""}`}
            style={{
              background: w.future ? "transparent" : w.level === 2 ? "var(--ink)" : w.level === 1 ? "var(--line2)" : "var(--soft2)",
              border: w.future ? "1px solid var(--line)" : undefined,
            }}
          />
        ))}
      </div>
      {g.step && (
        <div className="text-[13px]">
          <span className="font-bold text-mut">This week: </span>
          <span className="font-bold">{g.step}</span>
        </div>
      )}
      <div className="text-[13px] leading-normal text-mut">{goalTip(g, today.iso)}</div>
      <button
        onClick={() => openForm("progress", undefined, { goal_id: g.id })}
        className="min-h-11 rounded-full border-0 bg-tint text-[13px] font-extrabold text-acct"
      >
        + Add progress
      </button>
    </Card>
  );
}
