// Bug reports and ideas sent from the floating report button, worked on as a
// small kanban on the Reports screen. Shared by both of you.

import { supabase } from "./supabase";

export type FeedbackKind = "bug" | "idea" | "other";
export type FeedbackStatus = "todo" | "doing" | "done";

export type Feedback = {
  id: string;
  owner_id: string;
  kind: FeedbackKind;
  title: string;
  note: string | null;
  page: string | null;
  device: string | null;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
};

export const COLUMNS: { id: FeedbackStatus; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "Doing" },
  { id: "done", label: "Done" },
];

export const KIND_LABEL: Record<FeedbackKind, string> = { bug: "Bug", idea: "Idea", other: "Other" };

/** Fired after a report is sent, so an open Reports screen reloads. */
export const FEEDBACK_EVENT = "ef-feedback";

/** Short device line for the report, e.g. "iPhone · Safari · 390×844". */
export function deviceLine(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Other";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const app = window.matchMedia?.("(display-mode: standalone)").matches ? " · app" : "";
  return `${os} · ${browser}${app} · ${window.innerWidth}×${window.innerHeight}`.slice(0, 300);
}

export async function listFeedback(): Promise<{ items: Feedback[]; error?: string }> {
  const { data, error } = await supabase().from("feedback").select("*").order("created_at", { ascending: false });
  return error ? { items: [], error: error.message } : { items: data as Feedback[] };
}

export async function sendFeedback(v: { kind: FeedbackKind; title: string; note: string; page: string }): Promise<string | void> {
  const { error } = await supabase()
    .from("feedback")
    .insert({ kind: v.kind, title: v.title.trim().slice(0, 200), note: v.note.trim().slice(0, 4000) || null, page: v.page.slice(0, 200), device: deviceLine() });
  if (error) return navigator.onLine ? error.message : "You are offline. Please send the report again when you are online.";
  window.dispatchEvent(new Event(FEEDBACK_EVENT));
}

export async function updateFeedback(id: string, v: Partial<Pick<Feedback, "kind" | "title" | "note" | "status">>): Promise<string | void> {
  const { error } = await supabase()
    .from("feedback")
    .update({ ...v, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return error.message;
}

export async function deleteFeedback(id: string): Promise<string | void> {
  const { error } = await supabase().from("feedback").delete().eq("id", id);
  if (error) return error.message;
}
