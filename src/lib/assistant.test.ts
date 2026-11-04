import { describe, expect, it } from "vitest";
import { firstSentence, functionCalls, TALK_START, talkStep } from "./assistant-events";
import { buildInstructions, memoriesFor, type MemoryFact } from "./assistant-prompt";
import { runTool, saveCard, TOOLS } from "./assistant-tools";

const fact = (id: string, owner_id: string, scope: MemoryFact["scope"]): MemoryFact => ({ id, owner_id, scope, text: `fact ${id}` });

describe("talkStep", () => {
  const run = (...types: string[]) => types.reduce((s, type) => talkStep(s, { type }), { ...TALK_START, live: true });

  it("follows the spec: speaking, waiting, audio playing", () => {
    expect(run("input_audio_buffer.speech_started").mode).toBe("listen");
    expect(run("input_audio_buffer.speech_stopped").mode).toBe("think");
    expect(run("response.created").mode).toBe("think");
    expect(run("output_audio_buffer.started").mode).toBe("speak");
  });

  it("goes back to listening after speaking in a voice session, to calm otherwise", () => {
    expect(run("output_audio_buffer.stopped").mode).toBe("listen");
    expect(talkStep(TALK_START, { type: "output_audio_buffer.stopped" }).mode).toBe("calm");
  });

  it("collects the reply from transcript and text deltas", () => {
    const a = talkStep(TALK_START, { type: "response.output_audio_transcript.delta", delta: "Hi " });
    expect(talkStep(a, { type: "response.output_text.delta", delta: "there" }).reply).toBe("Hi there");
  });
});

describe("firstSentence", () => {
  it("keeps only the first sentence for the caption", () => {
    expect(firstSentence("You have €40 left. That is fine.")).toBe("You have €40 left.");
  });
});

describe("functionCalls", () => {
  it("reads calls from response.done only", () => {
    const output = [{ type: "function_call", name: "get_week", call_id: "c1", arguments: "{}" }, { type: "message" }];
    expect(functionCalls({ type: "response.done", response: { output } })).toEqual([{ name: "get_week", call_id: "c1", arguments: "{}" }]);
    expect(functionCalls({ type: "response.created", response: { output } })).toEqual([]);
  });
});

describe("memory in a session", () => {
  it("never lets a partner's private fact through", () => {
    const kept = memoriesFor([fact("mine", "me", "private"), fact("ours", "partner", "shared"), fact("theirs", "partner", "private")], "me");
    expect(kept.map((m) => m.id)).toEqual(["mine", "ours"]);
  });

  it("caps at 30 facts", () => {
    expect(memoriesFor(Array.from({ length: 40 }, (_, i) => fact(String(i), "me", "private")), "me")).toHaveLength(30);
  });

  const base = { aiName: "Clopar", speaker: "Alex", members: ["Alex", "Mira"], locale: "de", today: "2026-11-04" };
  it("labels each fact private or shared", () => {
    const text = buildInstructions({ ...base, memories: [fact("a", "me", "shared")], memoryOn: true });
    expect(text).toContain("[shared, id a] fact a");
    expect(text).toContain("German");
  });

  it("carries no facts when memory is off", () => {
    expect(buildInstructions({ ...base, memories: [fact("a", "me", "private")], memoryOn: false })).not.toContain("fact a");
  });
});

/** A client that records writes and answers inserts with an id. */
function fakeDb(pending?: object) {
  const writes: string[] = [];
  const chain = (table: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit", "gte", "lte"]) q[m] = () => q;
    q.insert = () => (writes.push(`insert ${table}`), q);
    q.update = () => (writes.push(`update ${table}`), q);
    q.delete = () => (writes.push(`delete ${table}`), q);
    q.single = async () => ({ data: { id: "new" }, error: null });
    q.maybeSingle = async () => ({ data: table === "ai_pending_actions" ? (pending ?? null) : null, error: null });
    q.then = (ok: (v: unknown) => void) => ok({ data: [], error: null });
    return q;
  };
  return { sb: { from: chain } as never, writes };
}

describe("writes wait for the card", () => {
  it("exposes no tool that writes directly", () => {
    const names = TOOLS.map((t) => t.name);
    expect(names.filter((n) => /^(save|add|create|update|delete)/.test(n))).toEqual([]);
  });

  it("a proposal only leaves a pending card", async () => {
    const { sb, writes } = fakeDb();
    const { card, output } = await runTool(sb, "me", "propose_event", { title: "Dentist", date: "2026-11-10", visibility: "family" });
    expect(writes).toEqual(["insert ai_pending_actions"]);
    expect(card?.status).toBe("pending");
    expect(output.status).toBe("awaiting_user_confirmation");
  });

  it("rejects a proposal without what it needs", async () => {
    const { sb, writes } = fakeDb();
    const { card, output } = await runTool(sb, "me", "propose_event", { title: "Dentist", visibility: "family" });
    expect(card).toBeUndefined();
    expect(output.error).toBeTruthy();
    expect(writes).toEqual([]);
  });

  it("a card saves once", async () => {
    const done = fakeDb({ id: "c", tool: "event", args: {}, status: "saved", result: null });
    expect(await saveCard(done.sb, "me", "c")).toEqual({ error: "gone" });
    expect(done.writes).toEqual([]);
    const open = fakeDb({ id: "c", tool: "event", args: { title: "x", date: "2026-11-10", time: null, visibility: "family" }, status: "pending", result: null });
    expect(await saveCard(open.sb, "me", "c")).toEqual({ ok: true });
    expect(open.writes).toEqual(["insert events", "update ai_pending_actions"]);
  });
});
