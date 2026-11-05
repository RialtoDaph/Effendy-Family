"use client";

import { ArrowUp, Mic, MicOff, Sparkles, Trash2, Volume2, VolumeX } from "lucide-react";
import { useAiName } from "@/components/app-data";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useAssistant, type AssistantError, type Turn } from "@/components/assistant";
import { ConfirmCard } from "@/components/assistant-card";
import { Clopar } from "@/components/clopar";
import { useOnline } from "@/components/pwa";
import { ASK_EVENT, ASK_HANDOFF } from "@/lib/ask";
import { hrefOf } from "@/lib/nav";
import { PageHeader } from "./page-header";

const SUGGESTIONS = ["ask_spend", "ask_laptop", "ask_subs", "ask_goals"] as const;

export function useErrorText() {
  const aiName = useAiName();
  const t = useTranslations("assistant");
  return (e: AssistantError) =>
    e === "voice_quota"
      ? t("err_voice_quota")
      : e === "ai_quota"
        ? t("err_ai_quota")
        : e === "mic"
          ? t("err_mic")
          : e === "not_configured"
            ? t("err_not_configured", { name: aiName })
            : e
              ? t("err_failed", { name: aiName })
              : "";
}

export function AskScreen() {
  const aiName = useAiName();
  const t = useTranslations("assistant");
  const online = useOnline();
  const { turns, talk, caption, busy, connecting, voiceOn, muted, error, quota, send, startVoice, stop, setMuted, clear } = useAssistant();
  const errorText = useErrorText();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // What was typed in the search box, now or while this screen was closed.
  const latestSend = useRef(send);
  useEffect(() => {
    latestSend.current = send;
  }, [send]);
  useEffect(() => {
    const take = () => {
      let q = "";
      try {
        q = sessionStorage.getItem(ASK_HANDOFF) ?? "";
        sessionStorage.removeItem(ASK_HANDOFF);
      } catch {}
      if (q) void latestSend.current(q);
    };
    take();
    window.addEventListener(ASK_EVENT, take);
    return () => window.removeEventListener(ASK_EVENT, take);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, busy]);

  function submit() {
    const q = draft;
    setDraft("");
    void send(q);
  }

  return (
    <div className="flex flex-col gap-4">
      <div data-screen-label="Ask AI" className="relative h-[clamp(150px,24vh,220px)] flex-none overflow-hidden rounded-[18px] border border-line bg-card">
        <Clopar variant="hero" mode={talk.mode} />
        {caption && (
          <p aria-live="polite" className="absolute inset-x-4 bottom-3 m-0 line-clamp-2 text-center text-[15px] font-light leading-[1.35] text-ink [text-shadow:0_1px_12px_var(--card)]">
            {caption}
          </p>
        )}
      </div>

      {quota.aiLeft !== null && <div className="text-[13px] font-bold text-mut">{t("ai_left", { n: quota.aiLeft })}</div>}
      {quota.voiceLeft !== null && voiceOn && <div className="text-[13px] font-bold text-mut">{t("voice_left", { n: Math.ceil(quota.voiceLeft / 60) })}</div>}

      <div className="flex items-start justify-between gap-2">
        <PageHeader eyebrow={t("ask_name", { name: aiName })} title={t("ask_title")}>
          <p className="m-0 mt-1.5 text-sm text-mut">{t("ask_sub")}</p>
        </PageHeader>
        {turns.length > 0 && (
          <button
            onClick={() => confirm(t("clear_confirm")) && void clear()}
            aria-label={t("clear")}
            className="mt-6 flex h-11 w-11 flex-none items-center justify-center rounded-full border border-line bg-card text-mut"
          >
            <Trash2 size={17} />
          </button>
        )}
      </div>

      {!turns.length && (
        <section className="flex items-start gap-3.5 rounded-[18px] border border-line bg-card p-[22px]">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px] bg-inv text-acc2">
            <Sparkles size={18} />
          </span>
          <p className="m-0 text-[15px] leading-[1.6]">{t("hello", { name: aiName })}</p>
        </section>
      )}

      <div className="flex flex-col gap-3.5">
        {turns.map((x) =>
          x.card ? (
            <ConfirmCard key={x.id} card={x.card} />
          ) : x.role === "user" ? (
            <div key={x.id} className="max-w-[80%] self-end rounded-[12px_20px_6px_20px] bg-inv px-4 py-3 text-[15px] font-medium leading-normal text-white">
              {x.text}
            </div>
          ) : (
            <AnswerCard key={x.id} a={x} />
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2 self-start rounded-2xl bg-soft px-4 py-3 text-[13.5px] text-mut" role="status">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink motion-reduce:animate-none" />
            {t("looking", { name: aiName })}
          </div>
        )}
        {error && (
          <div className="rounded-[10px] bg-badbg p-3 text-[13px] font-bold text-bad" role="alert">
            {errorText(error)}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {turns.length < 2 && (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((k) => (
            <button
              key={k}
              onClick={() => void send(t(k))}
              disabled={busy || !online}
              className="min-h-10 rounded-full border border-line bg-card px-3.5 text-left text-[13px] font-bold text-ink disabled:opacity-50"
            >
              {t(k)}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] z-20 mr-[72px] flex items-end gap-1.5 rounded-2xl border border-line bg-card p-2 shadow-[0_4px_16px_rgba(0,0,0,.08)] wide:bottom-4 wide:mr-[84px]"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          aria-label={t("ask_name", { name: aiName })}
          placeholder={online ? t("ask_placeholder", { name: aiName }) : t("needs_net", { name: aiName })}
          disabled={!online}
          className="max-h-32 min-h-11 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-2.5 text-base text-ink outline-none"
        />
        {voiceOn && (
          <button type="button" onClick={() => setMuted(!muted)} aria-label={t(muted ? "unmute" : "mute")} aria-pressed={muted} className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-0 bg-soft2 text-ink">
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        )}
        <button
          type="button"
          onClick={() => (voiceOn ? stop() : void startVoice())}
          disabled={connecting || !online}
          aria-label={t(voiceOn ? "voice_stop" : "voice_start")}
          aria-pressed={voiceOn}
          className={`flex h-11 w-11 flex-none items-center justify-center rounded-full border-0 disabled:opacity-40 ${voiceOn ? "bg-acc text-onacc" : "bg-soft2 text-ink"}`}
        >
          {voiceOn ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button type="submit" disabled={busy || !draft.trim() || !online} aria-label={t("send")} className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-0 bg-acc text-onacc disabled:opacity-40">
          <ArrowUp size={19} strokeWidth={2.4} />
        </button>
      </form>
    </div>
  );
}

function AnswerCard({ a }: { a: Turn }) {
  const t = useTranslations("assistant");
  const nums = a.nums ?? [];
  const action = a.action && a.action !== "none" ? a.action : null;
  return (
    <div className="flex flex-col gap-3 self-stretch rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start gap-2">
        <Sparkles size={16} className="mt-0.5 flex-none text-mut" />
        <div className="whitespace-pre-wrap text-[14.5px] leading-normal text-ink">{a.text}</div>
      </div>
      {nums.length > 0 && (
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(110px,1fr))]">
          {nums.map((n) => (
            <div key={n.label} className="rounded-[10px] bg-soft px-3 py-2.5">
              <div className="text-[11.5px] font-bold text-mut">{n.label}</div>
              <div className="mt-0.5 font-mono text-[17px] font-bold">{n.value}</div>
            </div>
          ))}
        </div>
      )}
      {(a.next || action) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {a.next && <div className="min-w-0 flex-1 text-[13px] font-bold text-ink">→ {a.next}</div>}
          {action && (
            <Link href={hrefOf(action)} className="hit44 min-h-10 whitespace-nowrap rounded-full bg-tint px-3.5 py-2.5 text-[12.5px] font-bold text-acct">
              {t("open")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
