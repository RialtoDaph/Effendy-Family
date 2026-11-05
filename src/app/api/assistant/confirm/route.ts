// The person's answer on a card. Nothing the assistant suggests is written before this.

import { saveCard, undoCard } from "@/lib/assistant-tools";
import { authorize } from "@/lib/server-auth";

export async function POST(req: Request) {
  const auth = await authorize(req);
  if (auth instanceof Response) return auth;
  const body = (await req.json().catch(() => null)) as { id?: string; action?: string; text?: string } | null;
  if (!body?.id) return Response.json({ error: "gone" }, { status: 400 });

  if (body.action === "skip") {
    await auth.sb.from("ai_pending_actions").update({ status: "skipped" }).eq("id", body.id).eq("status", "pending");
    return Response.json({ ok: true });
  }
  const out = body.action === "undo" ? await undoCard(auth.sb, body.id) : await saveCard(auth.sb, auth.userId, body.id, body.text);
  return Response.json(out, { status: "error" in out ? 409 : 200 });
}
