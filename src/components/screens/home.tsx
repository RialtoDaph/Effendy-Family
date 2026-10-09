"use client";

import Link from "next/link";
import { Check, Lock, Pause, Play } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useAppData, type Member } from "@/components/app-data";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { avatarColors } from "@/components/shell/avatar";
import { AddButton, EmptyNote, ProgressBar } from "@/components/ui";
import { AppIcon } from "@/lib/icons";
import { AI_NAME } from "@/lib/nav";
import { addMonthsLabel, briefing, eur, goalEta, inScope, plural, type Goal } from "@/lib/money";
import { PageHeader } from "./page-header";
import { useSetupSteps } from "./setup";

const noop = () => () => {};

function useClientValue<T>(get: () => T, server: T) {
  return useSyncExternalStore(noop, get, () => server);
}

function greeting(hour: number) {
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export function HomeScreen() {
  const { members, userId, household } = useAppData();
  const money = useMoney();
  const [scope, setScope] = useState<"family" | string>("family");

  const todayLabel = useClientValue(
    () => new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Berlin" }),
    "",
  );
  const hour = useClientValue(
    () => Number(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Berlin" })),
    8,
  );

  const person = members.find((m) => m.id === scope);
  const names = members.length ? members.map((m) => m.display_name).join(" & ") : "Rialto & Amnah";
  const title = person ? `${hour < 12 ? "Morning" : greeting(hour)}, ${person.display_name}` : `${greeting(hour)}, ${names}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <PageHeader eyebrow={todayLabel ? `${todayLabel} · ${household?.home_city ?? "Eichstätt"}` : " "} title={title} />
        {members.length > 0 && <PersonFilter members={members} value={scope} onChange={setScope} />}
      </div>
      <AlertChip />
      <Briefing />
      <Kpis scope={scope} viewerId={userId} />
      <NetWorthCard />
      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
        <ThreeThings />
        <Goals scope={scope} viewerId={userId} />
      </div>
      {!money.loaded && <div className="text-center text-[13px] text-mut2">Loading…</div>}
    </>
  );
}

function PersonFilter({ members, value, onChange }: { members: Member[]; value: string; onChange: (v: string) => void }) {
  const opts = [
    { id: "family", label: "Family", initial: "EF", bg: "var(--acc)", fg: "var(--onacc)" },
    ...members.map((m) => {
      const c = avatarColors(m);
      return { id: m.id, label: m.display_name, initial: m.display_name[0]?.toUpperCase() ?? "·", bg: c.bg, fg: c.fg };
    }),
  ];
  return (
    <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-card p-1">
      {opts.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            aria-pressed={on}
            className={`flex min-h-10 items-center gap-[7px] whitespace-nowrap rounded-full border-0 py-[5px] pl-[5px] pr-3.5 text-[13px] font-bold ${
              on ? "bg-inv text-white" : "bg-transparent text-ink"
            }`}
          >
            <span
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-xs font-black"
              style={{ background: o.bg, color: o.fg }}
            >
              {o.initial}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function AlertChip() {
  const { alerts } = useMoney();
  const open = alerts.filter((a) => a.sev !== "info");
  if (!open.length) return null;
  const top = open[0];
  return (
    <Link
      href="/alerts"
      className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-line bg-card px-3.5 py-2.5 text-left text-ink hover:border-line2"
    >
      <span className={`h-2 w-2 flex-none rounded-full ${top.sev === "urgent" ? "bg-bad" : "bg-warn"}`} />
      <span className="min-w-0 flex-1 truncate text-sm font-bold">{top.title}</span>
      <span className="flex-none whitespace-nowrap text-[12.5px] font-bold text-mut">
        {open.length} alert{open.length > 1 ? "s" : ""} →
      </span>
    </Link>
  );
}

function Briefing() {
  const money = useMoney();
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const hasData = money.transactions.length > 0 || money.incomes.length > 0;
  const text = briefing({ budget: money.budget, alerts: money.alerts, ef: money.ef, hasData });

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function togglePlay() {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (playing) {
      synth.cancel();
      setPlaying(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    synth.cancel();
    synth.speak(u);
    setPlaying(true);
  }

  return (
    <section className="flex flex-col gap-2.5 rounded-xl border border-line bg-soft py-2.5 pl-4 pr-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex-none font-mono text-[11px] font-bold uppercase tracking-[.12em] text-mut">{AI_NAME}</span>
        <span className={`min-w-0 flex-1 text-sm font-medium text-ink ${open ? "whitespace-normal leading-normal" : "truncate"}`}>{text}</span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-none whitespace-nowrap border-0 bg-transparent px-1.5 py-2 text-[12.5px] font-bold text-mut"
        >
          {open ? "Less" : "Read all"}
        </button>
        <button
          onClick={togglePlay}
          aria-label={playing ? "Stop" : "Listen"}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-line bg-card text-ink"
        >
          {playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
        </button>
      </div>
    </section>
  );
}

function Kpis({ scope, viewerId }: { scope: string; viewerId: string }) {
  const { budget, transactions, goals, today } = useMoney();
  const { members } = useAppData();
  const monthTx = transactions.filter((t) => t.date.startsWith(today.ym) && inScope(t, scope, viewerId));
  const income = monthTx.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  const spent = monthTx.filter((t) => t.amount < 0).reduce((a, t) => a - t.amount, 0);
  const scopedGoals = goals.filter((g) => inScope({ ...g, paid_by: g.owner_id }, scope, viewerId));
  const intoGoals = scopedGoals.reduce((a, g) => a + g.monthly, 0);
  const person = members.find((m) => m.id === scope);

  const cards =
    scope === "family"
      ? [
          { label: "Flexible money left", value: eur(budget.flexLeft, 0), note: `${eur(budget.perDay, 0)} a day · ${budget.daysLeft} days` },
          { label: "Income this month", value: eur(income, 0), note: `${plural(monthTx.filter((t) => t.amount > 0).length, "payment")} in` },
          { label: "Into goals", value: eur(intoGoals, 0), note: `${plural(scopedGoals.length, "goal")} · each month`, ok: true },
        ]
      : [
          { label: `Spent by ${person?.display_name ?? "…"}`, value: eur(spent, 0), note: "this month" },
          { label: "Income this month", value: eur(income, 0), note: `${plural(monthTx.filter((t) => t.amount > 0).length, "payment")} in` },
          { label: "Into goals", value: eur(intoGoals, 0), note: `${plural(scopedGoals.length, "goal")} · each month`, ok: true },
        ];

  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-line bg-card px-[18px] py-4">
          <div className="text-xs font-semibold text-mut">{c.label}</div>
          <div className="mt-1 text-[30px] font-extrabold tracking-[-0.03em]">{c.value}</div>
          <div className={`mt-0.5 text-xs ${c.ok ? "text-ok" : "text-mut2"}`}>{c.note}</div>
        </div>
      ))}
    </div>
  );
}

function ThreeThings() {
  const { alerts, closeAlert } = useMoney();
  const steps = useSetupSteps();
  const [done, setDone] = useState<{ key: string; title: string; meta: string; href: string; cta: string }[]>([]);

  const fromAlerts = alerts.map((a) => ({ key: a.key, title: a.title, meta: a.meta, href: a.href, cta: a.cta, alert: true }));
  const fromSetup = steps
    .filter((s) => !s.done && !s.phase)
    .map((s) => ({ key: `setup-${s.title}`, title: s.title, meta: s.sub, href: s.href, cta: "Open", alert: false }));
  const open = [...fromAlerts, ...fromSetup].filter((t) => !done.some((d) => d.key === t.key));
  const items = [...done.map((d) => ({ ...d, isDone: true, alert: true })), ...open.map((o) => ({ ...o, isDone: false }))].slice(0, 3);

  return (
    <section className="rounded-[10px] border border-line bg-card p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="m-0 text-lg font-extrabold tracking-[-0.01em]">3 things this week</h2>
        <span className="text-xs font-bold text-mut2">{done.length}/3 done</span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.key} className="flex items-start gap-3 rounded-[10px] bg-soft p-3">
            {t.alert ? (
              <button
                onClick={() => {
                  if (t.isDone) return;
                  setDone((d) => [...d, t]);
                  closeAlert(t.key, "done");
                }}
                aria-label={t.isDone ? "Done" : `Mark “${t.title}” done`}
                className={`mt-px flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[9px] border-2 text-white ${
                  t.isDone ? "border-ok bg-ok" : "border-line2 bg-card"
                }`}
              >
                {t.isDone && <Check size={14} strokeWidth={3} />}
              </button>
            ) : (
              <span className="mt-px h-[26px] w-[26px] flex-none rounded-[9px] border-2 border-dashed border-line2" />
            )}
            <div className="min-w-0 flex-1">
              <div className={`text-[14.5px] font-bold leading-[1.35] ${t.isDone ? "text-mut2 line-through" : "text-ink"}`}>{t.title}</div>
              <div className="mt-[3px] text-[12.5px] text-mut">{t.meta}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-acc px-[9px] py-[3px] text-[11px] font-bold text-onacc">Family</span>
                <Link href={t.href} className="whitespace-nowrap py-1 text-[12.5px] font-extrabold text-acct">
                  {t.cta} →
                </Link>
              </div>
            </div>
          </div>
        ))}
        {!items.length && <EmptyNote>Nothing urgent this week. Enjoy it.</EmptyNote>}
      </div>
    </section>
  );
}

function Goals({ scope, viewerId }: { scope: string; viewerId: string }) {
  const { goals, today } = useMoney();
  const { openForm } = useMoneyForms();
  const shared = goals.filter((g) => g.visibility === "family" && (scope === "family" || g.owner_id === scope));
  const mine = goals.filter((g) => g.visibility === "private" && g.owner_id === viewerId && (scope === "family" || scope === viewerId));
  const monthly = shared.reduce((a, g) => a + g.monthly, 0);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[10px] border border-line bg-card p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="m-0 text-lg font-extrabold tracking-[-0.01em]">Shared goals</h2>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-mut2">{eur(monthly)}/mo</span>
            <AddButton onClick={() => openForm("goal", undefined, { visibility: "family" })} />
          </div>
        </div>
        <div className="flex flex-col gap-3.5">
          {shared.map((g) => (
            <GoalRow key={g.id} goal={g} todayLabel={(m) => addMonthsLabel(today, m)} onClick={() => openForm("goal", g.id)} />
          ))}
          {!shared.length && <EmptyNote>Add a goal you save for together, like a car or a trip.</EmptyNote>}
        </div>
      </section>
      {mine.length > 0 && (
        <section className="rounded-[10px] border border-dashed border-line2 bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Lock size={14} strokeWidth={2.2} className="text-mut" />
            <h2 className="m-0 text-base font-extrabold">Your private goals</h2>
            <span className="ml-auto text-xs font-bold text-mut2">Only you can see these</span>
          </div>
          <div className="flex flex-col gap-3.5">
            {mine.map((g) => (
              <GoalRow key={g.id} goal={g} todayLabel={(m) => addMonthsLabel(today, m)} onClick={() => openForm("goal", g.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GoalRow({ goal, onClick, todayLabel }: { goal: Goal; onClick: () => void; todayLabel: (m: number) => string }) {
  const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
  const eta = goalEta(goal);
  const meta = goal.is_emergency_fund
    ? `${eur(goal.current)} saved${goal.monthly ? ` · ${eur(goal.monthly)}/mo` : ""} · see Budget`
    : `${eur(goal.current)} of ${eur(goal.target)}${goal.monthly ? ` · ${eur(goal.monthly)}/mo` : ""}${
        eta === 0 ? " · reached" : Number.isFinite(eta) ? ` · ${todayLabel(eta)}` : ""
      }`;
  return (
    <button onClick={onClick} className="-m-1.5 flex items-center gap-3 rounded-[10px] border-0 bg-transparent p-1.5 text-left hover:bg-soft">
      <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[13px] bg-tint text-ink">
        <AppIcon name={goal.icon} size={21} strokeWidth={1.7} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-bold text-ink">{goal.name}</span>
          {!goal.is_emergency_fund && <span className="text-sm font-black text-acct">{pct}%</span>}
        </div>
        {!goal.is_emergency_fund && (
          <div className="mt-1.5">
            <ProgressBar pct={pct} />
          </div>
        )}
        <div className="mt-1 text-xs text-mut2">{meta}</div>
      </div>
    </button>
  );
}

function NetWorthCard() {
  const { worth, assets, debts } = useFinance();
  if (!assets.length && !debts.length) return null;
  const total = worth.assets + worth.debts || 1;
  return (
    <Link href="/invest" className="flex flex-col gap-2 rounded-xl border border-line bg-card px-5 py-[18px] text-ink hover:border-line2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold text-mut">Net worth</span>
        <span className="text-xs font-bold text-mut2">{plural(assets.filter((a) => a.visibility === "family").length, "account")} →</span>
      </div>
      <div className="text-[30px] font-extrabold tracking-[-0.03em]">{eur(worth.net, 0)}</div>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        <div className="bg-acc" style={{ flex: worth.assets / total }} />
        {worth.debts > 0 && <div className="bg-bad" style={{ flex: worth.debts / total }} />}
      </div>
      <div className="flex justify-between font-mono text-xs text-mut">
        <span>Saved {eur(worth.assets, 0)}</span>
        <span>Debts {worth.debts ? `−${eur(worth.debts, 0)}` : "€0"}</span>
      </div>
    </Link>
  );
}
