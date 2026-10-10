// Ask Rialna and the Home briefing (README → Ask Rialna; Home briefing).
// The data is read with the asker's own login, so Row Level Security keeps the
// partner's private items out, and buildContext() filters them once more.

import Anthropic from "@anthropic-ai/sdk";
import { ACTIONS, ASK_PROMPT, BRIEFING_PROMPT, answerSchema } from "@/lib/ask-schema";
import { buildContext, type AskRows } from "@/lib/ask-context";
import { DEFAULT_IDR_PER_EUR } from "@/lib/finance";
import { berlinToday } from "@/lib/money";
import { addDays } from "@/lib/time";
import { authorize } from "@/lib/server-auth";

export const maxDuration = 120;

const MODEL = "claude-opus-5-5";
const fail = (error: string, status: number) => Response.json({ error }, { status });

type Turn = { role: "user" | "assistant"; text: string };

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return fail(`Rialna is not set up yet.`, 503);
  const auth = await authorize(req);
  if (auth instanceof Response) return auth;
  const { sb, userId } = auth;

  const body = (await req.json().catch(() => null)) as { mode?: string; question?: string; history?: Turn[]; scope?: string } | null;
  const mode = body?.mode === "briefing" ? "briefing" : "ask";
  const question = String(body?.question ?? "").trim().slice(0, 1000);
  if (mode === "ask" && !question) return fail("Please type a question.", 400);
  const history = (Array.isArray(body?.history) ? body.history : [])
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.text === "string")
    .slice(-6)
    .map((t) => ({ role: t.role, content: t.text.slice(0, 2000) }));

  // Everything this person may see (RLS decides), limited to what is useful.
  const today = berlinToday();
  const since = addDays(today.iso, -62);
  const q = await Promise.all([
    sb.from("members").select("id,display_name").order("sort"),
    sb.from("categories").select("*").order("sort"),
    sb.from("transactions").select("*").gte("date", since).order("date", { ascending: false }).limit(1500),
    sb.from("incomes").select("*"),
    sb.from("recurring").select("*"),
    sb.from("goals").select("*"),
    sb.from("debts").select("*"),
    sb.from("subscriptions").select("*"),
    sb.from("assets").select("*"),
    sb.from("remittances").select("*").gte("date", `${today.y}-01-01`),
    sb.from("businesses").select("id,name"),
    sb.from("business_months").select("*").order("month", { ascending: false }).limit(36),
    sb.from("tax_deadlines").select("*"),
    sb.from("events").select("*").gte("date", `${today.ym}-01`).lte("date", addDays(today.iso, 31)),
    sb.from("yearly_goals").select("*").eq("year", today.y),
    sb.from("fx_rates").select("idr_per_eur").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("member_settings").select("warn_pct,ef_months").eq("member_id", userId).maybeSingle(),
  ]);
  if (q.some((r) => r.error)) return fail("Could not read your data. Try again.", 502);
  const d = q.map((r) => r.data);
  const rows: AskRows = {
    members: d[0] as AskRows["members"],
    categories: d[1] as AskRows["categories"],
    transactions: d[2] as AskRows["transactions"],
    incomes: d[3] as AskRows["incomes"],
    recurring: d[4] as AskRows["recurring"],
    goals: d[5] as AskRows["goals"],
    debts: d[6] as AskRows["debts"],
    subscriptions: d[7] as AskRows["subscriptions"],
    assets: d[8] as AskRows["assets"],
    remittances: d[9] as AskRows["remittances"],
    businesses: d[10] as AskRows["businesses"],
    businessMonths: d[11] as AskRows["businessMonths"],
    taxDeadlines: d[12] as AskRows["taxDeadlines"],
    events: d[13] as AskRows["events"],
    yearlyGoals: d[14] as AskRows["yearlyGoals"],
    fxRate: (d[15] as { idr_per_eur: number } | null)?.idr_per_eur ?? DEFAULT_IDR_PER_EUR,
    warnPct: (d[16] as { warn_pct: number } | null)?.warn_pct ?? 80,
    efMonths: (d[16] as { ef_months: number } | null)?.ef_months ?? 6,
  };
  const memberIds = rows.members.map((m) => m.id);
  const scope = mode === "briefing" && body?.scope && memberIds.includes(body.scope) ? body.scope : mode === "briefing" ? "family" : userId;
  const context = buildContext(rows, userId, today, scope);

  const client = new Anthropic();
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: mode === "briefing" ? "low" : "medium", format: { type: "json_schema", schema: answerSchema() } },
      system: mode === "briefing" ? BRIEFING_PROMPT : ASK_PROMPT,
      messages: [
        { role: "user", content: `DATA (what ${context.asked_by} can see):\n${JSON.stringify(context)}` },
        { role: "assistant", content: "Understood. I will only use this data." },
        ...history,
        {
          role: "user",
          content: mode === "briefing" ? `Write today's briefing for ${context.view === "family" ? "the family" : context.view}.` : question,
        },
      ],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") return fail("Rialna can't help with that one.", 422);
    const text = msg.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text;
    if (!text) return fail("Rialna gave no answer. Try again.", 502);
    const a = JSON.parse(text) as { text: string; nums: { label: string; value: string }[]; next: string | null; action: string };
    return Response.json({
      text: a.text,
      nums: (a.nums ?? []).slice(0, 3),
      next: a.next || null,
      action: ACTIONS.includes(a.action as (typeof ACTIONS)[number]) ? a.action : "none",
    });
  } catch (e) {
    console.error("ask failed", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e));
    if (e instanceof Anthropic.RateLimitError) return fail("Rialna is busy. Try again in a minute.", 429);
    if (e instanceof Anthropic.AuthenticationError) return fail("The AI key is not valid. Check it in Vercel.", 503);
    return fail("Rialna is not reachable right now. Try again.", 502);
  }
}
