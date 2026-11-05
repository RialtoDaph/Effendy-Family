// Reminders on this phone (Web Push). The server side is the `push` Edge
// Function; this file asks for permission, subscribes and saves the
// subscription for the signed-in person.

import { supabase } from "@/lib/supabase";

export type PushState = "unsupported" | "blocked" | "off" | "on";

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration() {
  return navigator.serviceWorker.getRegistration("/");
}

/** Whether this phone gets reminders right now. */
export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  const sub = await (await registration())?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

function keyBytes(b64url: string) {
  const s = atob(b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export type PushError = "pe_unsupported" | "pe_denied" | "pe_reopen" | "pe_server" | "needs_net" | "save_failed" | "pe_first" | "pe_wait" | "pe_nosub" | "pe_test";

/** Asks for permission, subscribes and saves. Returns a message key or null. */
export async function enablePush(): Promise<PushError | null> {
  if (!pushSupported()) return "pe_unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "pe_denied";
  const reg = await registration();
  if (!reg) return "pe_reopen";

  const sb = supabase();
  const { data, error } = await sb.functions.invoke<{ publicKey: string }>("push", { body: { action: "key" } });
  if (error || !data?.publicKey) return navigator.onLine ? "pe_server" : "needs_net";
  const appKey = keyBytes(data.publicKey);

  let sub = await reg.pushManager.getSubscription();
  // A subscription made with another key cannot be reused.
  const old = sub?.options.applicationServerKey;
  if (sub && old && !sameBytes(new Uint8Array(old), appKey)) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });

  const j = sub.toJSON();
  const res = await sb.rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: j.keys?.p256dh,
    p_auth: j.keys?.auth,
    p_agent: navigator.userAgent,
  });
  return res.error ? "save_failed" : null;
}

function sameBytes(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Sends one test reminder to this phone. Returns a message key or null. */
export async function sendTestPush(): Promise<PushError | null> {
  const sub = await (await registration())?.pushManager.getSubscription();
  if (!sub) return "pe_first";
  const { error } = await supabase().functions.invoke("push", { body: { action: "test", endpoint: sub.endpoint } });
  if (!error) return null;
  const ctx = (error as { context?: Response }).context;
  if (ctx?.status === 429) return "pe_wait";
  if (ctx?.status === 404) return "pe_nosub";
  return navigator.onLine ? "pe_test" : "needs_net";
}

/** On sign out: this phone stops getting the person's reminders. */
export async function disablePushHere() {
  try {
    if (!pushSupported()) return;
    const sub = await (await registration())?.pushManager.getSubscription();
    if (!sub) return;
    await supabase().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  } catch {}
}
