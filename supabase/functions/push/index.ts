// Sends reminders to phones (Web Push). Called by:
//   pg_cron every 15 minutes   {"action":"run"}   sends what private.push_due() says is due
//   the app                    {"action":"key"}   the public VAPID key for subscribing
//   the app (signed in)        {"action":"test", "endpoint"?}   one test reminder
// "run" sends only reminders that are due and not sent yet, so calling it
// more often changes nothing. The VAPID key pair is made here on first use
// and kept in private.push_keys; the private key never leaves the server.

import postgres from "npm:postgres@3.4.5";
import { generateVapidKeys, sendPush, type VapidKeys } from "./webpush.ts";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 3 });
const SUBJECT = "https://effendyfamily.vercel.app";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

let keys: VapidKeys | null = null;

async function vapid(): Promise<VapidKeys> {
  if (keys) return keys;
  let [row] = await sql`select public_key, private_jwk from private.push_keys where id = 1`;
  if (!row) {
    const k = await generateVapidKeys();
    await sql`insert into private.push_keys (public_key, private_jwk)
              values (${k.publicKey}, ${sql.json(k.privateJwk as Record<string, string>)}) on conflict (id) do nothing`;
    [row] = await sql`select public_key, private_jwk from private.push_keys where id = 1`;
  }
  keys = { publicKey: row.public_key, privateJwk: row.private_jwk };
  return keys;
}

type Item = { member_id: string; key: string; title: string; body: string; url: string };
type Sub = { id: string; member_id: string; endpoint: string; p256dh: string; auth: string };

async function deliver(items: Item[], subs: Sub[]) {
  const k = await vapid();
  let sent = 0;
  let failed = 0;
  const gone: string[] = [];
  await Promise.all(
    items.flatMap((it) =>
      subs
        .filter((s) => s.member_id === it.member_id)
        .map(async (s) => {
          try {
            const payload = JSON.stringify({ title: it.title, body: it.body, url: it.url, tag: it.key });
            const status = await sendPush(s, payload, k, SUBJECT);
            if (status === 404 || status === 410) gone.push(s.id);
            else if (status < 300) sent++;
            else {
              failed++;
              console.log("push refused", status, new URL(s.endpoint).host);
            }
          } catch (e) {
            failed++;
            console.log("push error", new URL(s.endpoint).host, String(e));
          }
        }),
    ),
  );
  if (gone.length) await sql`delete from public.push_subscriptions where id = any(${gone}::uuid[])`;
  return { sent, failed, removed: gone.length };
}

/** The signed-in user's id, checked by Supabase Auth. */
async function userId(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const apikey =
    JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, { headers: { Authorization: auth, apikey } });
  if (!res.ok) return null;
  const user = await res.json();
  return typeof user?.id === "string" ? (user.id as string) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const { action, endpoint } = await req.json().catch(() => ({}));

  try {
    if (action === "key") return json({ publicKey: (await vapid()).publicKey });

    if (action === "run") {
      const items = await sql<Item[]>`select member_id, key, title, body, url from private.push_due()`;
      if (!items.length) return json({ due: 0 });
      const ids = [...new Set(items.map((i) => i.member_id))];
      const subs = await sql<Sub[]>`select id, member_id, endpoint, p256dh, auth
                                    from public.push_subscriptions where member_id = any(${ids}::uuid[])`;
      return json({ due: items.length, ...(await deliver(items, subs)) });
    }

    if (action === "test") {
      const uid = await userId(req);
      if (!uid) return json({ error: "Please sign in again." }, 401);
      const minute = new Date().toISOString().slice(0, 16);
      const claimed = await sql`insert into private.push_log (member_id, key) values (${uid}, ${"test:" + minute})
                                on conflict do nothing returning key`;
      if (!claimed.length) return json({ error: "One test per minute. Try again shortly." }, 429);
      const subs = await sql<Sub[]>`select id, member_id, endpoint, p256dh, auth from public.push_subscriptions
                                    where member_id = ${uid} and (${endpoint ?? null}::text is null or endpoint = ${endpoint ?? null})`;
      if (!subs.length) return json({ error: "This phone is not set up for reminders yet." }, 404);
      const item: Item = {
        member_id: uid,
        key: "test",
        title: "Rent goes out tomorrow",
        body: "This is a test · reminders work on this phone",
        url: "/settings",
      };
      return json(await deliver([item], subs));
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.log("push function error", String(e));
    return json({ error: "Something went wrong." }, 500);
  }
});
