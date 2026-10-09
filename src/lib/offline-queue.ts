// Writes made offline wait in IndexedDB and are sent when the connection is
// back (README → Offline). Inserts carry a client-made id, so sending one twice
// is harmless; updates are last-write-wins per row.

import type { SupabaseClient } from "@supabase/supabase-js";

export type QueuedOp = {
  qid?: number;
  table: string;
  kind: "insert" | "update" | "delete";
  id: string;
  values?: Record<string, unknown>;
  at: number;
};

const DB = "ef-offline";
const STORE = "queue";
export const QUEUE_EVENT = "ef-queue-change";
/** Returned by save/remove when the change waits on this phone. */
export const QUEUED = "queued";
export const QUEUED_MSG = "Saved on this phone · it syncs when you are online";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "qid", autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
  });
}

export async function enqueue(op: Omit<QueuedOp, "qid" | "at">) {
  await tx("readwrite", (s) => s.add({ ...op, at: Date.now() }));
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

export async function pending(): Promise<QueuedOp[]> {
  try {
    return await tx("readonly", (s) => s.getAll() as IDBRequest<QueuedOp[]>);
  } catch {
    return [];
  }
}

async function drop(qid: number) {
  await tx("readwrite", (s) => s.delete(qid));
}

/** True when an error means "no network" rather than "the server said no". */
export function isNetworkError(error: { message?: string; code?: string } | null | undefined) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const m = error?.message ?? "";
  return !error?.code && /fetch|network|load failed/i.test(m);
}

let flushing = false;

/**
 * Sends queued writes in order. Returns how many were saved and how many the
 * server refused (those are dropped so one bad change cannot block the rest).
 */
export async function flush(sb: SupabaseClient): Promise<{ saved: number; refused: number }> {
  if (flushing || !navigator.onLine) return { saved: 0, refused: 0 };
  flushing = true;
  let saved = 0;
  let refused = 0;
  try {
    for (const op of await pending()) {
      const q = sb.from(op.table);
      const { error } =
        op.kind === "insert"
          ? await q.insert({ ...op.values, id: op.id })
          : op.kind === "update"
            ? await q.update(op.values ?? {}).eq("id", op.id)
            : await q.delete().eq("id", op.id);
      if (error && isNetworkError(error)) break; // still offline: try again later
      if (error && error.code !== "23505") refused++; // 23505 = already saved earlier
      else saved++;
      await drop(op.qid!);
    }
  } finally {
    flushing = false;
    window.dispatchEvent(new Event(QUEUE_EVENT));
  }
  return { saved, refused };
}
