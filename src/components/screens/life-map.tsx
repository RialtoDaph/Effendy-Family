"use client";

import { Keyboard, Maximize, Mic, RotateCw, Volume2, VolumeX, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useAiName, useAppData } from "@/components/app-data";
import { useAssistant } from "@/components/assistant";
import { ConfirmCard } from "@/components/assistant-card";
import { Clopar } from "@/components/clopar";
import { ScreenEmpty } from "@/components/empty-state";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useTime } from "@/components/time-data";
import { buildMap, HUBS, type MapGraph, type MapNode } from "@/lib/life-map";
import { createLifeMapScene, type LifeMapScene } from "@/lib/life-map-scene";
import { lifeScore, scoreState, type LifeScore, type PillarKey, type ScoreLine } from "@/lib/life-score";
import { eur } from "@/lib/money";
import { supabase } from "@/lib/supabase";
import { useDates } from "@/lib/use-dates";
import { useErrorText } from "./ask";
import { useFreshSteps } from "./home";

const OPEN: Record<PillarKey, string> = { money: "/budget", time: "/week", health: "/gym", goals: "/ygoals" };
const DOT = { ok: "var(--ok)", warn: "var(--warn)", bad: "var(--bad)", neu: "var(--mut2)", acc: "var(--acc)" };
const CONFIRM_MS = 1400;
const noop = () => () => {};

export function LifeMapScreen() {
  const t = useTranslations("home");
  const label = useTranslations("ui");
  const { fresh } = useFreshSteps();
  const { openForm } = useMoneyForms();
  if (fresh) return <ScreenEmpty eyebrow={label("life_map")} title={t("map_empty")} action={t("map_empty_action")} onAction={() => openForm("income")} />;
  return <LifeMap />;
}

function useLifeData() {
  const t = useTranslations("home");
  const tt = useTranslations("t");
  const { members, userId, settings } = useAppData();
  const money = useMoney();
  const time = useTime();
  const { debts } = useFinance();
  const dates = useDates();

  const score = useMemo(
    () =>
      lifeScore({
        today: money.today,
        budget: money.budget,
        ef: money.ef,
        goals: money.goals,
        yearlyGoals: time.yearlyGoals,
        events: time.events,
        people: members.map((m) => m.id),
        viewerId: userId,
        priorities: time.priorities,
        learningMinutes: time.learningMinutes,
        gym: time.gym,
        gymGoal: settings?.gym_week_goal ?? 3,
      }),
    [money.today, money.budget, money.ef, money.goals, time.yearlyGoals, time.events, time.priorities, time.learningMinutes, time.gym, members, userId, settings?.gym_week_goal],
  );

  const graph = useMemo(
    () =>
      buildMap({
        score,
        viewerId: userId,
        today: money.today,
        subscriptions: money.recurring.filter((r) => r.is_subscription),
        debts,
        categories: money.categories,
        transactions: money.transactions.filter((x) => x.visibility === "family"),
        goals: money.goals,
        events: time.events,
        learning: time.learningItems,
        gym: time.gym,
        text: {
          hub: (k) => tt(`p_${k}`),
          coreLabel: tt("k_core"),
          score: t("f_score"),
          perMonth: t("f_month"),
          balance: t("f_balance"),
          rate: t("f_rate"),
          spent: t("f_spent"),
          saved: t("f_saved"),
          progress: t("f_progress"),
          when: t("f_when"),
          eur: (n) => eur(n, 0),
          day: dates.day,
        },
      }),
    [score, userId, money.today, money.recurring, money.categories, money.transactions, money.goals, debts, time.events, time.learningItems, time.gym, t, tt, dates],
  );
  return { score, graph };
}

function LifeMap() {
  const t = useTranslations("home");
  const tt = useTranslations("t");
  const ui = useTranslations("ui");
  const router = useRouter();
  const { openForm } = useMoneyForms();
  const { score, graph } = useLifeData();

  const stage = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const scene = useRef<LifeMapScene | null>(null);
  const latestGraph = useRef<MapGraph>(graph);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const reduced = useSyncExternalStore(noop, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  const [spinChoice, setSpin] = useState<boolean | null>(null);
  const spin = spinChoice ?? !reduced;
  const [talking, setTalking] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let alive = true;
    createLifeMapScene(stage.current!, labels.current!, setSelected)
      .then((s) => {
        if (!alive) return s.dispose();
        scene.current = s;
        s.setGraph(latestGraph.current);
      })
      .catch(() => alive && setFailed(true));
    // The scene takes its colours from the tokens, so it follows the theme and palette.
    const watch = new MutationObserver(() => scene.current?.repaint());
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-palette"] });
    return () => {
      alive = false;
      watch.disconnect();
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    latestGraph.current = graph;
    scene.current?.setGraph(graph);
  }, [graph]);
  useEffect(() => scene.current?.setSelected(selected), [selected]);
  useEffect(() => scene.current?.setSpin(spin), [spin]);

  // The map belongs to Life Plus and Together. Plans themselves arrive in Phase 7.
  useEffect(() => {
    supabase()
      .from("subscriptions_billing")
      .select("plan")
      .maybeSingle()
      .then(({ data }) => setLocked(data?.plan === "life"));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog]")) router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const node = graph.nodes.find((n) => n.id === selected);
  const topic = node ? node.label : HUBS.map((k) => tt(`p_${k}`)).join(", ");
  const question = tt("mapAsk").replace("{x}", topic);

  return (
    <section
      data-screen-label="Life Map"
      className="fixed inset-0 z-[55] overflow-hidden"
      style={{ background: "radial-gradient(circle at 50% 46%, var(--tint) 0%, var(--bg) 64%) var(--bg)" }}
    >
      <div ref={stage} className="absolute inset-0 cursor-grab">
        <div ref={labels} className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" />
      </div>

      <div className="pointer-events-none absolute inset-x-3 top-[calc(env(safe-area-inset-top)+12px)] z-[2] flex items-start justify-between gap-2">
        <div className="pointer-events-auto flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2 self-start rounded-full border border-line bg-card py-[5px] pl-[5px] pr-3.5 shadow-[0_4px_16px_rgba(0,0,0,.06)]">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-acc text-[12.5px] font-bold text-onacc">{score.total ?? "—"}</span>
            <h1 className="m-0 whitespace-nowrap text-[13px] font-bold">{ui("life_map")}</h1>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {score.pillars.map((p) => {
              const on = selected === `h-${p.k}`;
              return (
                <button
                  key={p.k}
                  onClick={() => setSelected(on ? null : `h-${p.k}`)}
                  aria-pressed={on}
                  className={`flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] bg-card px-3 text-[12.5px] font-bold text-ink ${on ? "border-acc" : "border-line"}`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: DOT[scoreState(p.score)] }} />
                  {tt(`p_${p.k}`)}
                  <span className="font-mono text-[11.5px] text-mut2">{p.score ?? "—"}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="pointer-events-auto flex flex-none gap-1 rounded-xl border border-line bg-card p-1">
          <Link href="/" aria-label={t("map_close")} title={t("map_close")} className="hit44 flex h-9 w-9 items-center justify-center rounded-lg bg-soft2 text-ink">
            <X size={16} strokeWidth={2.2} />
          </Link>
          <button
            onClick={() => {
              scene.current?.fit();
              setSelected(null);
            }}
            aria-label={tt("mapFit")}
            title={tt("mapFit")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border-0 bg-transparent text-ink"
          >
            <Maximize size={17} strokeWidth={2} />
          </button>
          <button
            onClick={() => setSpin(!spin)}
            aria-label={tt("mapSpin")}
            aria-pressed={spin}
            title={tt("mapSpin")}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border-0 ${spin ? "bg-tint text-acct" : "bg-transparent text-mut"}`}
          >
            <RotateCw size={17} strokeWidth={2} />
          </button>
        </div>
      </div>

      {failed && <p className="absolute inset-x-6 top-1/2 z-[2] m-0 -translate-y-1/2 text-center text-sm text-mut">{t("map_failed")}</p>}

      <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+14px)] left-3.5 right-[118px] z-[2] flex flex-col gap-1.5">
        {!talking && !node && <div className="text-xs text-mut2">{tt("mapHint")}</div>}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] font-bold text-mut">
          {(["ok", "warn", "bad"] as const).map((k) => (
            <span key={k} className="flex items-center gap-[5px]">
              <span className="h-2 w-2 rounded-full" style={{ background: DOT[k] }} />
              {tt(k === "ok" ? "mapOk" : k === "warn" ? "mapWarn" : "mapBad")}
            </span>
          ))}
        </div>
      </div>

      {node && !talking && (
        <Panel
          node={node}
          score={score}
          onClose={() => setSelected(null)}
          onEdit={(act) => openForm(act[0] as Parameters<typeof openForm>[0], act[1])}
          onAsk={() => setTalking(true)}
        />
      )}

      <Corner open={talking} onOpen={() => setTalking(true)} onClose={() => setTalking(false)} question={question} />

      {locked && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center p-5 backdrop-blur-[7px]">
          <div className="flex max-w-[380px] flex-col gap-3 rounded-[14px] border border-line bg-card p-[22px] shadow-[0_20px_50px_rgba(0,0,0,.18)]">
            <span className="self-start rounded-full bg-tint px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[.12em] text-acct">Life Plus</span>
            <div className="text-xl font-bold leading-[1.25]">{tt("mapUnlock")}</div>
            <div className="text-[13.5px] leading-normal text-mut">{tt("mapUnlockSub")}</div>
            <Link href="/plan" className="flex min-h-12 items-center justify-center rounded-full bg-acc text-sm font-bold text-onacc hover:text-onacc">
              {t("unlock")}
            </Link>
            <Link href="/" className="flex min-h-11 items-center justify-center text-[13px] font-bold text-mut">
              {ui("back_home")}
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

function useScoreLine() {
  const t = useTranslations("home");
  return (l: ScoreLine) => {
    switch (l.key) {
      case "flex":
        return t("line_flex", { pct: l.pct });
      case "ef":
        return t("line_ef", { months: l.months, target: l.target });
      case "evenings":
        return t("line_evenings", { n: l.n });
      case "focus":
        return t("line_focus", { done: l.done, total: l.total });
      case "learn":
        return t("line_learn", { minutes: l.minutes });
      case "gym":
        return t("line_gym", { done: l.done, goal: l.goal });
      case "goals":
        return t("line_goals", { done: l.done, total: l.total });
      case "yearly":
        return t("line_yearly", { done: l.done, total: l.total });
    }
  };
}

function Panel({
  node,
  score,
  onClose,
  onEdit,
  onAsk,
}: {
  node: MapNode;
  score: LifeScore;
  onClose: () => void;
  onEdit: (act: [string, string]) => void;
  onAsk: () => void;
}) {
  const aiName = useAiName();
  const t = useTranslations("home");
  const tt = useTranslations("t");
  const lineText = useScoreLine();
  const lines = node.kind === "hub" ? (score.pillars.find((p) => p.k === node.hub)?.lines ?? []) : [];
  const pill = "flex min-h-10 items-center rounded-full px-3.5 text-[13px] font-bold";

  return (
    <div className="absolute bottom-11 left-3 right-[104px] z-[3] flex max-h-[58%] max-w-[320px] flex-col gap-2.5 overflow-y-auto rounded-[14px] border border-line bg-card p-3.5 shadow-[0_14px_40px_rgba(0,0,0,.16)] min-[701px]:bottom-auto min-[701px]:left-auto min-[701px]:right-3 min-[701px]:top-[110px] min-[701px]:w-[300px]">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: DOT[node.st] }} />
        <span className="flex-1 font-mono text-[11px] font-bold uppercase tracking-[.14em] text-mut2">{tt(`k_${node.kind}`)}</span>
        <button onClick={onClose} aria-label={t("close")} className="flex h-8 w-8 items-center justify-center rounded-full border-0 bg-soft2 text-ink">
          <X size={14} strokeWidth={2.4} />
        </button>
      </div>
      <div className="text-[19px] font-bold leading-[1.2] tracking-[-0.01em]">{node.label}</div>
      <div className="flex flex-wrap gap-1.5">
        {node.kind === "hub" && (
          <Link href={OPEN[node.hub!]} className={`hit44 ${pill} border border-line bg-card text-ink`}>
            {tt("mapOpen")}
          </Link>
        )}
        {node.act && (
          <button onClick={() => onEdit(node.act!)} className={`${pill} border border-line bg-card text-ink`}>
            {tt("mapEdit")}
          </button>
        )}
        <button onClick={onAsk} className={`${pill} border-0 bg-acc text-onacc`}>
          {tt("mapAskL")} {aiName}
        </button>
      </div>
      <div>
        {node.fields.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-line py-[7px] text-[13px]">
            <span className="text-mut">{k}</span>
            <span className="text-right font-bold">{v}</span>
          </div>
        ))}
        {lines.map((l) => (
          <div key={l.key} className="flex gap-2 border-b border-line py-[7px] text-[13px]">
            <span className={l.good ? "text-ok" : "text-bad"}>{l.good ? "▲" : "▼"}</span>
            <span className="font-medium">{lineText(l)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Clopar in the corner: tap, it grows where it stands, listens, thinks, answers in a
 * short caption, smiles, and shrinks back. It never reaches the middle of the map.
 * The mode comes straight from the realtime session events.
 */
function Corner({ open, onOpen, onClose, question }: { open: boolean; onOpen: () => void; onClose: () => void; question: string }) {
  const aiName = useAiName();
  const t = useTranslations("assistant");
  const errorText = useErrorText();
  const { talk, caption, busy, voiceOn, muted, error, pendingCard: card, send, startVoice, stop, setMuted } = useAssistant();
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const asked = useRef(false);

  // Opening starts listening. Without a microphone or minutes it falls back to the
  // question about what the map is showing, as text.
  useEffect(() => {
    if (open && !asked.current) {
      void startVoice().then((ok) => {
        if (!ok) void send(question);
      });
    }
    asked.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    stop();
    setTyping(false);
    setDraft("");
    onClose();
  }

  // Shrinks back once the answer is done and nothing is waiting on a card.
  const idle = open && !voiceOn && !busy && !typing && !card && (talk.mode === "calm" || talk.mode === "speak") && !error;
  useEffect(() => {
    if (!idle) return;
    const timer = setTimeout(close, Math.max(3000, caption.length * 65) + CONFIRM_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idle, caption]);

  function submit() {
    const q = draft.trim();
    if (!q) return;
    setDraft("");
    setTyping(false);
    void send(q);
  }

  const round = "flex h-10 w-10 items-center justify-center rounded-full border-0 bg-soft2 text-ink";
  const line = error ? errorText(error) : caption;

  return (
    <div
      data-screen-label="Map talk"
      className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+14px)] right-3.5 z-[4] flex max-w-[calc(100%-28px)] flex-col items-end gap-1"
    >
      {open && card && (
        <div className="mb-1 flex w-[min(320px,calc(100vw-28px))]">
          <ConfirmCard card={card} />
        </div>
      )}
      {open && line && (
        <p
          aria-live="polite"
          className="m-0 mr-1.5 line-clamp-2 max-w-[300px] text-right text-[17px] font-light leading-[1.35] text-ink [text-shadow:0_1px_12px_var(--bg),0_0_2px_var(--bg)] [text-wrap:balance]"
        >
          {line}
        </p>
      )}
      {typing && (
        <div className="pointer-events-auto flex w-[min(280px,calc(100vw-28px))] items-center gap-1 rounded-full border border-line bg-card py-[3px] pl-3.5 pr-[3px]">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={t("type_to", { name: aiName })}
            className="h-[38px] min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none"
          />
          <button onClick={submit} aria-label={t("send")} className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full border-0 bg-acc font-bold text-onacc">
            ↑
          </button>
        </div>
      )}
      <button
        onClick={() => (open ? void startVoice() : onOpen())}
        aria-label={aiName}
        className={`pointer-events-auto border-0 bg-transparent p-0 transition-[width,height] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ${
          open ? "h-[min(220px,46vw)] w-[min(220px,46vw)]" : "h-24 w-24"
        }`}
      >
        <span className="relative block h-full w-full">
          <Clopar variant="map" mode={talk.mode} />
        </span>
      </button>
      {!open && <span className="mr-[22px] text-[11px] font-bold uppercase tracking-[.14em] text-mut">{aiName}</span>}
      {open && (
        <div className="pointer-events-auto mr-1.5 flex gap-1.5">
          <button
            onClick={() => (voiceOn ? stop() : void startVoice())}
            aria-label={t(voiceOn ? "voice_stop" : "voice_start")}
            aria-pressed={voiceOn}
            className={voiceOn ? "flex h-10 w-10 items-center justify-center rounded-full border-0 bg-acc text-onacc" : round}
          >
            <Mic size={17} strokeWidth={2} />
          </button>
          <button onClick={() => setTyping((v) => !v)} aria-label={t("type_instead")} className={round}>
            <Keyboard size={17} strokeWidth={2} />
          </button>
          <button onClick={() => setMuted(!muted)} aria-label={t(muted ? "unmute" : "mute")} aria-pressed={muted} className={round}>
            {muted ? <VolumeX size={17} strokeWidth={2} /> : <Volume2 size={17} strokeWidth={2} />}
          </button>
          <button onClick={close} aria-label={t("close")} className={round}>
            <X size={15} strokeWidth={2.2} />
          </button>
        </div>
      )}
    </div>
  );
}
