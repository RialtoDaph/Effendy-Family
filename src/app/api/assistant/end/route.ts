// Closes a session: books the minutes, then keeps 0–3 durable facts as private
// memories (AI_ASSISTANT.md §4.3). Extraction never writes shared memory.

import Anthropic from "@anthropic-ai/sdk";
import { EXTRACT_PROMPT, extractSchema } from "@/lib/assistant-prompt";
import { authorize } from "@/lib/server-auth";

export const maxDuration = 60;

const MODEL = "claude-haiku-5-5";
type Turn = { role: string; text: string };

export async function POST(req: Request) {
  const auth = await authorize(req);
  if (auth instanceof Response) return auth;
  const { sb, userId } = auth;

  const body = (await req.json().catch(() => null)) as { session_id?: string; turns?: Turn[]; tools?: string[]; voice?: boolean } | null;
  if (!body?.session_id) return Response.json({ error: "No session." }, { status: 400 });
  const { error } = await sb.rpc("ai_session_end", { p_session: body.session_id, p_tools: body.tools ?? [] });
  if (error) return Response.json({ error: "No session." }, { status: 404 });

  const turns = (Array.isArray(body.turns) ? body.turns : []).filter((t) => typeof t?.text === "string").slice(-30);
  if (!turns.some((t) => t.role === "user") || !process.env.ANTHROPIC_API_KEY) return Response.json({ ok: true, kept: 0 });

  const { data: settings } = await sb.from("member_settings").select("memory_on").eq("member_id", userId).maybeSingle();
  if (settings && settings.memory_on === false) return Response.json({ ok: true, kept: 0 });

  const { data: known } = await sb.from("ai_memories").select("text").eq("owner_id", userId).limit(100);
  const transcript = turns.map((t) => `${t.role === "user" ? "Person" : "Assistant"}: ${t.text.slice(0, 500)}`).join("\n");

  try {
    const msg = await new Anthropic().messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: "low", format: { type: "json_schema", schema: extractSchema() } },
      system: EXTRACT_PROMPT,
      messages: [{ role: "user", content: `Known already:\n${(known ?? []).map((k) => `- ${k.text}`).join("\n") || "(nothing)"}\n\nConversation:\n${transcript}` }],
    });
    if (msg.stop_reason === "refusal") return Response.json({ ok: true, kept: 0 });
    const out = msg.content.find((b) => b.type === "text");
    const facts = out?.type === "text" ? ((JSON.parse(out.text) as { facts: { text: string; kind: string }[] }).facts ?? []) : [];
    const rows = facts.slice(0, 3).map((f) => ({
      text: f.text.slice(0, 500),
      kind: f.kind,
      scope: "private",
      source: body.voice ? "voice" : "chat",
      source_session_id: body.session_id,
    }));
    if (rows.length) await sb.from("ai_memories").insert(rows);
    return Response.json({ ok: true, kept: rows.length });
  } catch (e) {
    console.error("memory extraction failed", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e));
    return Response.json({ ok: true, kept: 0 });
  }
}
