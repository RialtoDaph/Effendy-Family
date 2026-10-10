"use client";

import Link from "next/link";
import { ArrowUp, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAppData } from "@/components/app-data";
import { useOnline } from "@/components/pwa";
import { ASK_EVENT, ASK_HANDOFF, askRialna, loadChat, saveChat, type ChatTurn } from "@/lib/ask";
import { ACTION_LABEL, type Answer } from "@/lib/ask-schema";
import { AI_NAME, hrefOf } from "@/lib/nav";
import { PageHeader } from "./page-header";

const SUGGESTIONS = [
  "How much can we still spend this month?",
  "Can we afford a new laptop in March?",
  "What happens if Studio has a slow month?",
  "Which subscriptions could we stop?",
  "Berapa lama lagi sampai dana darurat penuh?",
];

export function AskScreen() {
  const { userId } = useAppData();
  const online = useOnline();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const turnsRef = useRef<ChatTurn[]>([]);
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  async function ask(question: string, before: ChatTurn[]) {
    const q = question.trim();
    if (!q || busy) return;
    setError("");
    const withQ: ChatTurn[] = [...before, { role: "user", text: q, at: Date.now() }];
    setTurns(withQ);
    setDraft("");
    setBusy(true);
    const { answer, error: err } = await askRialna(q, before);
    setBusy(false);
    if (!answer) {
      setError(err ?? "Something went wrong.");
      setDraft(q);
      setTurns(before);
      return;
    }
    const next: ChatTurn[] = [...withQ, { role: "assistant", at: Date.now(), ...answer }];
    setTurns(next);
    saveChat(userId, next);
  }

  // Load this phone's chat, then ask what was typed in the search box (if anything).
  useEffect(() => {
    if (!userId || started.current) return;
    started.current = true;
    const saved = loadChat(userId);
    let handoff = "";
    try {
      handoff = sessionStorage.getItem(ASK_HANDOFF) ?? "";
      sessionStorage.removeItem(ASK_HANDOFF);
    } catch {}
    setTurns(saved);
    if (handoff) void ask(handoff, saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // A question from the search box while this screen is already open.
  useEffect(() => {
    const onAsk = () => {
      let q = "";
      try {
        q = sessionStorage.getItem(ASK_HANDOFF) ?? "";
        sessionStorage.removeItem(ASK_HANDOFF);
      } catch {}
      if (q) void ask(q, turnsRef.current);
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  });

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [turns.length, busy]);

  function clear() {
    if (!confirm("Clear this chat on this phone?")) return;
    setTurns([]);
    saveChat(userId, []);
  }

  const asked = new Set(turns.filter((t) => t.role === "user").map((t) => t.text));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <PageHeader eyebrow="Tools" title={`Ask ${AI_NAME}`} />
        {turns.length > 0 && (
          <button onClick={clear} aria-label="Clear chat" className="mt-6 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-mut">
            <Trash2 size={17} />
          </button>
        )}
      </div>
      <div className="-mt-2 text-[13px] text-mut">
        {AI_NAME} answers from your data in the app, only what you can see. Ask in English, Bahasa Indonesia or Deutsch. The chat stays on this phone.
      </div>

      <div className="flex flex-col gap-3">
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-inv px-4 py-2.5 text-[14.5px] text-white">
              {t.text}
            </div>
          ) : (
            <AnswerCard key={i} a={t} />
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2 self-start rounded-2xl bg-soft px-4 py-3 text-[13.5px] text-mut" role="status">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink" />
            {AI_NAME} is looking at your numbers…
          </div>
        )}
        {error && (
          <div className="rounded-[10px] bg-badbg p-3 text-[13px] font-bold text-bad" role="alert">
            {error}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.filter((s) => !asked.has(s))
          .slice(0, turns.length ? 3 : 5)
          .map((s) => (
            <button
              key={s}
              onClick={() => ask(s, turns)}
              disabled={busy || !online}
              className="min-h-10 rounded-full border border-line bg-card px-3.5 text-left text-[13px] font-bold text-ink disabled:opacity-50"
            >
              {s}
            </button>
          ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft, turns);
        }}
        className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] z-20 mr-[72px] flex items-end gap-2 rounded-2xl border border-line bg-card p-2 shadow-[0_4px_16px_rgba(0,0,0,.08)] wide:bottom-4 wide:mr-[84px]"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask(draft, turns);
            }
          }}
          rows={1}
          aria-label={`Ask ${AI_NAME}`}
          placeholder={online ? `Ask ${AI_NAME}…` : `${AI_NAME} needs the internet`}
          disabled={!online}
          className="max-h-32 min-h-11 flex-1 resize-none border-0 bg-transparent px-2 py-2.5 text-base text-ink outline-none"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim() || !online}
          aria-label="Send"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-0 bg-acc text-onacc disabled:opacity-40"
        >
          <ArrowUp size={19} strokeWidth={2.4} />
        </button>
      </form>
    </div>
  );
}

export function AnswerCard({ a, compact = false }: { a: Answer; compact?: boolean }) {
  return (
    <div className={`flex flex-col gap-3 self-stretch rounded-2xl border border-line bg-card ${compact ? "p-3.5" : "p-4"}`}>
      <div className="flex items-start gap-2">
        <Sparkles size={16} className="mt-0.5 flex-none text-mut" />
        <div className="whitespace-pre-wrap text-[14.5px] leading-normal text-ink">{a.text}</div>
      </div>
      {a.nums.length > 0 && (
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(110px,1fr))]">
          {a.nums.map((n) => (
            <div key={n.label} className="rounded-[10px] bg-soft px-3 py-2.5">
              <div className="text-[11.5px] font-bold text-mut">{n.label}</div>
              <div className="mt-0.5 font-mono text-[17px] font-black">{n.value}</div>
            </div>
          ))}
        </div>
      )}
      {(a.next || a.action !== "none") && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {a.next && <div className="min-w-0 flex-1 text-[13px] font-bold text-ink">→ {a.next}</div>}
          {a.action !== "none" && (
            <Link href={hrefOf(a.action)} className="min-h-10 whitespace-nowrap rounded-full bg-tint px-3.5 py-2.5 text-[12.5px] font-extrabold text-acct">
              {ACTION_LABEL[a.action]}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
