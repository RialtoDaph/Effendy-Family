"use client";

import { useAppData } from "@/components/app-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { avatarColors } from "@/components/shell/avatar";
import { useTime } from "@/components/time-data";
import { AddButton, Card, EmptyNote, H2, OwnerPill, PrivateMark, ProgressBar } from "@/components/ui";
import { minutesThisWeek, weekStart } from "@/lib/time";
import { ModuleTabs } from "./module-tabs";
import { PageHeader } from "./page-header";

const hours = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ""}`.trim() : `${min} min`);

export function LearningScreen() {
  const { today } = useMoney();
  const { members, settings } = useAppData();
  const time = useTime();
  const { openForm } = useMoneyForms();
  const week = minutesThisWeek(time.learningMinutes, weekStart(today.iso));
  const goal = settings?.learn_week_min ?? 180;
  const tracks = [...new Set(time.learningItems.map((i) => i.track))].sort();

  return (
    <>
      <div className="flex flex-col gap-3">
        <PageHeader eyebrow="Time & goals" title="Learning" />
        <ModuleTabs module="time" active="learn" />
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <H2>This week</H2>
          <AddButton onClick={() => openForm("lmin")} label="+ Log time" />
        </div>
        {members.map((m) => {
          const min = week.get(m.id) ?? 0;
          return (
            <div key={m.id}>
              <div className="mb-1.5 flex items-baseline justify-between text-[13.5px]">
                <span className="font-bold">{m.display_name}</span>
                <span className="font-mono text-mut">
                  {hours(min)} / {hours(goal)}
                </span>
              </div>
              <ProgressBar pct={(min / Math.max(1, goal)) * 100} color={avatarColors(m).bg} height={10} />
            </div>
          );
        })}
        <div className="text-xs text-mut2">Weekly goal per person: {hours(goal)}.</div>
      </Card>

      <div className="flex items-baseline justify-between">
        <H2>Books & courses</H2>
        <AddButton onClick={() => openForm("litem")} />
      </div>
      {!time.learningItems.length && <EmptyNote>Add the books and courses you are working on, grouped by topic.</EmptyNote>}
      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))]">
        {tracks.map((t) => (
          <Card key={t} className="flex flex-col gap-1">
            <div className="mb-1 text-[15px] font-extrabold">{t}</div>
            {time.learningItems
              .filter((i) => i.track === t)
              .sort((a, b) => a.pct - b.pct)
              .map((i) => (
                <button
                  key={i.id}
                  onClick={() => openForm("litem", i.id)}
                  className={`flex w-full flex-col gap-1.5 border-0 border-t border-line bg-transparent py-3 text-left ${i.visibility === "private" ? "border-dashed" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className={`text-[14px] font-bold ${i.pct >= 100 ? "text-mut2 line-through" : "text-ink"}`}>{i.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-mut2">
                        <span className="capitalize">{i.type}</span>
                        <OwnerPill member={members.find((m) => m.id === i.who)} fallback="Together" />
                        {i.next && <span>· {i.pct >= 100 ? "finished" : `next: ${i.next}`}</span>}
                        {i.visibility === "private" && <PrivateMark />}
                      </div>
                    </div>
                    <span className="font-mono text-[13px] font-bold">{i.pct}%</span>
                  </div>
                  <ProgressBar pct={i.pct} color="var(--ink)" />
                </button>
              ))}
          </Card>
        ))}
      </div>
    </>
  );
}
