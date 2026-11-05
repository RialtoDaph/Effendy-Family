// Turns realtime session events into what the character does (AI_ASSISTANT.md §1.4–5).
// Pure, so every transition can be tested without a connection.

export type TalkMode = "calm" | "listen" | "think" | "speak" | "confirm";
export type Talk = { mode: TalkMode; live: boolean; reply: string; heard: string };
export type FunctionCall = { name: string; call_id: string; arguments: string };

export const TALK_START: Talk = { mode: "calm", live: false, reply: "", heard: "" };

type RealtimeEvent = { type: string; delta?: string; transcript?: string; response?: { output?: { type: string; name?: string; call_id?: string; arguments?: string }[] } };

/** The caption is only the first sentence. */
export function firstSentence(text: string) {
  return (text.trim().split(/(?<=[.!?])\s+/)[0] ?? "").trim();
}

export function talkStep(s: Talk, e: RealtimeEvent): Talk {
  switch (e.type) {
    case "input_audio_buffer.speech_started":
      return { ...s, mode: "listen", reply: "", heard: "" };
    case "input_audio_buffer.speech_stopped":
    case "response.created":
      return { ...s, mode: "think", reply: "" };
    case "conversation.item.input_audio_transcription.completed":
      return { ...s, heard: e.transcript ?? s.heard };
    case "output_audio_buffer.started":
      return { ...s, mode: "speak" };
    case "response.output_audio_transcript.delta":
    case "response.output_text.delta":
      return { ...s, mode: "speak", reply: s.reply + (e.delta ?? "") };
    case "output_audio_buffer.stopped":
      return { ...s, mode: s.live ? "listen" : "calm" };
    default:
      return s;
  }
}

export function functionCalls(e: RealtimeEvent): FunctionCall[] {
  if (e.type !== "response.done") return [];
  return (e.response?.output ?? [])
    .filter((o) => o.type === "function_call" && o.name && o.call_id)
    .map((o) => ({ name: o.name!, call_id: o.call_id!, arguments: o.arguments ?? "{}" }));
}
