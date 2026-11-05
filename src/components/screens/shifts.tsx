"use client";

import { Camera, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useAppData } from "@/components/app-data";
import { ScreenEmpty } from "@/components/empty-state";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useLabel } from "@/components/nav-label";
import { useOnline } from "@/components/pwa";
import { useTime } from "@/components/time-data";
import { useToast } from "@/components/toast";
import { AddButton, Card, H2 } from "@/components/ui";
import { readRoster, shrinkPhoto } from "@/lib/ai-read";
import { eur } from "@/lib/money";
import { afterMidnightHours, clashes, freeEvenings, hm, monthShifts, shiftBonus, shiftHours, shiftTags, timeRange, weekDays, weekStart, type CalEvent } from "@/lib/time";
import { useDates } from "@/lib/use-dates";
import { ModuleHeader } from "./module-tabs";

type Found = { date: string; start: string; end: string; note: string; keep: boolean; exists: boolean };

const STAT = "rounded-xl border border-line bg-card p-[18px]";
const STAT_NUM = "font-serif text-[44px] font-normal tracking-[-0.01em]";

export function ShiftsScreen() {
  const tt = useTranslations("time");
  const tm = useTranslations("money");
  const t = useTranslations("t");
  const dates = useDates();
  const label = useLabel();
  const { today } = useMoney();
  const { userId, settings, members } = useAppData();
  const time = useTime();
  const { openForm } = useMoneyForms();
  const toast = useToast();
  const online = useOnline();
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [found, setFound] = useState<Found[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [added, setAdded] = useState<{ n: number; days: string[] } | null>(null);

  const mine = time.events.filter((e) => e.kind === "shift" && e.owner_id === userId);
  const byTime = (a: CalEvent, b: CalEvent) => a.date.localeCompare(b.date) || (a.start_time ?? "").localeCompare(b.start_time ?? "");
  const thisMonth = mine.filter((e) => e.date.startsWith(today.ym));
  const month = monthShifts(mine, today.ym);
  const late = thisMonth.reduce((h, e) => h + afterMidnightHours(e), 0);
  const wage = settings?.shift_wage ?? 0;
  const bonus = thisMonth.reduce((a, e) => a + shiftBonus(e, wage), 0);
  const days = weekDays(weekStart(today.iso));
  const upcoming = mine.filter((e) => e.date >= today.iso).sort(byTime);
  const thisWeek = upcoming.filter((e) => days.includes(e.date));
  const later = upcoming.filter((e) => !days.includes(e.date));
  const keep = found?.filter((f) => f.keep && !f.exists) ?? [];

  async function onRoster(f: File) {
    setReading(f.name);
    setFound(null);
    setAdded(null);
    const file = f.type === "application/pdf" ? f : await shrinkPhoto(f, 2000);
    const read = await readRoster(file, today.iso);
    setReading(null);
    if (fileRef.current) fileRef.current.value = "";
    if (read.error !== undefined) return toast(read.error);
    const have = new Set(mine.map((e) => `${e.date} ${hm(e.start_time)}`));
    const list = read.result.shifts
      .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date) && /^\d{2}:\d{2}$/.test(s.start))
      .map((s) => {
        const exists = have.has(`${s.date} ${s.start}`);
        return { date: s.date, start: s.start, end: s.end ?? "", note: s.note ?? "", exists, keep: !exists && s.date >= today.iso };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    setWarnings(read.result.warnings);
    if (!list.length) return toast(tt("no_shifts_found"));
    setFound(list);
  }

  async function saveFound() {
    const rows = keep.map((f) => ({ kind: "shift", title: tt("bar_shift"), date: f.date, start_time: f.start, end_time: f.end || null, who: userId, source: "roster", note: f.note || null }));
    if (!rows.length) return setFound(null);
    const { added: n, error } = await time.insertMany("events", rows);
    if (error) return toast(error);
    // The roster's week, for "free evenings next week".
    const week = weekDays(weekStart(keep[0].date));
    const planned = rows.map((r, i) => ({ id: String(i), owner_id: userId, kind: "shift", date: r.date, start_time: r.start_time, end_time: r.end_time, who: userId }) as CalEvent);
    setAdded({ n, days: freeEvenings([...time.events, ...planned], members.map((m) => m.id), week) });
    setFound(null);
  }

  if (time.loaded && !mine.length && !found && !reading && !added) {
    return (
      <>
        <ModuleHeader module="time" active="shifts" />
        <ScreenEmpty eyebrow={label("nav.shifts")} title={t("e_shifts")} action={t("b_shift")} onAction={() => openForm("shift")} />
      </>
    );
  }

  const row = (e: CalEvent) => {
    const clash = clashes(e, time.events);
    const isToday = e.date === today.iso;
    return (
      <button key={e.id} onClick={() => openForm("shift", e.id)} className="flex w-full flex-col gap-1 border-0 border-b border-line bg-transparent py-3 text-left">
        <span className="flex w-full items-center gap-3">
          <span className={`w-12 flex-none rounded-xl py-1.5 text-center text-ink ${isToday ? "bg-warn" : "bg-soft2"}`}>
            <span className="block text-[11px] font-bold uppercase tracking-[0.08em]">{dates.dow(e.date)}</span>
            <span className="block text-[18px] font-bold leading-[1.1]">{Number(e.date.slice(8))}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-bold tabular-nums text-ink">{timeRange(e, tt("all_day"))}</span>
            <span className="block text-xs text-mut2">
              {tt("n_hours", { h: dates.num(shiftHours(e.start_time, e.end_time)) })}
              {isToday && ` · ${tt("today_lower")}`}
            </span>
          </span>
          {shiftTags(e).map((g) => (
            <span key={g} className="rounded-full bg-tint px-2 py-[3px] text-[11px] font-bold text-acct">
              {g === "Night" ? tt("tag_night") : tt("tag_sunday")}
            </span>
          ))}
        </span>
        {clash.length > 0 && (
          <span className="flex items-center gap-1 text-xs font-bold text-warnt">
            <TriangleAlert size={13} /> {tt("clashes_with", { titles: clash.map((c) => c.title).join(", ") })}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      <ModuleHeader module="time" active="shifts" />

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))]">
        <div className={STAT}>
          <div className="text-[12.5px] text-mut">{tt("shifts_in_month", { month: dates.monthLong(today.m) })}</div>
          <div className={STAT_NUM}>{month.count}</div>
        </div>
        <div className={STAT}>
          <div className="text-[12.5px] text-mut">{tt("hours_planned")}</div>
          <div className={STAT_NUM}>{tt("n_h", { h: dates.num(month.hours) })}</div>
          <div className="text-xs text-mut2">{tt("after_midnight", { h: dates.num(late) })}</div>
        </div>
        <div className={STAT}>
          <div className="text-[12.5px] text-mut">{tt("bonus_title")}</div>
          {wage > 0 ? (
            <>
              <div className={`${STAT_NUM} text-acct`}>≈ {eur(bonus, 0)}</div>
              <button onClick={() => openForm("wage")} className="min-h-0 border-0 bg-transparent p-0 text-left text-xs text-mut2">
                {tt("bonus_note")}
              </button>
            </>
          ) : (
            <button onClick={() => openForm("wage")} className="mt-2 min-h-10 rounded-full border-0 bg-tint px-4 text-[13px] font-bold text-acct">
              {tt("set_wage")}
            </button>
          )}
        </div>
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))]">
        <Card>
          <div className="mb-1.5 flex items-center justify-between gap-2.5">
            <H2>{tt("this_week")}</H2>
            <AddButton onClick={() => openForm("shift")} />
          </div>
          {thisWeek.map(row)}
          {!thisWeek.length && <div className="py-3 text-[13px] text-mut">{tt("no_shifts_week")}</div>}
          {later.length > 0 && (
            <>
              <div className="eyebrow mt-4">{tt("later")}</div>
              {later.slice(0, 30).map(row)}
            </>
          )}
        </Card>

        <Card>
          <H2 className="mb-1">{tt("next_week_plan")}</H2>
          <p className="mb-3.5 mt-0 text-[13px] text-mut">{tt("next_week_note")}</p>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onRoster(e.target.files[0])} />

          {reading && (
            <div className="flex flex-col gap-2.5 py-2.5">
              <div className="truncate text-[13px] text-mut">{reading}</div>
              <div className="text-[20px] font-bold">{tt("reading_plan")}</div>
              <div className="h-2 overflow-hidden rounded-full bg-soft2">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-acc" />
              </div>
            </div>
          )}

          {!reading && !found && !added && (
            <div className="flex flex-col items-center gap-2.5 rounded-xl border-2 border-dashed border-line bg-soft px-5 py-[30px] text-center">
              <Camera size={30} strokeWidth={1.7} />
              <div className="text-[15px] font-bold">{tt("photo_or_pdf")}</div>
              <button onClick={() => fileRef.current?.click()} disabled={!online} className="mt-1 h-[46px] rounded-full border-0 bg-acc px-[22px] text-sm font-bold text-onacc disabled:opacity-50">
                {online ? tt("upload_plan") : tt("needs_internet")}
              </button>
            </div>
          )}

          {found && (
            <div className="flex flex-col">
              <div className="eyebrow mb-1">{tt("tap_to_untick")}</div>
              {found.map((f, i) => (
                <button
                  key={`${f.date}-${f.start}`}
                  disabled={f.exists}
                  onClick={() => setFound((l) => l && l.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)))}
                  aria-pressed={f.keep}
                  className={`flex min-h-14 items-center gap-3 border-0 border-b border-line bg-transparent py-3 text-left ${f.exists ? "opacity-55" : ""}`}
                >
                  <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-lg border-2 text-[13px] font-bold ${f.keep ? "border-acc bg-acc text-onacc" : "border-line2 bg-card"}`}>{f.keep ? "✓" : ""}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink">
                      {dates.day(f.date)} · {f.start}
                      {f.end && ` – ${f.end}`}
                    </span>
                    <span className="block text-xs text-mut2">
                      {[f.end ? tt("n_hours", { h: dates.num(shiftHours(f.start, f.end)) }) : "", f.exists ? tt("already_saved") : "", f.note].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              ))}
              {warnings.map((w) => (
                <div key={w} className="mt-2 text-xs text-warnt">
                  {tt("ai_note", { note: w })}
                </div>
              ))}
              <button onClick={saveFound} disabled={!keep.length} className="mt-3.5 h-12 rounded-full border-0 bg-acc text-sm font-bold text-onacc disabled:opacity-50">
                {tt("add_n_shifts", { n: keep.length })}
              </button>
              <button onClick={() => setFound(null)} className="mt-2 min-h-11 rounded-full border border-line bg-card text-[13px] font-bold">
                {tm("cancel")}
              </button>
            </div>
          )}

          {added && (
            <div className="flex flex-col gap-3 py-1.5">
              <div className="text-[20px] font-bold">{tt("n_shifts_added", { n: added.n })}</div>
              <div className="text-sm leading-[1.55] text-mut">
                {added.days.length ? tt.rich("free_evenings_list", { days: added.days.map(dates.dow).join(", "), b: (c) => <b className="text-ink">{c}</b> }) : tt("no_free_evenings_next")}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/week" className="flex h-11 items-center rounded-full bg-inv px-[18px] text-[13px] font-bold text-white hover:text-white">
                  {tt("see_the_week")}
                </Link>
                <button onClick={() => setAdded(null)} className="h-11 rounded-full border border-line bg-card px-[18px] text-[13px] font-bold">
                  {tt("upload_another")}
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
