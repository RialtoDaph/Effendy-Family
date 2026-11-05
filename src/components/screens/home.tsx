"use client";

import { Check, List, Lock, Network, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useAppData, type Member, useAiName } from "@/components/app-data";
import { ParticleStages, type Stage } from "@/components/clopar";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useOnline } from "@/components/pwa";
import { avatarColors } from "@/components/shell/avatar";
import { useTime } from "@/components/time-data";
import { AddButton, EmptyNote, PrivateMark, ProgressBar } from "@/components/ui";
import { SampleDataButton } from "@/components/sample-data";
import { fetchBriefing, loadBriefing, saveBriefing } from "@/lib/ask";
import type { Answer } from "@/lib/ask-schema";
import { AppIcon } from "@/lib/icons";
import { eur, goalEta, type Alert, type Goal } from "@/lib/money";
import { addDays, dayEvents, hm, type CalEvent } from "@/lib/time";
import { useDates } from "@/lib/use-dates";
import { InboxCard } from "./inbox-card";
import { PageHeader } from "./page-header";
import { whoColors } from "./week";

const noop = () => () => {};
const SPEECH: Record<string, string> = { en: "en-GB", de: "de-DE", id: "id-ID" };

function useClientValue<T>(get: () => T, server: T) {
  return useSyncExternalStore(noop, get, () => server);
}

/** The five first steps. Home stays on them until three are done. */
export function useFreshSteps() {
  const { incomes, transactions, categories, goals, recurring, loaded } = useMoney();
  const { openForm } = useMoneyForms();
  const steps = [
    { key: "income", done: incomes.length > 0, go: () => openForm("income") },
    { key: "import", done: transactions.length > 0, href: "/import" },
    { key: "budget", done: categories.some((c) => c.monthly_limit > 0), href: "/budget" },
    { key: "goal", done: goals.some((g) => !g.is_emergency_fund), go: () => openForm("goal") },
    { key: "sub", done: recurring.some((r) => r.is_subscription), go: () => openForm("sub") },
  ] as const;
  const done = steps.filter((s) => s.done).length;
  return { steps, done, fresh: loaded && done < 3 };
}

export function HomeScreen() {
  const t = useTranslations("home");
  const tt = useTranslations("t");
  const { members, userId, household } = useAppData();
  const { loaded, today } = useMoney();
  const dates = useDates();
  const { fresh } = useFreshSteps();
  const [scope, setScope] = useState<"family" | string>("family");

  const hour = useClientValue(() => new Date().getHours(), 8);
  const person = members.find((m) => m.id === scope);
  const me = members.find((m) => m.id === userId);
  const greeting = t(hour < 12 ? "greet_morning" : hour < 18 ? "greet_afternoon" : "greet_evening");
  const names = members.map((m) => m.display_name).join(" & ");
  const who = person?.display_name ?? (fresh ? me?.display_name : names);
  const city = household?.home_city;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <PageHeader
          eyebrow={today.y >= 2026 ? `${dates.day(today.iso)}${city ? ` · ${city}` : ""}` : " "}
          title={who ? t("greet_name", { greeting, name: who }) : greeting}
        />
        {loaded && !fresh && (
          <div className="flex max-w-full flex-wrap items-center gap-2">
            {members.length > 1 && <PersonFilter members={members} value={scope} onChange={setScope} />}
            <div className="flex gap-0.5 rounded-full bg-soft2 p-[3px]">
              <span className="flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-card px-3.5 text-[13px] font-bold text-ink shadow-[0_1px_3px_rgba(0,0,0,.12)]">
                <List size={15} strokeWidth={2} />
                {tt("mapList")}
              </span>
              <Link href="/map" className="hit44 flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-bold text-mut">
                <Network size={15} strokeWidth={2} />
                {tt("mapMap")}
              </Link>
            </div>
          </div>
        )}
      </div>
      {!loaded ? null : fresh ? (
        <GettingStarted />
      ) : (
        <>
          <Hero />
          <AlertChip />
          <Briefing scope={scope} />
          {(scope === "family" || scope === userId) && <InboxCard />}
          <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
            <ThreeThings />
            <UpNext scope={scope} />
          </div>
          <Goals scope={scope} viewerId={userId} />
        </>
      )}
      {!loaded && <div className="text-center text-[13px] text-mut2">{t("loading")}</div>}
    </>
  );
}

function GettingStarted() {
  const t = useTranslations("t");
  const { steps, done } = useFreshSteps();
  const row = "flex min-h-[68px] w-full items-center gap-3.5 border-0 border-b border-line bg-transparent py-2.5 text-left text-ink last:border-b-0";

  return (
    <div data-screen-label="Getting started" className="flex flex-col gap-4">
      <section className="flex flex-col gap-3.5 rounded-[18px] bg-inv p-6 text-white">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[.16em] text-acc2">{t("f_eyebrow")}</span>
          <span className="font-mono text-xs font-bold text-white/60">
            {done} / {steps.length} {t("doneL")}
          </span>
        </div>
        <h2 className="m-0 font-serif text-[36px] font-normal leading-[1.15] tracking-[-0.01em] [text-wrap:pretty]">{t("f_title")}</h2>
        <p className="m-0 max-w-[560px] text-[14.5px] leading-normal text-white/75 [text-wrap:pretty]">{t("f_sub")}</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-acci transition-[width] duration-500" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
      </section>
      <section className="rounded-[18px] border border-line bg-card px-4 py-1.5">
        {steps.map((s, i) => {
          const inner = (
            <>
              <span
                className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full font-mono text-[13px] font-bold ${
                  s.done ? "bg-okbg text-ok" : "bg-soft2 text-mut"
                }`}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[15px] font-bold ${s.done ? "text-mut2 line-through" : "text-ink"}`}>{t(`s_${s.key}`)}</span>
                <span className="mt-[3px] block text-[12.5px] text-mut">{t(`s_${s.key}Sub`)}</span>
              </span>
              <span className="flex-none font-bold text-acct">→</span>
            </>
          );
          return "href" in s ? (
            <Link key={s.key} href={s.href} className={row}>
              {inner}
            </Link>
          ) : (
            <button key={s.key} onClick={s.go} className={row}>
              {inner}
            </button>
          );
        })}
      </section>
      <SampleDataButton />
    </div>
  );
}

function PersonFilter({ members, value, onChange }: { members: Member[]; value: string; onChange: (v: string) => void }) {
  const t = useTranslations("home");
  const family = t("family");
  const opts = [
    { id: "family", label: family, initial: family[0], bg: "var(--acc)", fg: "var(--onacc)" },
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
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-xs font-bold" style={{ background: o.bg, color: o.fg }}>
              {o.initial}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** The one number. Its stage comes first and stays put with reduced motion; the text beside it says the same. */
function Hero() {
  const aiName = useAiName();
  const t = useTranslations("home");
  const ui = useTranslations("ui");
  const { budget } = useMoney();
  const [stage, setStage] = useState(0);
  const hasBudget = budget.flexLimit > 0;
  const value = eur(budget.flexLeft, 0);
  const stages = useMemo<Stage[]>(() => [{ t: "text", s: value }, { t: "effi" }, { t: "tree" }], [value]);

  const note = !hasBudget
    ? t("no_budget")
    : budget.flexLeft < 0
      ? t("flex_over", { over: eur(-budget.flexLeft, 0) })
      : t("flex_note", { left: value, perDay: eur(budget.perDay, 0), days: budget.daysLeft });
  const views = [
    { title: t("flex_left"), sub: note, cta: t("cta_budget"), href: "/budget" },
    { title: aiName, sub: t("hero_ask_sub"), cta: t("hero_ask_cta", { name: aiName }), href: "/ask" },
    { title: ui("life_map"), sub: t("hero_map_sub"), cta: t("hero_map_cta"), href: "/map" },
  ];
  const view = views[stage] ?? views[0];

  return (
    <section data-screen-label="Particle hero" className="relative flex flex-wrap items-stretch overflow-hidden rounded-2xl border border-line bg-card text-ink">
      <div className="flex min-w-0 flex-[1_1_240px] flex-col justify-center gap-2 px-6 py-[22px]">
        <div className="eyebrow">{view.title}</div>
        <div className="min-h-[63px] text-[14.5px] leading-[1.45] text-acct [text-wrap:pretty]">{view.sub}</div>
        <div className="mt-2.5 flex">
          {views.map((v, i) => (
            <button
              key={v.href}
              onClick={() => setStage(i)}
              aria-label={t("hero_dot", { n: i + 1 })}
              aria-pressed={i === stage}
              className="-my-4 flex h-11 min-w-6 items-center justify-center border-0 bg-transparent p-0"
            >
              <span className={`block h-1.5 rounded-full transition-[width] duration-300 motion-reduce:transition-none ${i === stage ? "w-[22px] bg-acc" : "w-1.5 bg-line2"}`} />
            </button>
          ))}
        </div>
        <Link href={view.href} className="mt-1.5 flex min-h-11 items-center self-start whitespace-nowrap text-[13px] font-bold text-ink">
          {view.cta} →
        </Link>
      </div>
      <Link href={view.href} aria-label={view.cta} className="relative block h-[clamp(220px,30vw,320px)] min-w-0 flex-[3_1_420px] bg-card">
        <ParticleStages stages={stages} stage={stage} onStage={setStage} />
      </Link>
    </section>
  );
}

/** An alert's title and detail in the app's language. */
export function useAlertText() {
  const t = useTranslations("home");
  const dates = useDates();
  return (a: Alert) => {
    const m = a.msg;
    switch (m.code) {
      case "over":
        return { title: t("alert_over_title", m), meta: t("alert_over_meta", m), cta: t("open_budget") };
      case "near":
        return { title: t("alert_near_title", m), meta: t("alert_near_meta", m), cta: t("open_budget") };
      case "fast":
        return { title: t("alert_fast_title", m), meta: t("alert_fast_meta", m), cta: t("open_budget") };
      case "due":
        return { title: t("alert_due_title", m), meta: t("alert_due_meta", m), cta: t("open_recur") };
      case "bills":
        return { title: t("alert_bills_title", { date: dates.short(m.date), total: m.total }), meta: m.list, cta: t("open_budget") };
      case "ef":
        return { title: t("alert_ef_title", { months: m.months }), meta: t(m.low ? "alert_ef_low" : "alert_ef_meta", { rest: m.rest, target: m.target }), cta: t("open_budget") };
    }
  };
}

function AlertChip() {
  const t = useTranslations("home");
  const { alerts } = useMoney();
  const text = useAlertText();
  const open = alerts.filter((a) => a.sev !== "info");
  if (!open.length) return null;
  const top = open[0];
  return (
    <Link href="/alerts" className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-line bg-card px-3.5 py-2.5 text-left text-ink hover:border-line2">
      <span className={`h-2 w-2 flex-none rounded-full ${top.sev === "urgent" ? "bg-bad" : "bg-warn"}`} />
      <span className="min-w-0 flex-1 truncate text-sm font-bold">{text(top).title}</span>
      <span className="flex-none whitespace-nowrap text-[12.5px] font-bold text-mut">{t("alerts_n", { n: open.length })} →</span>
    </Link>
  );
}

function Briefing({ scope }: { scope: string }) {
  const aiName = useAiName();
  const t = useTranslations("home");
  const locale = useLocale();
  const money = useMoney();
  const { userId } = useAppData();
  const online = useOnline();
  const alertText = useAlertText();
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ai, setAi] = useState<{ key: string; answer: Answer } | null>(null);
  const [loading, setLoading] = useState(false);
  const hasData = money.transactions.length > 0 || money.incomes.length > 0;
  const day = money.today.iso;
  const slot = `${scope}-${locale}`;
  const key = `${slot}-${day}`;

  // Clopar writes the briefing once a day per view and language; it is kept on this phone.
  useEffect(() => {
    if (!userId || !hasData || money.today.y < 2026) return;
    const cached = loadBriefing(userId, slot, day);
    if (cached) {
      // Today's briefing saved on this phone.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAi({ key, answer: cached });
      return;
    }
    if (!online) return;
    let alive = true;
    setLoading(true);
    fetchBriefing(scope, locale).then(({ answer }) => {
      if (!alive) return;
      setLoading(false);
      if (answer) {
        saveBriefing(userId, slot, day, answer);
        setAi({ key, answer });
      }
    });
    return () => {
      alive = false;
    };
  }, [userId, scope, slot, day, key, locale, hasData, online, money.today.y]);

  const aiAnswer = ai?.key === key ? ai.answer : null;
  const { budget, alerts } = money;
  const top = alerts.find((a) => a.area === "money" && a.sev !== "info");
  const fallback = !hasData
    ? t("brief_empty")
    : [
        budget.flexLeft >= 0
          ? t("brief_flex", { spent: eur(budget.flexSpent), limit: eur(budget.flexLimit), left: eur(budget.flexLeft), perDay: eur(budget.perDay) })
          : t("brief_over", { over: eur(-budget.flexLeft), limit: eur(budget.flexLimit) }),
        top ? `${alertText(top).title}.` : "",
      ]
        .filter(Boolean)
        .join(" ");
  const text = aiAnswer?.text ?? fallback;

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
    u.lang = SPEECH[locale] ?? "en-GB";
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    synth.cancel();
    synth.speak(u);
    setPlaying(true);
  }

  return (
    <section className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-soft py-2.5 pl-4 pr-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex-none font-mono text-[11px] font-bold uppercase tracking-[.12em] text-mut">{aiName}</span>
        <span className={`min-w-0 flex-1 text-sm font-medium text-ink ${open ? "whitespace-normal leading-normal" : "truncate"}`}>
          {loading && !aiAnswer ? <span className="text-mut">{text}</span> : text}
        </span>
        <button onClick={() => setOpen((v) => !v)} className="flex-none whitespace-nowrap border-0 bg-transparent px-1.5 py-2 text-[12.5px] font-bold text-mut">
          {open ? t("less") : t("read_all")}
        </button>
        <button
          onClick={togglePlay}
          aria-label={playing ? t("stop") : t("listen")}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-line bg-card text-ink"
        >
          {playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
        </button>
      </div>
      {open && (
        <Link href="/ask" className="hit44 self-start pb-1 text-[12.5px] font-bold text-acct">
          {t("ask_more", { name: aiName })} →
        </Link>
      )}
    </section>
  );
}

function ThreeThings() {
  const t = useTranslations("home");
  const tt = useTranslations("t");
  const { alerts, closeAlert } = useMoney();
  const { steps } = useFreshSteps();
  const alertText = useAlertText();
  const [done, setDone] = useState<{ key: string; title: string; meta: string; href: string; cta: string }[]>([]);

  const fromAlerts = alerts.map((a) => ({ key: a.key, ...alertText(a), href: a.href, alert: true }));
  const fromSteps = steps
    .filter((s) => !s.done && "href" in s)
    .map((s) => ({ key: `step-${s.key}`, title: tt(`s_${s.key}`), meta: tt(`s_${s.key}Sub`), href: "href" in s ? s.href : "/", cta: t("open"), alert: false }));
  const open = [...fromAlerts, ...fromSteps].filter((x) => !done.some((d) => d.key === x.key));
  const items = [...done.map((d) => ({ ...d, isDone: true, alert: true })), ...open.map((o) => ({ ...o, isDone: false }))].slice(0, 3);

  return (
    <section className="rounded-[18px] border border-line bg-card p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="m-0 text-lg font-bold tracking-[-0.01em]">{t("things")}</h2>
        <span className="text-xs font-bold text-mut2">{t("things_done", { n: done.length })}</span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((x) => (
          <div key={x.key} className="flex items-start gap-3 rounded-[10px] bg-soft p-3">
            {x.alert ? (
              <button
                onClick={() => {
                  if (x.isDone) return;
                  setDone((d) => [...d, x]);
                  closeAlert(x.key, "done");
                }}
                aria-label={x.isDone ? t("done") : t("mark_done", { title: x.title })}
                className={`mt-px flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[9px] border-2 text-white ${
                  x.isDone ? "border-ok bg-ok" : "border-line2 bg-card"
                }`}
              >
                {x.isDone && <Check size={14} strokeWidth={3} />}
              </button>
            ) : (
              <span className="mt-px h-[26px] w-[26px] flex-none rounded-[9px] border-2 border-dashed border-line2" />
            )}
            <div className="min-w-0 flex-1">
              <div className={`text-[14.5px] font-bold leading-[1.35] ${x.isDone ? "text-mut2 line-through" : "text-ink"}`}>{x.title}</div>
              <div className="mt-[3px] text-[12.5px] text-mut">{x.meta}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-acc px-[9px] py-[3px] text-[11px] font-bold text-onacc">{t("family")}</span>
                <Link href={x.href} className="hit44 whitespace-nowrap py-1 text-[12.5px] font-bold text-acct">
                  {x.cta} →
                </Link>
              </div>
            </div>
          </div>
        ))}
        {!items.length && <EmptyNote>{t("things_none")}</EmptyNote>}
      </div>
    </section>
  );
}

/** The next three days with something on them, or the next three days if the week is empty. */
function UpNext({ scope }: { scope: string }) {
  const t = useTranslations("home");
  const { members } = useAppData();
  const { today } = useMoney();
  const { events } = useTime();
  const dates = useDates();
  if (today.y < 2026) return null; // wait for the real date

  // A person view keeps their own items and Together plans.
  const mine = (e: CalEvent) => {
    if (scope === "family") return true;
    const who = e.kind === "shift" ? e.owner_id : e.who;
    return who === scope || who === null;
  };
  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(today.iso, i);
    return { iso, i, list: dayEvents(events, iso).filter(mine) };
  });
  const busy = days.filter((d) => d.list.length);
  const shown = (busy.length ? busy : days).slice(0, 3);

  return (
    <section data-screen-label="Up next" className="flex flex-col gap-1 rounded-[18px] border border-line bg-card p-5">
      <div className="mb-2 flex items-baseline justify-between gap-2.5">
        <h2 className="m-0 text-lg font-bold tracking-[-0.01em]">{t("up_next")}</h2>
        <Link href="/week" className="hit44 whitespace-nowrap py-2 text-[12.5px] font-bold text-mut">
          {t("whole_week")} →
        </Link>
      </div>
      {shown.map((d) => (
        <Link
          key={d.iso}
          href="/week"
          className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-3 border-t border-line py-3 text-left text-ink hover:bg-soft"
        >
          <div className="pt-[3px]">
            <div className={`font-mono text-[12.5px] font-bold ${d.i === 0 ? "text-acct" : "text-ink"}`}>
              {dates.dow(d.iso)} {Number(d.iso.slice(8))}
            </div>
            {d.i < 2 && <div className="text-[11px] text-mut2">{t(d.i === 0 ? "today" : "tomorrow")}</div>}
          </div>
          <div className="flex flex-col gap-1.5">
            {d.list.map((e) => (
              <span key={e.id} className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                <span className="h-[7px] w-[7px] flex-none rounded-[2px]" style={{ background: whoColors(members, e.kind === "shift" ? e.owner_id : e.who).bg }} aria-hidden />
                <span className="flex-none font-mono text-xs text-mut">{e.start_time ? hm(e.start_time) : t("all_day")}</span>
                <span className="min-w-0 truncate">{e.title}</span>
                {e.visibility === "private" && <PrivateMark />}
              </span>
            ))}
            {!d.list.length && <span className="py-0.5 text-[13px] text-mut2">{t("nothing_planned")}</span>}
          </div>
        </Link>
      ))}
    </section>
  );
}

function Goals({ scope, viewerId }: { scope: string; viewerId: string }) {
  const t = useTranslations("home");
  const { goals } = useMoney();
  const { openForm } = useMoneyForms();
  const shared = goals.filter((g) => g.visibility === "family" && (scope === "family" || g.owner_id === scope));
  const mine = goals.filter((g) => g.visibility === "private" && g.owner_id === viewerId && (scope === "family" || scope === viewerId));
  const monthly = shared.reduce((a, g) => a + g.monthly, 0);

  return (
    <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
      <section className="rounded-[18px] border border-line bg-card p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="m-0 text-lg font-bold tracking-[-0.01em]">{t("shared_goals")}</h2>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-mut2">{t("per_month", { amount: eur(monthly) })}</span>
            <AddButton onClick={() => openForm("goal", undefined, { visibility: "family" })} />
          </div>
        </div>
        <div className="flex flex-col gap-3.5">
          {shared.map((g) => (
            <GoalRow key={g.id} goal={g} onClick={() => openForm("goal", g.id)} />
          ))}
          {!shared.length && <EmptyNote>{t("add_goal_note")}</EmptyNote>}
        </div>
      </section>
      {mine.length > 0 && (
        <section className="rounded-[18px] border border-dashed border-line bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Lock size={15} strokeWidth={2} className="text-acct" />
            <h2 className="m-0 text-lg font-bold tracking-[-0.01em]">{t("private_goals")}</h2>
            <span className="ml-auto text-xs font-bold text-mut2">{t("only_you")}</span>
          </div>
          <div className="flex flex-col gap-3.5">
            {mine.map((g) => (
              <GoalRow key={g.id} goal={g} onClick={() => openForm("goal", g.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GoalRow({ goal, onClick }: { goal: Goal; onClick: () => void }) {
  const t = useTranslations("home");
  const { today } = useMoney();
  const dates = useDates();
  const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
  const eta = goalEta(goal);
  const rate = goal.monthly ? t("per_month", { amount: eur(goal.monthly) }) : null;
  const meta = goal.is_emergency_fund
    ? [t("goal_saved", { current: eur(goal.current) }), rate, t("goal_see_budget")]
    : [t("goal_of", { current: eur(goal.current), target: eur(goal.target) }), rate, eta === 0 ? t("goal_reached") : Number.isFinite(eta) ? dates.addMonths(today, eta) : null];
  return (
    <button onClick={onClick} className="-m-1.5 flex items-center gap-3 rounded-[10px] border-0 bg-transparent p-1.5 text-left hover:bg-soft">
      <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[13px] bg-tint text-ink">
        <AppIcon name={goal.icon} size={21} strokeWidth={1.7} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-bold text-ink">{goal.name}</span>
          {!goal.is_emergency_fund && <span className="text-sm font-bold text-acct">{pct}%</span>}
        </div>
        {!goal.is_emergency_fund && (
          <div className="mt-1.5">
            <ProgressBar pct={pct} />
          </div>
        )}
        <div className="mt-1 text-xs text-mut2">{meta.filter(Boolean).join(" · ")}</div>
      </div>
    </button>
  );
}
