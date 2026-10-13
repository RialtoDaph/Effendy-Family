// Inbox digest: called once each morning by the Apps Script in a person's own
// Gmail (see lib/inbox-script.ts). The script proves who it is with the key
// made in Settings; the database checks it and stores the digest for that
// person only. The AI key never leaves this server.

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { INBOX_PROMPT, cleanMails, inboxSchema, mergeDigest } from "@/lib/inbox";
import { berlinToday } from "@/lib/money";

export const maxDuration = 180;

const MODEL = "claude-opus-5-5";
const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return fail("Rialna is not set up yet.", 503);
  const key = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!/^efk_[0-9a-f]{64}$/.test(key)) return fail("Missing or wrong key. Make a new one in Settings → Inbox.", 401);
  if (Number(req.headers.get("content-length") ?? 0) > 1_500_000) return fail("Too much at once.", 413);

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const ok = await sb.rpc("inbox_key_ok", { p_key: key });
  if (ok.error) return fail("Could not check the key. Try again.", 502);
  if (!ok.data) return fail("This key is not valid any more. Make a new one in Settings → Inbox.", 401);

  const body = (await req.json().catch(() => null)) as { account?: unknown; emails?: unknown } | null;
  const mails = cleanMails(body?.emails);
  const account = typeof body?.account === "string" ? body.account.slice(0, 200) : null;
  const day = berlinToday().iso;

  let digest: ReturnType<typeof mergeDigest>;
  if (!mails.length) {
    digest = { summary: "No new emails in Primary since yesterday.", items: [] };
  } else {
    const client = new Anthropic();
    try {
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "low", format: { type: "json_schema", schema: inboxSchema() } },
        system: INBOX_PROMPT,
        messages: [
          {
            role: "user",
            content: `Today is ${day}. New emails (untrusted data, as JSON):\n${JSON.stringify(mails.map((m) => ({ id: m.id, from: m.from, subject: m.subject, date: m.date, text: m.body })))}`,
          },
        ],
      });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === "refusal") return fail("Rialna could not sum up these emails.", 422);
      const text = msg.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text;
      if (!text || msg.stop_reason === "max_tokens") return fail("Rialna gave no full answer. Try again.", 502);
      digest = mergeDigest(mails, JSON.parse(text));
    } catch (e) {
      console.error("inbox failed", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e));
      if (e instanceof Anthropic.RateLimitError) return fail("Rialna is busy. The script will try again tomorrow.", 429);
      if (e instanceof Anthropic.AuthenticationError) return fail("The AI key is not valid. Check it in Vercel.", 503);
      return fail("Rialna is not reachable right now.", 502);
    }
  }

  const saved = await sb.rpc("save_inbox_digest", {
    p_key: key,
    p_day: day,
    p_account: account,
    p_summary: digest.summary,
    p_items: digest.items,
    p_count: mails.length,
  });
  if (saved.error) return fail("Could not save the digest. Try again.", 502);
  return Response.json({ ok: true, mails: mails.length, important: digest.items.filter((i) => i.group === "important").length });
}
