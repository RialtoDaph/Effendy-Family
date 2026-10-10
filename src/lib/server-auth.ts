// Server routes only: checks the person's own sign-in token with Supabase and
// returns a database client that acts as that person, so Row Level Security
// decides what they (and anything working for them, like Rialna) can read.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Authorized = { sb: SupabaseClient; userId: string };

export async function authorize(req: Request): Promise<Authorized | Response> {
  const fail = (error: string, status: number) => Response.json({ error }, { status });
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
  return { sb, userId: who.user.id };
}
