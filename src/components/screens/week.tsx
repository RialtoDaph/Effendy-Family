"use client";

import { Check, ChevronLeft, ChevronRight, Landmark, Plus, Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import { useFinance } from "@/components/finance-data";
import { useAppData, type Member } from "@/components/app-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useTime } from "@/components/time-data";
import { useToast } from "@/components/toast";
import { AddButton, Card, EmptyNote, H2, OwnerPill, PrivateMark, Segmented } from "@/components/ui";
import { eurSigned } from "@/lib/money";
import {
  addDays,
  addMonths,
  dayEvents,
  dayLabel,
  dowShort,
  monthGrid,
  monthLabel,
  timeRange,
  weekDays,
  weekLabel,
  weekStart,
  type CalEvent,
} from "@/lib/time";
import { ModuleTabs } from "./module-tabs";
import { PageHeader } from "./page-header";

/** Calendar colour: first person blue, second orange, Together green (same in every theme palette). */
export function whoColors(members: Member[], who: string | null) {
  const i = [...members].sort((a, b) => a.sort - b.sort).findIndex((x) => x.id === who);
  return { bg: i === 0 ? "var(--who-1)" : i === 1 ? "var(--who-2)" : "var(--who-t)", fg: "#ffffff" };
}

export function WhoLegend({ members }: { members: Member[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold text-mut">
      {[...members.map((m) => ({ key: m.id, label: m.display_name, color: whoColors(members, m.id).bg })), { key: "t", label: "Together", color: "var(--who-t)" }].map((l) => (
        <span key={l.key} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
          {l.label}
        </span>
      ))}
    </div>
  );
}

const VIEW_KEY = "ef-cal-view";

export function WeekScreen() {
  const [view, setView] = useState<"week" | "month">("week");

  // Remember Week / Month on this phone.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(VIEW_KEY) === "month") setView("month");
    } catch {}
  }, []);
  function pick(v: "week" | "month") {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <PageHeader eyebrow="Time & goals" title={view === "week" ? "This week" : "This month"} />
        <ModuleTabs module="time" active="week" />
      </div>
      <div className="flex justify-center">
        <Segmented
          options={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
          value={view}
          onChange={pick}
        />
      </div>
      {view === "week" ? <WeekView /> : <MonthView />}
    </>
  );
}

function WeekView() {
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
          <WhoLegend members={members} />
        </div>
        {/* Days at least 200 px wide: 7 in a row on big screens, otherwise two rows (e.g. Mon–Thu, Fri–Sun); one column on phones. */}
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr))]">
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
        <div className="text-[13px] font-bold leading-snug text-ink [overflow-wrap:break-word]">
          {e.title}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-mut">
          <span>{timeRange(e)}</span>
          {e.remind_min != null && <span>· reminder</span>}
          {e.visibility === "private" && <PrivateMark />}
        </div>
      </div>
    </button>
  );
}

/* Month: dots per day, tap a day to see it below ------------------------------- */

type DayMark = { kind: "bill" | "income" | "tax"; label: string; amount: number | null; id: string };

function MonthView() {
  const { today, recurring } = useMoney();
  const { taxDeadlines } = useFinance();
  const { members } = useAppData();
  const time = useTime();
  const { openForm } = useMoneyForms();
  const [month, setMonth] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const ym = month ?? today.ym;
  const days = monthGrid(ym);
  const selected = picked && picked.startsWith(ym) ? picked : today.ym === ym ? today.iso : `${ym}-01`;

  // Money dates: recurring payments on their day of this month, and open tax deadlines.
  const marks = (d: string): DayMark[] => {
    if (!d.startsWith(ym)) return [];
    const day = Number(d.slice(8));
    const out: DayMark[] = recurring
      .filter((r) => r.active && r.day_of_month === day)
      .map((r) => ({ kind: r.amount < 0 ? ("bill" as const) : ("income" as const), label: r.name, amount: r.amount, id: r.id }));
    for (const t of taxDeadlines) if (!t.done && t.due_date === d) out.push({ kind: "tax", label: t.title, amount: t.amount ? -t.amount : null, id: t.id });
    return out;
  };

  const legend = [
    ...members.map((m) => ({ label: m.display_name, color: whoColors(members, m.id).bg, square: false })),
    { label: "Together", color: "var(--who-t)", square: false },
    { label: "Shift (square)", color: "var(--mut)", square: true },
  ];

  const list = dayEvents(time.events, selected);
  const money = marks(selected);

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMonth(addMonths(ym, -1))}
          aria-label="Previous month"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-ink"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-[15px] font-extrabold">{monthLabel(ym)}</div>
          <div className="text-xs text-mut2">{ym === today.ym ? "This month" : ym < today.ym ? "Past month" : "Coming month"}</div>
        </div>
        <button
          onClick={() => setMonth(addMonths(ym, 1))}
          aria-label="Next month"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-ink"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <Card className="flex flex-col gap-2 px-2.5 py-3 wide:p-4">
        <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11px] font-bold text-mut2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const inMonth = d.startsWith(ym);
            const evs = inMonth ? dayEvents(time.events, d) : [];
            const mk = marks(d);
            const isToday = d === today.iso;
            const isSel = d === selected;
            return (
              <button
                key={d}
                onClick={() => setPicked(d)}
                aria-label={`${dayLabel(d)}: ${evs.length} plans${mk.length ? `, ${mk.length} money dates` : ""}`}
                aria-pressed={isSel}
                className={`flex min-h-[56px] flex-col items-stretch gap-1 rounded-[9px] border-0 p-1 text-left wide:min-h-[96px] wide:p-1.5 ${
                  isSel ? "bg-inv text-white" : isToday ? "bg-tint text-ink" : inMonth ? "bg-soft text-ink" : "bg-transparent text-mut2"
                }`}
              >
                <span className={`text-center text-[13px] font-extrabold wide:text-left ${inMonth ? "" : "opacity-50"}`}>{Number(d.slice(8))}</span>
                {/* Phone: dots. Wide screens: the first two titles. */}
                <span className="flex flex-wrap justify-center gap-[3px] wide:hidden">
                  {evs.slice(0, 4).map((e) => (
                    <span
                      key={e.id}
                      className={`h-[7px] w-[7px] ${e.kind === "shift" ? "rounded-[2px]" : "rounded-full"}`}
                      style={{ background: whoColors(members, e.kind === "shift" ? e.owner_id : e.who).bg }}
                    />
                  ))}
                  {mk.length > 0 && <span className={`text-[9px] font-black leading-[7px] ${isSel ? "text-white" : "text-mut"}`}>€</span>}
                </span>
                <span className="hidden flex-col gap-0.5 wide:flex">
                  {evs.slice(0, 2).map((e) => (
                    <span
                      key={e.id}
                      className={`truncate rounded-[4px] px-1 py-[1px] text-[11px] font-bold ${isSel ? "bg-white/15" : "bg-card"}`}
                      style={{ borderLeft: `3px solid ${whoColors(members, e.kind === "shift" ? e.owner_id : e.who).bg}` }}
                    >
                      {e.start_time ? `${e.start_time.slice(0, 5)} ` : ""}
                      {e.title}
                    </span>
                  ))}
                  {evs.length > 2 && <span className={`text-[10.5px] font-bold ${isSel ? "text-white/70" : "text-mut"}`}>+{evs.length - 2} more</span>}
                  {mk.length > 0 && (
                    <span className={`truncate text-[10.5px] font-bold ${isSel ? "text-white/70" : "text-mut"}`}>
                      € {mk.map((m) => m.label).join(", ")}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1 text-[11.5px] text-mut">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1">
              <span className={`h-2 w-2 ${l.square ? "rounded-[2px]" : "rounded-full"}`} style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span className="text-[10px] font-black">€</span> Bill, income or tax
          </span>
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <H2>{selected === today.iso ? `Today · ${dayLabel(selected)}` : dayLabel(selected)}</H2>
          <AddButton onClick={() => openForm("event", undefined, { date: selected })} />
        </div>
        {list.map((e) => (
          <BoardItem key={e.id} e={e} members={members} onOpen={() => openForm(e.kind === "shift" ? "shift" : "event", e.id)} />
        ))}
        {money.map((m) => (
          <button
            key={m.kind + m.id}
            onClick={() => openForm(m.kind === "tax" ? "deadline" : "recur", m.id)}
            className="flex w-full items-center gap-2.5 rounded-lg border-0 bg-soft px-2.5 py-2 text-left"
          >
            {m.kind === "tax" ? <Landmark size={16} className="flex-none text-mut" /> : <Receipt size={16} className="flex-none text-mut" />}
            <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">
              {m.label}
              <span className="font-medium text-mut"> · {m.kind === "tax" ? "tax deadline" : m.kind === "income" ? "income" : "goes out"}</span>
            </span>
            {m.amount != null && <span className={`font-mono text-[13px] font-bold ${m.amount > 0 ? "text-ok" : "text-ink"}`}>{eurSigned(m.amount)}</span>}
          </button>
        ))}
        {!list.length && !money.length && <EmptyNote>Nothing planned. Tap + Add.</EmptyNote>}
      </Card>
    </>
  );
}
