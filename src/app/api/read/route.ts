// Reads a receipt photo or a PDF bank statement with Claude (README → Bank
// import: PDF; Scan receipt). Runs on the server only: the API key never
// reaches the phone. Only signed-in members of the household may call it.

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { RECEIPT_PROMPT, STATEMENT_PROMPT, receiptSchema, statementSchema } from "@/lib/ai-read-schema";

export const maxDuration = 300;

const MODEL = "claude-opus-5-5";
const MAX_BYTES = 4 * 1024 * 1024; // Vercel accepts request bodies up to 4.5 MB
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return fail("Reading with AI is not set up yet.", 503);

  // 1. Who is asking? The person's own sign-in token, checked by Supabase.
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return fail("Please sign in again.", 401);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: who } = await sb.auth.getUser(token);
  if (!who.user) return fail("Please sign in again.", 401);
  const { data: me } = await sb.from("members").select("id").eq("id", who.user.id).maybeSingle();
  if (!me) return fail("Only family members can use this.", 403);

  // 2. The file.
  const form = await req.formData().catch(() => null);
  const kind = form?.get("kind");
  const file = form?.get("file");
  if ((kind !== "receipt" && kind !== "statement") || !(file instanceof File)) return fail("No file was sent.", 400);
  if (file.size > MAX_BYTES) return fail("The file is larger than 4 MB.", 413);
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");

  let source: Anthropic.Beta.BetaContentBlockParam;
  if (kind === "statement") {
    if (file.type !== "application/pdf") return fail("Please choose a PDF file.", 415);
    source = { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  } else {
    const type = IMAGE_TYPES.find((t) => t === file.type);
    if (!type) return fail("Please choose a photo (JPEG or PNG).", 415);
    source = { type: "image", source: { type: "base64", media_type: type, data } };
  }

  // 3. Categories of this household, so receipts get one of yours.
  const { data: cats } = await sb.from("categories").select("name").order("sort");
  const names = (cats ?? []).map((c) => c.name as string);

  const client = new Anthropic();
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: kind === "statement" ? 64000 : 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: {
        effort: kind === "statement" ? "medium" : "low",
        format: { type: "json_schema", schema: kind === "statement" ? statementSchema() : receiptSchema(names) },
      },
      system: kind === "statement" ? STATEMENT_PROMPT : RECEIPT_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            source,
            {
              type: "text",
              text:
                kind === "statement"
                  ? "Read every booked transaction in this bank statement."
                  : `Read this receipt. Categories to choose from: ${names.join(", ") || "(none)"}.`,
            },
          ],
        },
      ],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") return fail("The AI could not read this file.", 422);
    if (msg.stop_reason === "max_tokens") return fail("The statement is too long. Split it into shorter months.", 422);
    const text = msg.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text;
    if (!text) return fail("The AI gave no answer. Try again.", 502);
    return Response.json({ kind, result: JSON.parse(text) });
  } catch (e) {
    console.error("read failed", kind, e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e));
    if (e instanceof Anthropic.AuthenticationError) return fail("The AI key is not valid. Check it in Vercel.", 503);
    if (e instanceof Anthropic.RateLimitError) return fail("The AI is busy. Try again in a minute.", 429);
    if (e instanceof Anthropic.BadRequestError) return fail("The AI could not handle this request. If it keeps happening, check the credit in the Anthropic console.", 422);
    if (e instanceof Anthropic.APIError) return fail(`The AI is not reachable right now (${e.status}).`, 502);
    return fail("Something went wrong while reading.", 500);
  }
}
