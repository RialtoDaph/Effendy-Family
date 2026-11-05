// Stripe tells this route what was paid. The only writer of a paid plan: the signature
// proves the sender, and the write uses the server key because no signed-in person is here.

import type Stripe from "stripe";
import { billStatus, PLANS, planOfPrice } from "@/lib/plans";
import { billingAdmin, stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const client = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sb = billingAdmin();
  if (!client || !secret || !sb) return new Response("not configured", { status: 503 });

  let event: Stripe.Event;
  try {
    event = client.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("bad signature", { status: 400 });
  }
  if (!["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    return Response.json({ received: true });
  }

  const sub = event.data.object as Stripe.Subscription;
  const household = sub.metadata.household_id;
  const item = sub.items.data[0];
  const bought = item && planOfPrice(item.price.id, process.env);
  if (!household || !bought) {
    console.error("stripe event without household or known price", event.id);
    return Response.json({ received: true });
  }

  const { error } = await sb
    .from("subscriptions_billing")
    .update({
      plan: bought.plan,
      interval: bought.interval,
      status: billStatus(sub.status),
      seats: PLANS[bought.plan].seats,
      provider_ref: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      current_period_end: new Date(item.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("household_id", household);
  // A failed write answers 500, so Stripe sends the event again.
  if (error) return new Response("write failed", { status: 500 });
  return Response.json({ received: true });
}
