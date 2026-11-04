"use client";

import { Check, ChevronLeft, ChevronRight, Landmark, Plus, Receipt } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useFinance } from "@/components/finance-data";
import { useAppData, type Member } from "@/components/app-data";
import { ScreenEmpty } from "@/components/empty-state";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useLabel } from "@/components/nav-label";
import { useTime } from "@/components/time-data";
import { useToast } from "@/components/toast";
import { AddButton, Card, EmptyNote, H2, OwnerPill, PrivateMark, Segmented } from "@/components/ui";
import { eurSigned } from "@/lib/money";
import { QUEUED } from "@/lib/offline-queue";
import {
  addDays,
  addMonths,
  dayEvents,
  freeEvenings,
  minutesThisWeek,
  monthGrid,
  shiftHours,
  timeRange,
  weekDays,
  weekOfYear,
  weekStart,
  type CalEvent,
} from "@/lib/time";
import { useDates } from "@/lib/use-dates";
import { ModuleHeader } from "./module-tabs";

/** Calendar colour: first person blue, second orange, Together green (same in every theme palette). */
export function whoColors(members: Member[], who: string | null) {
  const i = [...members].sort((a, b) => a.sort - b.sort).findIndex((x) => x.id === who);
  return { bg: i === 0 ? "var(--who-1)" : i === 1 ? "var(--who-2)" : "var(--who-t)", fg: "#ffffff" };
}

export function WhoLegend({ members }: { members: Member[] }) {
  const tt = useTranslations("time");
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold text-mut">
      {[...members.map((m) => ({ key: m.id, label: m.display_name, color: whoColors(members, m.id).bg })), { key: "t", label: tt("together"), color: "var(--who-t)" }].map((l) => (
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
  const tt = useTranslations("time");
  const t = useTranslations("t");
  const label = useLabel();
  const time = useTime();
  const { openForm } = useMoneyForms();
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

  if (time.loaded && !time.events.length && !time.priorities.length) {
    return (
      <>
        <ModuleHeader module="time" active="week" />
        <ScreenEmpty eyebrow={label("nav.this_week")} title={t("e_week")} action={t("b_event")} onAction={() => openForm("event")} />
      </>
    );
  }

  return (
    <>
      <ModuleHeader module="time" active="week" />
      <div className="flex justify-center">
        <Segmented
          options={[
            { value: "week", label: tt("week") },
            { value: "month", label: tt("month") },
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
  const tt = useTranslations("time");
  const dates = useDates();
  const { today } = useMoney();
  const { members, userId, settings } = useAppData();
  const time = useTime();
  const { openForm } = useMoneyForms();
  const toast = useToast();
  const [monday, setMonday] = useState<string | null>(null);
  const week = monday ?? weekStart(today.iso);
  const days = weekDays(week);
  const isThisWeek = week === weekStart(today.iso);
  const range = dates.weekRange(days[0], days[6]);

  const priorities = time.priorities.filter((p) => p.week_start === week).sort((a, b) => a.sort - b.sort);

  const shifts = time.events.filter((e) => e.kind === "shift" && days.includes(e.date));
  const shiftH = shifts.reduce((h, e) => h + shiftHours(e.start_time, e.end_time), 0);
  const studied = (minutesThisWeek(time.learningMinutes, week).get(userId) ?? 0) / 60;
  const studyGoal = (settings?.learn_week_min ?? 180) / 60;
  const free = freeEvenings(
    time.events,
    members.map((m) => m.id),
    days.filter((d) => d >= today.iso),
  );
  const shared = members.length > 1;

  async function toggle(id: string, done: boolean) {
    const err = await time.save("week_priorities", { done }, id);
    if (err && err !== QUEUED) toast(err);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={() => setMonday(addDays(week, -7))} aria-label={tt("previous_week")} className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-ink">
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-[15px] font-extrabold">{range}</div>
          <div className="text-xs text-mut2">{isThisWeek ? tt("this_week") : week < weekStart(today.iso) ? tt("past_week") : tt("coming_week")}</div>
        </div>
        <button onClick={() => setMonday(addDays(week, 7))} aria-label={tt("next_week")} className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-ink">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid items-stretch gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
        <Card>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="eyebrow">{tt("week_eyebrow", { n: weekOfYear(week), range })}</div>
              <H2 className="mb-3 mt-1">{tt("three_priorities")}</H2>
            </div>
            {priorities.length < 3 && <AddButton onClick={() => openForm("prio", undefined, { week_start: week, sort: String(priorities.length) })} />}
          </div>
          <div className="flex flex-col gap-2">
            {priorities.map((p) => (
              <div key={p.id} className="flex items-start gap-3 rounded-[10px] bg-soft p-3">
                <button
                  onClick={() => toggle(p.id, !p.done)}
                  aria-label={p.done ? tt("mark_not_done", { title: p.title }) : tt("mark_done", { title: p.title })}
                  aria-pressed={p.done}
                  className={`mt-px flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[9px] border-2 ${p.done ? "border-acc bg-acc text-onacc" : "border-line2 bg-card"}`}
                >
                  {p.done && <Check size={14} strokeWidth={3} />}
                </button>
                <button onClick={() => openForm("prio", p.id)} className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left">
                  <div className={`text-[14.5px] font-bold ${p.done ? "text-mut2 line-through" : "text-ink"}`}>{p.title}</div>
                </button>
                <OwnerPill member={members.find((m) => m.id === p.who)} fallback={tt("together")} />
              </div>
            ))}
            {!priorities.length && <EmptyNote>{tt("priorities_empty")}</EmptyNote>}
          </div>
        </Card>

        <section className="flex flex-col gap-3.5 rounded-[18px] bg-inv p-6 text-white">
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-acc2">{shared ? tt("free_together") : tt("free_this_week")}</div>
          <div className="font-serif text-[49px] font-normal leading-[1.05] tracking-[-0.01em]">
            {free.length ? tt("free_evening", { day: dates.dowLong(free[0]) }) : tt("no_free_evening")}
          </div>
          <p className="m-0 text-sm leading-[1.55] text-white/75">{tt("free_note", { n: free.length, shared: shared ? "yes" : "no" })}</p>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-[10px] border border-white/10 bg-white/5 px-3.5 py-3">
              <div className="text-[11px] text-white/55">{tt("shifts_this_week")}</div>
              <div className="text-[20px] font-bold leading-[1.2]">{tt("shifts_hours", { n: shifts.length, h: dates.num(shiftH) })}</div>
            </div>
            <div className="rounded-[10px] border border-white/10 bg-white/5 px-3.5 py-3">
              <div className="text-[11px] text-white/55">{tt("study_this_week")}</div>
              <div className="text-[20px] font-bold leading-[1.2]">{tt("study_of", { done: dates.num(studied), goal: dates.num(studyGoal) })}</div>
            </div>
          </div>
          {shared && (
            <Link href="/together" className="flex h-11 items-center self-start rounded-full bg-acci px-5 text-sm font-bold text-onacci hover:text-onacci">
              {tt("plan_the_date")}
            </Link>
          )}
        </section>
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <H2>{tt("the_week")}</H2>
            <AddButton onClick={() => openForm("event", undefined, { date: days.includes(today.iso) ? today.iso : days[0] })} />
          </div>
          <WhoLegend members={members} />
        </div>
        <div className="grid gap-2 overflow-x-auto pb-1 [grid-auto-columns:minmax(140px,1fr)] [grid-auto-flow:column]">
          {days.map((d) => {
            const list = dayEvents(time.events, d);
            const isToday = d === today.iso;
            return (
              <div key={d} className={`flex min-h-[180px] flex-col gap-2 rounded-[10px] border-2 px-2.5 py-3 ${isToday ? "border-acc bg-tint" : "border-transparent bg-soft"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`text-[11px] font-bold uppercase tracking-[0.12em] ${isToday ? "text-acct" : "text-mut2"}`}>{dates.dow(d)}</div>
                    <div className="text-[22px] font-bold tracking-[-0.02em]">{Number(d.slice(8))}</div>
                  </div>
                  <button
                    onClick={() => openForm("event", undefined, { date: d })}
                    aria-label={tt("add_to_day", { day: dates.day(d) })}
                    className="flex h-9 w-9 items-center justify-center rounded-full border-0 bg-card text-mut"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {list.map((e) => (
                  <BoardItem key={e.id} e={e} members={members} onOpen={() => openForm(e.kind === "shift" ? "shift" : "event", e.id)} />
                ))}
                {!list.length && <div className="px-1 pb-1 text-xs text-mut2">{tt("free_day")}</div>}
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

function BoardItem({ e, members, onOpen }: { e: CalEvent; members: Member[]; onOpen: () => void }) {
  const tt = useTranslations("time");
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
          <span>{timeRange(e, tt("all_day"))}</span>
          {e.remind_min != null && <span>· {tt("reminder")}</span>}
          {e.visibility === "private" && <PrivateMark />}
        </div>
      </div>
    </button>
  );
}

/* Month: dots per day, tap a day to see it below ------------------------------- */

type DayMark = { kind: "bill" | "income" | "tax"; label: string; amount: number | null; id: string };

function MonthView() {
  const tt = useTranslations("time");
  const dates = useDates();
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
    { label: tt("together"), color: "var(--who-t)", square: false },
    { label: tt("shift_square"), color: "var(--mut)", square: true },
  ];

  const list = dayEvents(time.events, selected);
  const money = marks(selected);

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMonth(addMonths(ym, -1))}
          aria-label={tt("previous_month")}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-ink"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-[15px] font-extrabold">{dates.monthFull(ym)}</div>
          <div className="text-xs text-mut2">{ym === today.ym ? tt("this_month") : ym < today.ym ? tt("past_month") : tt("coming_month")}</div>
        </div>
        <button
          onClick={() => setMonth(addMonths(ym, 1))}
          aria-label={tt("next_month")}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-ink"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <Card className="flex flex-col gap-2 px-2.5 py-3 wide:p-4">
        <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11px] font-bold text-mut2">
          {days.slice(0, 7).map((d) => (
            <div key={d}>{dates.dow(d)}</div>
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
                aria-label={tt("day_summary", { day: dates.day(d), plans: evs.length, money: mk.length })}
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
                  {evs.length > 2 && <span className={`text-[10.5px] font-bold ${isSel ? "text-white/70" : "text-mut"}`}>{tt("n_more", { n: evs.length - 2 })}</span>}
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
            <span className="text-[10px] font-black">€</span> {tt("bill_income_tax")}
          </span>
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <H2>{selected === today.iso ? tt("today_day", { day: dates.day(selected) }) : dates.day(selected)}</H2>
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
              <span className="font-medium text-mut"> · {m.kind === "tax" ? tt("tax_deadline") : m.kind === "income" ? tt("income") : tt("goes_out")}</span>
            </span>
            {m.amount != null && <span className={`font-mono text-[13px] font-bold ${m.amount > 0 ? "text-ok" : "text-ink"}`}>{eurSigned(m.amount)}</span>}
          </button>
        ))}
        {!list.length && !money.length && <EmptyNote>{tt("nothing_planned")}</EmptyNote>}
      </Card>
    </>
  );
}
