"use client";

import { ScanLine, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { useAppData } from "@/components/app-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useOnline } from "@/components/pwa";
import { useTime } from "@/components/time-data";
import { useToast } from "@/components/toast";
import { AddButton, Card, EmptyNote, H2 } from "@/components/ui";
import { readRoster, shrinkPhoto } from "@/lib/ai-read";
import { MONTHS_LONG } from "@/lib/money";
import { clashes, dayLabel, hm, monthShifts, shiftHours, shiftTags, timeRange } from "@/lib/time";
import { ModuleTabs } from "./module-tabs";
import { PageHeader } from "./page-header";

type Found = { date: string; start: string; end: string; note: string; keep: boolean; exists: boolean };

const fmtH = (h: number) => `${Math.round(h * 10) / 10}`.replace(/\.0$/, "");

export function ShiftsScreen() {
  const { today } = useMoney();
  const { userId } = useAppData();
  const time = useTime();
  const { openForm } = useMoneyForms();
  const toast = useToast();
  const online = useOnline();
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [found, setFound] = useState<Found[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const mine = time.events.filter((e) => e.kind === "shift" && e.owner_id === userId);
  const month = monthShifts(mine, today.ym);
  const upcoming = mine.filter((e) => e.date >= today.iso).sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  const nextMonthYm = today.m === 12 ? `${today.y + 1}-01` : `${today.y}-${String(today.m + 1).padStart(2, "0")}`;
  const next = monthShifts(mine, nextMonthYm);

  async function onRoster(f: File) {
    setReading(true);
    setFound(null);
    const file = f.type === "application/pdf" ? f : await shrinkPhoto(f, 2000);
    const read = await readRoster(file, today.iso);
    setReading(false);
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
    setFound(list);
    if (!list.length) toast("No shifts were found in that picture.");
  }

  async function saveFound() {
    if (!found) return;
    const rows = found
      .filter((f) => f.keep && !f.exists)
      .map((f) => ({ kind: "shift", title: "Bar shift", date: f.date, start_time: f.start, end_time: f.end || null, who: userId, source: "roster", note: f.note || null }));
    if (!rows.length) return setFound(null);
    const { added, error } = await time.insertMany("events", rows);
    if (error) return toast(error);
    toast(`${added} shift${added === 1 ? "" : "s"} saved · reminder 2 hours before each`);
    setFound(null);
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <PageHeader eyebrow="Time & goals" title="Shifts" />
        <ModuleTabs module="time" active="shifts" />
      </div>

      <div className="rounded-[10px] bg-inv p-5 text-white">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">{MONTHS_LONG[today.m - 1]}</div>
        <div className="mt-2 flex items-end gap-6">
          <div>
            <div className="text-[44px] font-black leading-none tracking-[-0.03em]">{month.count}</div>
            <div className="mt-1 text-[13px] text-white/70">shifts</div>
          </div>
          <div>
            <div className="text-[44px] font-black leading-none tracking-[-0.03em]">{fmtH(month.hours)}</div>
            <div className="mt-1 text-[13px] text-white/70">hours</div>
          </div>
        </div>
        {next.count > 0 && (
          <div className="mt-3 text-[13px] text-white/70">
            Next month so far: {next.count} shifts · {fmtH(next.hours)} hours
          </div>
        )}
      </div>

      <Card className="flex flex-col gap-3">
        <div>
          <H2>Read roster</H2>
          <div className="mt-1 text-[13px] text-mut">
            Take a screenshot of your shifts in the work app and pick it here. You check each shift before it is saved.
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onRoster(e.target.files[0])}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={reading || !online}
          className="flex min-h-12 items-center justify-center gap-2 rounded-full border-0 bg-acc text-sm font-extrabold text-onacc disabled:opacity-50"
        >
          <ScanLine size={18} /> {!online ? "Reading needs the internet" : reading ? "Reading the roster…" : "Choose screenshot or PDF"}
        </button>
        {found && found.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="text-[12.5px] font-bold text-mut">Found {found.length} shifts · tick the ones to save</div>
            {found.map((f, i) => (
              <label key={`${f.date}-${f.start}`} className={`flex items-center gap-3 border-t border-line py-2.5 ${f.exists ? "opacity-55" : ""}`}>
                <input
                  type="checkbox"
                  className="h-5 w-5 flex-none accent-[var(--acc)]"
                  checked={f.keep}
                  disabled={f.exists}
                  onChange={(e) => setFound((l) => l && l.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold">{dayLabel(f.date)}</div>
                  <div className="font-mono text-xs text-mut">
                    {f.start}
                    {f.end && ` – ${f.end}`}
                    {f.end && ` · ${fmtH(shiftHours(f.start, f.end))} h`}
                    {f.exists && " · already saved"}
                    {f.note && ` · ${f.note}`}
                  </div>
                </div>
              </label>
            ))}
            {warnings.map((w) => (
              <div key={w} className="text-xs text-warnt">
                Note from the AI: {w}
              </div>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button onClick={() => setFound(null)} className="min-h-11 rounded-[10px] border border-line bg-card text-[13.5px] font-bold">
                Cancel
              </button>
              <button
                onClick={saveFound}
                disabled={!found.some((f) => f.keep && !f.exists)}
                className="min-h-11 rounded-[10px] border-0 bg-inv text-[13.5px] font-extrabold text-white disabled:opacity-50"
              >
                Save {found.filter((f) => f.keep && !f.exists).length}
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-1">
        <div className="mb-1 flex items-baseline justify-between">
          <H2>Coming up</H2>
          <AddButton onClick={() => openForm("shift")} />
        </div>
        {upcoming.slice(0, 30).map((e) => {
          const tags = shiftTags(e);
          const clash = clashes(e, time.events);
          const isToday = e.date === today.iso;
          return (
            <button key={e.id} onClick={() => openForm("shift", e.id)} className="flex w-full items-center gap-3 border-0 border-t border-line bg-transparent py-3 text-left">
              <div className="w-[52px] flex-none text-center">
                <div className="text-[11px] font-bold uppercase text-mut">{dayLabel(e.date).slice(0, 3)}</div>
                <div className="text-[22px] font-black leading-none">{Number(e.date.slice(8))}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-extrabold text-ink">
                  {timeRange(e)}
                  {isToday && <span className="ml-1.5 text-[12px] font-bold text-acct">today</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-mut">
                  <span>{fmtH(shiftHours(e.start_time, e.end_time))} hours</span>
                  {tags.map((t) => (
                    <span key={t} className="rounded-full bg-soft2 px-2 py-0.5 text-[11px] font-bold text-mut">
                      {t}
                    </span>
                  ))}
                </div>
                {clash.length > 0 && (
                  <div className="mt-1 flex items-center gap-1 text-xs font-bold text-warnt">
                    <TriangleAlert size={13} /> Clashes with {clash.map((c) => c.title).join(", ")}
                  </div>
                )}
              </div>
            </button>
          );
        })}
        {!upcoming.length && <EmptyNote>No shifts planned. Read your roster above, or tap + Add.</EmptyNote>}
      </Card>
    </>
  );
}
