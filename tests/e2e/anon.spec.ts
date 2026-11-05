import fs from "node:fs";
import { expect, test } from "@playwright/test";

// The real project, with only the public key: someone without an account reads nothing.
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => /^NEXT_PUBLIC/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const base = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const TABLES = "ai_memories ai_messages ai_pending_actions ai_sessions alerts_state assets business_months businesses career_steps categories date_ideas date_nights debt_settings debts events feedback files fx_rates goal_progress goals gym_sessions households import_mappings inbox_digests incomes invites journal_entries learning_items learning_minutes member_settings members merchant_rules networth_history passkeys push_subscriptions recurring remittances security subscriptions_billing tax_deadlines tax_deductions tax_years transactions usage week_priorities yearly_goals".split(" ");

test("no table answers without an account", async ({ request }) => {
  test.skip(!base || !key, "needs .env.local");
  const open: string[] = [];
  for (const t of TABLES) {
    const res = await request.get(`${base}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: key } });
    if (res.ok() && ((await res.json()) as unknown[]).length) open.push(t);
  }
  expect(open).toEqual([]);
});
