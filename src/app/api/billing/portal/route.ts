// Opens Stripe's billing portal: card, invoices, change or cancel.

import { authorize } from "@/lib/server-auth";
import { billingAdmin, stripe } from "@/lib/stripe";

const fail = (code: string, status: number) => Response.json({ code }, { status });

export async function POST(req: Request) {
  const client = stripe();
  const admin = billingAdmin();
  if (!client || !admin) return fail("not_configured", 503);
  const auth = await authorize(req);
  if (auth instanceof Response) return auth;
  const { sb, userId } = auth;

  const { data: me } = await sb.from("members").select("role,household_id").eq("id", userId).single();
  if (me?.role !== "owner") return fail("not_allowed", 403);
  const { data: bill } = await admin.from("subscriptions_billing").select("provider_ref").eq("household_id", me.household_id).maybeSingle();
  if (!bill?.provider_ref) return fail("no_customer", 409);

  const body = (await req.json().catch(() => null)) as { locale?: string } | null;
  const prefix = body?.locale && body.locale !== "en" ? `/${body.locale}` : "";
  const session = await client.billingPortal.sessions.create({ customer: bill.provider_ref, return_url: `${new URL(req.url).origin}${prefix}/plan` });
  return Response.json({ url: session.url });
}
