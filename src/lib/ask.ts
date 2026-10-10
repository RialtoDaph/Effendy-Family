// Talks to /api/ask (Rialna, on the server). Chat history and today's
// briefing stay on this phone only.

import type { Answer } from "@/lib/ask-schema";
import { supabase } from "@/lib/supabase";

/** The command palette leaves the question here for the Ask screen. */
export const ASK_HANDOFF = "ef-ask-question";
/** Fired as well, for when the Ask screen is already open. */
export const ASK_EVENT = "ef-ask";

export type ChatTurn = { role: "user"; text: string; at: number } | ({ role: "assistant"; at: number } & Answer);

async function post(body: Record<string, unknown>): Promise<{ answer?: Answer; error?: string }> {
  if (!navigator.onLine) return { error: "Rialna needs the internet." };
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "Please sign in again." };
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.text) return { error: json?.error ?? "Rialna could not answer. Try again." };
    return { answer: json as Answer };
  } catch {
    return { error: "Could not reach Rialna. Try again." };
  }
}

export function askRialna(question: string, history: ChatTurn[]) {
  return post({
    mode: "ask",
    question,
    history: history.slice(-6).map((t) => ({ role: t.role, text: t.text })),
  });
}

export function fetchBriefing(scope: string) {
  return post({ mode: "briefing", scope });
}

const chatKey = (userId: string) => `ef-ask-${userId}`;

export function loadChat(userId: string): ChatTurn[] {
  try {
    return JSON.parse(localStorage.getItem(chatKey(userId)) ?? "[]") as ChatTurn[];
  } catch {
    return [];
  }
}

export function saveChat(userId: string, turns: ChatTurn[]) {
  try {
    localStorage.setItem(chatKey(userId), JSON.stringify(turns.slice(-40)));
  } catch {}
}

const briefKey = (userId: string, scope: string, day: string) => `ef-brief-${userId}-${scope}-${day}`;

export function loadBriefing(userId: string, scope: string, day: string): Answer | null {
  try {
    const raw = localStorage.getItem(briefKey(userId, scope, day));
    return raw ? (JSON.parse(raw) as Answer) : null;
  } catch {
    return null;
  }
}

export function saveBriefing(userId: string, scope: string, day: string, a: Answer) {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(`ef-brief-${userId}-`) && !k.endsWith(day)) localStorage.removeItem(k);
    localStorage.setItem(briefKey(userId, scope, day), JSON.stringify(a));
  } catch {}
}
