"use client";

import { useAppData } from "@/components/app-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { avatarColors } from "@/components/shell/avatar";
import { useTime } from "@/components/time-data";
import { AddButton, Card, EmptyNote, H2, OwnerPill } from "@/components/ui";
import { AppIcon } from "@/lib/icons";
import { dayLabel, hm, sessionsThisWeek, weekStart } from "@/lib/time";
import { ModuleTabs } from "./module-tabs";
import { PageHeader } from "./page-header";

export function GymScreen() {
  const { today } = useMoney();
  const { members, settings } = useAppData();
  const time = useTime();
  const { openForm } = useMoneyForms();
  const week = sessionsThisWeek(time.gym, weekStart(today.iso));
  const goal = settings?.gym_week_goal ?? 3;

  return (
    <>
      <div className="flex flex-col gap-3">
        <PageHeader eyebrow="Life" title="Gym" />
        <ModuleTabs module="life" active="gym" />
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
        {members.map((m) => {
          const n = week.get(m.id) ?? 0;
          const c = avatarColors(m);
          return (
            <Card key={m.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-extrabold">{m.display_name}</span>
                <span className="font-mono text-xs text-mut">this week</span>
              </div>
              <div className="text-[40px] font-black leading-none tracking-[-0.03em]">
                {n}
                <span className="text-[18px] font-bold text-mut"> / {goal}</span>
              </div>
              <div className="flex gap-1.5" aria-hidden>
                {Array.from({ length: Math.max(goal, n) }, (_, i) => (
                  <span key={i} className="h-2.5 flex-1 rounded-full" style={{ background: i < n ? c.bg : "var(--soft2)" }} />
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="flex flex-col gap-1">
        <div className="mb-1 flex items-baseline justify-between">
          <H2>Sessions</H2>
          <AddButton onClick={() => openForm("gym")} label="+ Log session" />
        </div>
        {time.gym.slice(0, 40).map((s) => (
          <button key={s.id} onClick={() => openForm("gym", s.id)} className="flex w-full items-center gap-3 border-0 border-t border-line bg-transparent py-3 text-left">
            <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl bg-soft text-ink">
              <AppIcon name={s.icon} size={19} strokeWidth={1.7} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{s.type}</div>
              <div className="text-xs text-mut2">
                {s.date === today.iso ? "Today" : dayLabel(s.date)}
                {s.time && ` · ${hm(s.time)}`}
              </div>
            </div>
            <OwnerPill member={members.find((m) => m.id === s.owner_id)} />
          </button>
        ))}
        {!time.gym.length && <EmptyNote>No sessions yet. Tap + Log session after your workout.</EmptyNote>}
      </Card>
    </>
  );
}
