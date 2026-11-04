import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { send, type QueuedOp } from "./offline-queue";

// A row on the server, with the same filters PostgREST applies.
function table(row: { id: string; updated_at: string; v?: number }, now: string) {
  const update = (values: { v?: number }) => {
    let due = "9999";
    const chain = {
      eq: () => chain,
      lte: (_: string, at: string) => ((due = at), chain),
      select: async () => {
        if (row.updated_at > due) return { data: [], error: null };
        Object.assign(row, values, { updated_at: now });
        return { data: [row], error: null };
      },
    };
    return chain;
  };
  return { update } as unknown as ReturnType<SupabaseClient["from"]>;
}

const op = (at: string, v: number): QueuedOp => ({ table: "x", kind: "update", id: "1", values: { v }, at: new Date(at).getTime() });

describe("offline queue", () => {
  it("a newer edit on the server wins", async () => {
    const row = { id: "1", updated_at: "2026-11-05T12:00:00.000Z", v: 1 };
    const res = await send(table(row, "2026-11-05T13:00:00.000Z"), op("2026-11-05T11:00:00.000Z", 2), new Set());
    expect(res.hit).toBe(false);
    expect(row.v).toBe(1);
  });

  it("two offline edits of one row both land", async () => {
    const row = { id: "1", updated_at: "2026-11-05T10:00:00.000Z", v: 1 };
    const q = table(row, "2026-11-05T13:00:00.000Z");
    const written = new Set<string>();
    const first = await send(q, op("2026-11-05T11:00:00.000Z", 2), written);
    if (first.hit) written.add("1");
    await send(q, op("2026-11-05T11:05:00.000Z", 3), written);
    expect(row.v).toBe(3);
  });
});
