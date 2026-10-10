// Sends a receipt photo or a PDF statement to /api/read (Claude, on the server).

import type { ReceiptResult, StatementResult } from "@/lib/ai-read-schema";
import { supabase } from "@/lib/supabase";

/** Phone photos are large; 1600 px JPEG is plenty to read a receipt and uploads fast. */
export async function shrinkPhoto(file: File, maxSide = 1600): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // the server says so if it cannot use it
  }
}

type Read<T> = { result: T; error?: undefined } | { result?: undefined; error: string };

async function send<T>(kind: "receipt" | "statement", file: File): Promise<Read<T>> {
  if (!navigator.onLine) return { error: "Reading needs the internet." };
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "Please sign in again." };
  const body = new FormData();
  body.set("kind", kind);
  body.set("file", file);
  try {
    const res = await fetch("/api/read", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.result) return { error: json?.error ?? "Could not read the file. Try again." };
    return { result: json.result as T };
  } catch {
    return { error: "Could not reach the server. Try again." };
  }
}

export const readReceipt = (photo: File) => send<ReceiptResult>("receipt", photo);
export const readStatement = (pdf: File) => send<StatementResult>("statement", pdf);
