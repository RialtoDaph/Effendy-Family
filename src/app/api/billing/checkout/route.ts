// Starts Stripe Checkout for a plan. Only the household's owner pays.

import { PLANS, priceEnv, type BillInterval, type PlanKey } from "@/lib/plans";
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

  const body = (await req.json().catch(() => null)) as { plan?: PlanKey; interval?: BillInterval; locale?: string } | null;
  const plan = body?.plan && body.plan in PLANS ? body.plan : null;
  const interval = body?.interval === "year" ? "year" : "month";
  const price = plan && process.env[priceEnv(plan, interval)];
  if (!price) return fail("not_configured", 503);

  const { data: me } = await sb.from("members").select("role,household_id,email").eq("id", userId).single();
  if (me?.role !== "owner") return fail("not_allowed", 403);
  const { data: bill } = await admin.from("subscriptions_billing").select("provider_ref,status").eq("household_id", me.household_id).maybeSingle();
  // A running subscription changes in the portal; a second Checkout would charge twice.
  if (bill?.provider_ref && (bill.status === "active" || bill.status === "past_due")) return fail("use_portal", 409);

  const origin = new URL(req.url).origin;
  const prefix = body?.locale && body.locale !== "en" ? `/${body.locale}` : "";
  const session = await client.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: me.household_id,
    subscription_data: { metadata: { household_id: me.household_id } },
    ...(bill?.provider_ref ? { customer: bill.provider_ref } : { customer_email: me.email ?? undefined }),
    success_url: `${origin}${prefix}/plan?paid=1`,
    cancel_url: `${origin}${prefix}/plan`,
  });
  return Response.json({ url: session.url });
}
