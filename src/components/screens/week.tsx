"use client";

import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { useAppData, type Member } from "@/components/app-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { avatarColors } from "@/components/shell/avatar";
import { useTime } from "@/components/time-data";
import { useToast } from "@/components/toast";
import { AddButton, Card, EmptyNote, H2, OwnerPill, PrivateMark } from "@/components/ui";
import { addDays, dayEvents, dowShort, timeRange, weekDays, weekLabel, weekStart, type CalEvent } from "@/lib/time";
import { ModuleTabs } from "./module-tabs";
import { PageHeader } from "./page-header";

/** Colour of an item on the board: the person's colour, or the accent for Together. */
export function whoColors(members: Member[], who: string | null) {
  const m = members.find((x) => x.id === who);
  return m ? avatarColors(m) : { bg: "var(--acc)", fg: "var(--onacc)" };
}

export function WeekScreen() {
  const { today } = useMoney();
  const { members } = useAppData();
  const time = useTime();
  const { openForm } = useMoneyForms();
  const toast = useToast();
  const [monday, setMonday] = useState<string | null>(null);
  const week = monday ?? weekStart(today.iso);
  const days = weekDays(week);
  const isThisWeek = week === weekStart(today.iso);

  const priorities = time.priorities.filter((p) => p.week_start === week).sort((a, b) => a.sort - b.sort);

  async function toggle(id: string, done: boolean) {
    const err = await time.save("week_priorities", { done }, id);
    if (err && err !== "queued") toast(err);
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <PageHeader eyebrow="Time & goals" title="This week" />
        <ModuleTabs module="time" active="week" />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setMonday(addDays(week, -7))} aria-label="Previous week" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-ink">
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-[15px] font-extrabold">{weekLabel(week)}</div>
          <div className="text-xs text-mut2">{isThisWeek ? "This week" : week < weekStart(today.iso) ? "Past week" : "Coming week"}</div>
        </div>
        <button onClick={() => setMonday(addDays(week, 7))} aria-label="Next week" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-ink">
          <ChevronRight size={18} />
        </button>
      </div>

      <Card className="flex flex-col gap-1">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <H2>3 priorities</H2>
          {priorities.length < 3 && (
            <AddButton onClick={() => openForm("prio", undefined, { week_start: week, sort: String(priorities.length) })} />
          )}
        </div>
        {priorities.map((p) => (
          <div key={p.id} className="flex items-center gap-3 border-t border-line py-2.5">
            <button
              onClick={() => toggle(p.id, !p.done)}
              aria-label={p.done ? `Mark “${p.title}” as not done` : `Mark “${p.title}” as done`}
              aria-pressed={p.done}
              className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 ${p.done ? "border-ink bg-ink text-white" : "border-line2 bg-card"}`}
            >
              {p.done && <Check size={15} strokeWidth={3} />}
            </button>
            <button onClick={() => openForm("prio", p.id)} className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left">
              <div className={`text-[14.5px] font-bold ${p.done ? "text-mut2 line-through" : "text-ink"}`}>{p.title}</div>
            </button>
            <OwnerPill member={members.find((m) => m.id === p.who)} fallback="Together" />
          </div>
        ))}
        {!priorities.length && <EmptyNote>What are the three things that matter most this week? Tap + Add.</EmptyNote>}
      </Card>

      <Card className="flex flex-col gap-2">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <H2>The week</H2>
          <div className="flex flex-wrap items-center gap-1.5">
            {members.map((m) => (
              <OwnerPill key={m.id} member={m} />
            ))}
            <OwnerPill member={undefined} fallback="Together" />
          </div>
        </div>
        <div className="grid gap-2 wide:grid-cols-7">
          {days.map((d) => {
            const list = dayEvents(time.events, d);
            const isToday = d === today.iso;
            return (
              <div key={d} className={`flex flex-col gap-1.5 rounded-[10px] p-2.5 ${isToday ? "bg-tint" : "bg-soft"}`}>
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-extrabold">
                    {dowShort(d)} <span className="font-mono text-mut">{Number(d.slice(8))}</span>
                    {isToday && <span className="ml-1.5 text-[11px] font-bold text-acct">today</span>}
                  </div>
                  <button
                    onClick={() => openForm("event", undefined, { date: d })}
                    aria-label={`Add to ${dowShort(d)} ${Number(d.slice(8))}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full border-0 bg-card text-mut"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {list.map((e) => (
                  <BoardItem key={e.id} e={e} members={members} onOpen={() => openForm(e.kind === "shift" ? "shift" : "event", e.id)} />
                ))}
                {!list.length && <div className="px-1 pb-1 text-xs text-mut2">Free</div>}
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

function BoardItem({ e, members, onOpen }: { e: CalEvent; members: Member[]; onOpen: () => void }) {
  const c = whoColors(members, e.kind === "shift" ? e.owner_id : e.who);
  return (
    <button
      onClick={onOpen}
      className={`flex w-full items-start gap-2 rounded-lg border-0 bg-card px-2.5 py-2 text-left ${e.visibility === "private" ? "outline-dashed outline-1 outline-line2" : ""}`}
      style={{ borderLeft: `4px solid ${c.bg}` }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold leading-snug text-ink">{e.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-mut">
          <span>{timeRange(e)}</span>
          {e.remind_min != null && <span>· reminder</span>}
          {e.visibility === "private" && <PrivateMark />}
        </div>
      </div>
    </button>
  );
}
