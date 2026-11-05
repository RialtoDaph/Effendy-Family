"use client";

import { useTranslations } from "next-intl";
import { useAppData } from "@/components/app-data";
import { ScreenEmpty } from "@/components/empty-state";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useLabel } from "@/components/nav-label";
import { avatarColors } from "@/components/shell/avatar";
import { useTime } from "@/components/time-data";
import { GYM_TYPES, type GymType } from "@/components/time-forms";
import { useToast } from "@/components/toast";
import { AddButton, Card, H2, OwnerPill } from "@/components/ui";
import { AppIcon } from "@/lib/icons";
import { eur } from "@/lib/money";
import { QUEUED } from "@/lib/offline-queue";
import { addMonths, hm, isGymName, weekStart, weekStreak, weekTotals } from "@/lib/time";
import { useDates } from "@/lib/use-dates";
import { WeekBars } from "./learn";
import { ModuleHeader } from "./module-tabs";

const QUICK: GymType[] = ["Strength", "Cardio", "Class"];

export function GymScreen() {
  const tt = useTranslations("time");
  const tm = useTranslations("money");
  const t = useTranslations("t");
  const dates = useDates();
  const label = useLabel();
  const { today, recurring } = useMoney();
  const { members, settings, userId } = useAppData();
  const time = useTime();
  const { openForm } = useMoneyForms();
  const toast = useToast();
  const monday = weekStart(today.iso);
  const goal = settings?.gym_week_goal ?? 3;

  // Cost per visit last month, from a recurring payment that looks like a gym.
  const lastMonth = addMonths(today.ym, -1);
  const fees = recurring.filter((r) => r.active && r.amount < 0 && isGymName(r.name));
  const fee = fees.reduce((a, r) => a - r.amount, 0);
  const visits = time.gym.filter((s) => s.date.startsWith(lastMonth)).length;

  const gymLabel = (type: string) => {
    const known = GYM_TYPES.find((g) => g.value === type);
    return known ? tt(`gym_${known.value}`) : type;
  };

  async function quick(type: GymType) {
    const err = await time.save("gym_sessions", {
      type,
      icon: GYM_TYPES.find((g) => g.value === type)?.icon ?? "dumbbell",
      date: today.iso,
      visibility: settings?.default_visibility?.gym ?? "family",
    });
    if (err && err !== QUEUED) return toast(err);
    toast(err === QUEUED ? tm("queued") : tt("session_logged"));
  }

  if (time.loaded && !time.gym.length) {
    return (
      <>
        <ModuleHeader module="life" active="gym" />
        <ScreenEmpty eyebrow={label("nav.gym")} title={t("e_gym")} action={tt("log_session")} onAction={() => openForm("gym")} />
      </>
    );
  }

  return (
    <>
      <ModuleHeader module="life" active="gym" />

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        {members.map((m) => {
          const totals = weekTotals(
            time.gym.filter((s) => s.owner_id === m.id),
            monday,
            8,
            () => 1,
          );
          const n = totals[7];
          const streak = weekStreak(totals, goal);
          const c = avatarColors(m);
          return (
            <Card key={m.id} className="flex flex-col gap-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full font-bold" style={{ background: c.bg, color: c.fg }}>
                  {m.display_name[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold">{m.display_name}</div>
                  <div className="text-xs text-mut2">{tt("goal_times_week", { n: goal })}</div>
                </div>
                {streak > 0 && <span className="whitespace-nowrap rounded-full bg-tint px-2.5 py-1 text-xs font-bold text-acct">{tt("streak", { n: streak })}</span>}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-[52px] font-normal tracking-[-0.01em]">{n}</span>
                <span className="whitespace-nowrap text-sm font-semibold text-mut2">{tt("of_this_week", { n: goal })}</span>
              </div>
              <div aria-hidden className="flex gap-1.5">
                {Array.from({ length: Math.max(goal, n) }, (_, i) => (
                  <span key={i} className="h-2.5 flex-1 rounded-full" style={{ background: i < n ? "var(--acc)" : "var(--soft2)" }} />
                ))}
              </div>
              <WeekBars totals={totals} goal={goal} />
              <div className="-mt-2 text-[11px] text-mut2">{tt("last_8_weeks")}</div>
              {m.id === userId && (
                <div className="flex flex-wrap gap-1.5">
                  {QUICK.map((q) => (
                    <button key={q} onClick={() => quick(q)} className="min-h-[42px] flex-1 whitespace-nowrap rounded-full border border-line bg-card px-3 text-[12.5px] font-bold hover:bg-soft">
                      + {tt(`gym_${q}`)}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        <Card>
          <div className="mb-1.5 flex items-center justify-between">
            <H2>{tt("recent_sessions")}</H2>
            <AddButton onClick={() => openForm("gym")} label={tt("log_plus")} />
          </div>
          {time.gym.slice(0, 8).map((s) => (
            <button key={s.id} onClick={() => openForm("gym", s.id)} className="flex w-full items-center gap-3 rounded-lg border-0 border-b border-line bg-transparent px-1 py-[11px] text-left hover:bg-soft">
              <span className="flex w-[26px] flex-none justify-center text-ink">
                <AppIcon name={s.icon} size={19} strokeWidth={1.7} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">{gymLabel(s.type)}</span>
                <span className="block text-xs text-mut2">
                  {s.date === today.iso ? tm("today") : dates.day(s.date)}
                  {s.time && ` · ${hm(s.time)}`}
                </span>
              </span>
              <OwnerPill member={members.find((m) => m.id === s.owner_id)} />
            </button>
          ))}
        </Card>

        {fee > 0 && visits > 0 && (
          <section className="flex flex-col gap-2 rounded-[18px] bg-inv p-6 text-white">
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-acc2">{tt("membership_worth")}</div>
            <div className="font-serif text-[52px] font-normal tracking-[-0.01em]">{eur(fee / visits)}</div>
            <div className="text-sm leading-[1.55] text-white/75">
              {tt("membership_note", { month: dates.monthLong(Number(lastMonth.slice(5))), name: fees.map((f) => f.name).join(", "), fee: eur(fee), n: visits })}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
