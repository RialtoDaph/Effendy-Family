"use client";

import { useLocale, useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAppData } from "@/components/app-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useTime } from "@/components/time-data";
import { useToast } from "@/components/toast";
import { askClopar } from "@/lib/ask";
import type { AskAction } from "@/lib/ask-schema";
import { authedPost, connectRealtime, runAssistantTool, type Realtime, type SessionInfo } from "@/lib/assistant-client";
import { firstSentence, functionCalls, TALK_START, talkStep, type FunctionCall, type Talk } from "@/lib/assistant-events";
import type { Card, CardStatus } from "@/lib/assistant-tools";
import { supabase } from "@/lib/supabase";

export type Turn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  nums?: { label: string; value: string }[];
  next?: string | null;
  action?: AskAction;
  card?: Card;
};
export type AssistantError = "voice_quota" | "ai_quota" | "not_configured" | "mic" | "failed" | null;
type Live = { rt: Realtime; info: SessionInfo & { spoken: boolean }; voice: boolean; turns: { role: string; text: string }[]; tools: string[]; timer?: ReturnType<typeof setTimeout> };

type Assistant = {
  turns: Turn[];
  /** The card this session is waiting on. */
  pendingCard: Card | null;
  talk: Talk;
  /** One or two lines for under the character. */
  caption: string;
  busy: boolean;
  connecting: boolean;
  voiceOn: boolean;
  muted: boolean;
  error: AssistantError;
  quota: { voiceLeft: number | null; aiLeft: number | null };
  send: (text: string) => Promise<void>;
  startVoice: () => Promise<boolean>;
  stop: () => void;
  setMuted: (on: boolean) => void;
  answerCard: (card: Card, action: "save" | "undo", text?: string) => Promise<void>;
  editCard: (card: Card) => void;
  clear: () => Promise<void>;
};

const Ctx = createContext<Assistant | null>(null);
const CONFIRM_MS = 1400;
const IDLE_MS = 5 * 60 * 1000;
const newId = () => crypto.randomUUID();

export function useAssistant() {
  const a = useContext(Ctx);
  if (!a) throw new Error("useAssistant needs AssistantProvider");
  return a;
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("assistant");
  const locale = useLocale();
  const toast = useToast();
  const { userId } = useAppData();
  const money = useMoney();
  const time = useTime();
  const { openForm } = useMoneyForms();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [pendingCard, setPendingCard] = useState<Card | null>(null);
  const [talk, setTalkState] = useState<Talk>(TALK_START);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [error, setError] = useState<AssistantError>(null);
  const [quota, setQuota] = useState<Assistant["quota"]>({ voiceLeft: null, aiLeft: null });

  const talkRef = useRef(TALK_START);
  const live = useRef<Live | null>(null);
  const mutedRef = useRef(false);
  const handler = useRef<(e: { type: string }) => void>(() => {});

  const setTalk = useCallback((next: Talk) => {
    talkRef.current = next;
    setTalkState(next);
  }, []);

  // Chat history lives in ai_messages: own rows only, pruned after 90 days.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const sb = supabase();
      const { data } = await sb.from("ai_messages").select("id,role,text,cards").order("created_at", { ascending: false }).limit(100);
      const rows = ((data ?? []) as { id: string; role: Turn["role"]; text: string; cards: Partial<Turn> | null }[]).reverse();
      const loaded: Turn[] = rows.map((r) => ({ id: r.id, role: r.role, text: r.text, ...r.cards }));
      const ids = loaded.flatMap((x) => (x.card ? [x.card.id] : []));
      if (ids.length) {
        const { data: states } = await sb.from("ai_pending_actions").select("id,status").in("id", ids);
        const by = new Map(((states ?? []) as { id: string; status: CardStatus }[]).map((s) => [s.id, s.status]));
        for (const x of loaded) if (x.card) x.card = { ...x.card, status: by.get(x.card.id) ?? x.card.status };
      }
      if (alive) setTurns(loaded);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const addTurn = useCallback((turn: Omit<Turn, "id">) => {
    const row: Turn = { id: newId(), ...turn };
    setTurns((x) => [...x, row]);
    const { nums, next, action, card } = row;
    void supabase().from("ai_messages").insert({ role: row.role, text: row.text, cards: { nums, next, action, card } });
    if (live.current) live.current.turns.push({ role: row.role, text: row.text });
    return row;
  }, []);

  const stop = useCallback(() => {
    const s = live.current;
    live.current = null;
    setPendingCard(null);
    setVoiceOn(false);
    setBusy(false);
    setTalk(TALK_START);
    if (!s) return;
    clearTimeout(s.timer);
    s.rt.close();
    void authedPost("/api/assistant/end", { session_id: s.info.session_id, turns: s.turns, tools: s.tools, voice: s.voice }, true);
  }, [setTalk]);

  const touch = useCallback(
    (ms = IDLE_MS) => {
      const s = live.current;
      if (!s) return;
      clearTimeout(s.timer);
      s.timer = setTimeout(stop, ms);
    },
    [stop],
  );

  const open = useCallback(
    async (voice: boolean) => {
      setConnecting(true);
      setError(null);
      const res = await authedPost<SessionInfo & { spoken: boolean; code?: string }>("/api/assistant/session", { mode: voice ? "voice" : "text", locale });
      if (!res.ok || !res.data?.token) {
        setConnecting(false);
        return { ok: false as const, code: (res.data?.code ?? "failed") as Exclude<AssistantError, null> };
      }
      const info = res.data;
      setQuota({ voiceLeft: info.voice_left, aiLeft: info.ai_left });
      try {
        const rt = await connectRealtime(info.token, voice, (e) => handler.current(e), stop);
        rt.setMuted(mutedRef.current);
        live.current = { rt, info, voice, turns: [], tools: [] };
        setConnecting(false);
        // A voice session ends when the month's minutes do.
        touch(voice ? Math.min(info.voice_left * 1000, 60 * 60 * 1000) : IDLE_MS);
        return { ok: true as const };
      } catch (e) {
        setConnecting(false);
        void authedPost("/api/assistant/end", { session_id: info.session_id });
        return { ok: false as const, code: (e instanceof DOMException ? "mic" : "failed") as Exclude<AssistantError, null> };
      }
    },
    [locale, stop, touch],
  );

  const runCalls = useCallback(
    async (calls: FunctionCall[]) => {
      for (const c of calls) {
        const s = live.current;
        if (!s) return;
        s.tools.push(c.name);
        const res = await runAssistantTool(s.info.session_id, c.name, c.arguments);
        if (res.data?.card) {
          addTurn({ role: "assistant", text: "", card: res.data.card });
          setPendingCard(res.data.card);
        }
        s.rt.send({
          type: "conversation.item.create",
          item: { type: "function_call_output", call_id: c.call_id, output: JSON.stringify(res.data?.output ?? { error: "Tool failed." }) },
        });
      }
      live.current?.rt.send({ type: "response.create" });
    },
    [addTurn],
  );

  useEffect(() => {
    handler.current = (e) => {
      const event = e as Parameters<typeof talkStep>[1];
      const before = talkRef.current;
      const s = live.current;
      setTalk(talkStep({ ...before, live: !!s?.voice }, event));
      if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript?.trim()) {
        addTurn({ role: "user", text: event.transcript.trim() });
      }
      if (event.type === "error") {
        setError("failed");
        setBusy(false);
      }
      if (event.type !== "response.done") return;
      const calls = functionCalls(event);
      if (calls.length) return void runCalls(calls);
      setBusy(false);
      const reply = talkRef.current.reply.trim();
      if (reply) addTurn({ role: "assistant", text: reply });
      if (s && !s.voice) touch();
      if (s && !s.info.spoken) setTalk({ ...talkRef.current, mode: s.voice ? "listen" : "calm" });
    };
  }, [addTurn, runCalls, setTalk, touch]);

  const startVoice = useCallback(async () => {
    if (live.current?.voice) return true;
    stop();
    const res = await open(true);
    if (!res.ok) {
      setError(res.code);
      return false;
    }
    setVoiceOn(true);
    setTalk({ ...TALK_START, mode: "listen", live: true });
    return true;
  }, [open, setTalk, stop]);

  const send = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q || busy) return;
      setError(null);
      const history = turns.filter((x) => x.text).map((x) => ({ role: x.role, text: x.text }));
      addTurn({ role: "user", text: q });
      setBusy(true);
      setTalk({ ...TALK_START, mode: "think", live: !!live.current?.voice });

      if (!live.current) {
        const res = await open(false);
        if (!res.ok && res.code !== "not_configured") {
          setBusy(false);
          setTalk(TALK_START);
          return setError(res.code);
        }
      }
      const s = live.current;
      if (s) {
        const { data: left, error: used } = await supabase().rpc("ai_message_used");
        if (used?.message.includes("ai_quota")) {
          setBusy(false);
          setTalk(TALK_START);
          setQuota((v) => ({ ...v, aiLeft: 0 }));
          return setError("ai_quota");
        }
        if (typeof left === "number") setQuota((v) => ({ ...v, aiLeft: left }));
        s.rt.send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: q }] } });
        s.rt.send({ type: "response.create" });
        return;
      }

      // No realtime key yet: answer through /api/ask. It reads, it never writes.
      const { answer, error: failed } = await askClopar(q, history);
      setBusy(false);
      if (!answer) {
        setTalk(TALK_START);
        return setError(failed === "quota" ? "ai_quota" : "failed");
      }
      addTurn({ role: "assistant", text: answer.text, nums: answer.nums, next: answer.next, action: answer.action });
      setTalk({ ...TALK_START, mode: "speak", reply: answer.text });
    },
    [addTurn, busy, open, setTalk, turns],
  );

  const setCard = useCallback((id: string, status: CardStatus) => {
    setTurns((x) => x.map((row) => (row.card?.id === id ? { ...row, card: { ...row.card, status } } : row)));
    setPendingCard((c) => (c?.id === id ? null : c));
  }, []);

  const tell = useCallback((note: string) => {
    live.current?.rt.send({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text", text: note }] } });
  }, []);

  const answerCard = useCallback(
    async (card: Card, action: "save" | "undo", text?: string) => {
      // An unsaved card is simply dismissed.
      const verb = action === "undo" && card.status === "pending" ? "skip" : action;
      const res = await authedPost<{ ok?: boolean }>("/api/assistant/confirm", { id: card.id, action: verb, text });
      if (!res.ok) return toast(t("card_failed"));
      setCard(card.id, verb === "save" ? "saved" : verb === "skip" ? "skipped" : "undone");
      if (verb === "skip") return tell("The person dismissed the card; nothing was saved.");
      await Promise.all([money.reload(), time.reload()]);
      if (verb === "undo") return tell("The person undid the saved card.");
      tell("The person saved the card.");
      const back = talkRef.current;
      setTalk({ ...back, mode: "confirm" });
      setTimeout(() => {
        if (talkRef.current.mode === "confirm") setTalk({ ...talkRef.current, mode: back.live ? "listen" : "calm" });
      }, CONFIRM_MS);
    },
    [money, setCard, setTalk, t, tell, time, toast],
  );

  const editCard = useCallback(
    (card: Card) => {
      const a = card.args as Record<string, string | number | null>;
      const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
      if (card.kind === "transaction") {
        const amount = Number(a.amount);
        openForm("tx", undefined, { kind: amount < 0 ? "out" : "in", amount: String(Math.abs(amount)), payee: str(a.payee), category: str(a.category_id), date: str(a.date), visibility: str(a.visibility) });
      } else if (card.kind === "event") {
        openForm("event", undefined, { title: str(a.title), date: str(a.date), start: str(a.time), visibility: str(a.visibility) });
      } else if (card.kind === "goal") {
        openForm("goal", undefined, { name: str(a.name), target: str(a.target), monthly: str(a.monthly), visibility: str(a.visibility) });
      }
      // The form saves it now, so the card is done.
      void authedPost("/api/assistant/confirm", { id: card.id, action: "skip" });
      setCard(card.id, "skipped");
    },
    [openForm, setCard],
  );

  const setMuted = useCallback((on: boolean) => {
    mutedRef.current = on;
    setMutedState(on);
    live.current?.rt.setMuted(on);
  }, []);

  const clear = useCallback(async () => {
    setTurns([]);
    await supabase().from("ai_messages").delete().eq("member_id", userId);
  }, [userId]);

  // Close properly when the page goes away, so the minutes and memories are booked.
  useEffect(() => {
    window.addEventListener("pagehide", stop);
    return () => window.removeEventListener("pagehide", stop);
  }, [stop]);

  const caption =
    talk.mode === "think" ? t("thinking") : talk.mode === "listen" ? talk.heard || t("listening") : firstSentence(talk.reply);

  const value = useMemo<Assistant>(
    () => ({ turns, pendingCard, talk, caption, busy, connecting, voiceOn, muted, error, quota, send, startVoice, stop, setMuted, answerCard, editCard, clear }),
    [turns, pendingCard, talk, caption, busy, connecting, voiceOn, muted, error, quota, send, startVoice, stop, setMuted, answerCard, editCard, clear],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
