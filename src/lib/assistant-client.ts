// One WebRTC connection to the realtime model. Voice sends the microphone; typed
// sessions only receive, and both use the same event channel. The browser holds a
// short-lived token, never the API key. Audio is streamed and not stored.

import { supabase } from "@/lib/supabase";
import type { Card } from "@/lib/assistant-tools";

const CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export type SessionInfo = { token: string; session_id: string; plan: string; voice_left: number; ai_left: number | null };
export type SessionFail = { code: "not_configured" | "voice_quota" | "ai_quota" | "failed" };

export async function authedPost<T>(path: string, body: unknown, keepalive = false): Promise<{ ok: boolean; status: number; data: T | null }> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, status: 401, data: null };
  try {
    const res = await fetch(path, { method: "POST", keepalive, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, status: res.status, data: (await res.json().catch(() => null)) as T | null };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export const runAssistantTool = (session_id: string, name: string, args: string) =>
  authedPost<{ output: Record<string, unknown>; card?: Card }>("/api/assistant/tool", { session_id, name, arguments: args });

export type Realtime = { send: (event: object) => void; setMuted: (on: boolean) => void; close: () => void };

export async function connectRealtime(token: string, voice: boolean, onEvent: (e: { type: string }) => void, onDrop: () => void): Promise<Realtime> {
  const pc = new RTCPeerConnection();
  const audio = new Audio();
  audio.autoplay = true;
  pc.ontrack = (e) => {
    audio.srcObject = e.streams[0];
  };

  const mic = voice ? await navigator.mediaDevices.getUserMedia({ audio: true }) : null;
  try {
    if (mic) pc.addTrack(mic.getAudioTracks()[0], mic);
    else pc.addTransceiver("audio", { direction: "recvonly" });

    const channel = pc.createDataChannel("oai-events");
    channel.onmessage = (m) => {
      try {
        onEvent(JSON.parse(m.data as string));
      } catch {}
    };
    const opened = new Promise<void>((resolve, reject) => {
      channel.onopen = () => resolve();
      setTimeout(() => reject(new Error("timeout")), 15000);
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const res = await fetch(CALLS_URL, { method: "POST", body: offer.sdp, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/sdp" } });
    if (!res.ok) throw new Error(`calls ${res.status}`);
    await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
    await opened;

    let closed = false;
    pc.onconnectionstatechange = () => {
      if (!closed && ["failed", "disconnected", "closed"].includes(pc.connectionState)) onDrop();
    };
    return {
      send: (event) => channel.readyState === "open" && channel.send(JSON.stringify(event)),
      setMuted: (on) => {
        audio.muted = on;
      },
      close: () => {
        closed = true;
        mic?.getTracks().forEach((t) => t.stop());
        channel.close();
        pc.close();
        audio.srcObject = null;
      },
    };
  } catch (e) {
    mic?.getTracks().forEach((t) => t.stop());
    pc.close();
    throw e;
  }
}
