"use client";

import Link from "next/link";
import { useAppData } from "@/components/app-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useTime } from "@/components/time-data";
import { PrivateMark } from "@/components/ui";
import { addDays, dayEvents, dowShort, hm, type CalEvent } from "@/lib/time";
import { WhoLegend, whoColors } from "./week";

/** Home: the next 7 days for both of you (or one person), one row per day. */
export function NextDays({ scope }: { scope: string }) {
  const { members } = useAppData();
  const { today } = useMoney();
  const { events } = useTime();
  const { openForm } = useMoneyForms();
  if (today.y < 2026) return null; // wait for the real date

  // A person view keeps their own items and Together plans.
  const mine = (e: CalEvent) => {
    if (scope === "family") return true;
    const who = e.kind === "shift" ? e.owner_id : e.who;
    return who === scope || who === null;
  };
  const days = Array.from({ length: 7 }, (_, i) => addDays(today.iso, i));

  return (
    <section className="flex flex-col gap-3 rounded-[10px] border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
        <h2 className="m-0 text-lg font-extrabold tracking-[-0.01em]">
          <Link href="/week" className="text-ink hover:underline">
            Next 7 days
          </Link>
        </h2>
        <WhoLegend members={members} />
      </div>
      <ol className="m-0 flex list-none flex-col p-0">
        {days.map((d, i) => {
          const list = dayEvents(events, d).filter(mine);
          return (
            <li key={d} className={`flex gap-3 border-t border-line py-2.5 first:border-t-0 ${i === 0 ? "-mx-2 rounded-lg bg-soft px-2" : ""}`}>
              <div className="w-[62px] flex-none pt-1">
                <div className="font-mono text-[13px] font-bold text-ink">
                  {dowShort(d)} {Number(d.slice(8))}
                </div>
                {i < 2 && <div className="text-[11.5px] text-mut2">{i === 0 ? "Today" : "Tomorrow"}</div>}
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {list.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => openForm(e.kind, e.id)}
                    className={`flex min-h-9 max-w-full items-center gap-2 rounded-lg border-0 px-2.5 py-1.5 text-left hover:bg-soft2 ${i === 0 ? "bg-card" : "bg-soft"} ${
                      e.visibility === "private" ? "outline-dashed outline-1 outline-line2" : ""
                    }`}
                  >
                    <span className="h-2 w-2 flex-none rounded-full" style={{ background: whoColors(members, e.kind === "shift" ? e.owner_id : e.who).bg }} aria-hidden />
                    {e.start_time && (
                      <span className="flex-none font-mono text-[12px] text-mut">
                        {hm(e.start_time)}
                        {e.kind === "shift" && e.end_time ? `–${hm(e.end_time)}` : ""}
                      </span>
                    )}
                    <span className="min-w-0 truncate text-[13.5px] font-bold text-ink">{e.title}</span>
                    {e.visibility === "private" && <PrivateMark />}
                  </button>
                ))}
                {!list.length && (
                  <button onClick={() => openForm("event", undefined, { date: d })} className="min-h-9 rounded-lg border-0 bg-transparent px-1 text-[13px] text-mut2 hover:text-ink">
                    Free · + Add
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
