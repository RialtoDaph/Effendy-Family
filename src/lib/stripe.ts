// Server only. Stripe holds the card; this app holds the plan and the customer id.

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const stripe = () => (process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null);

/** Writes billing and reads the customer id, which signed-in people never see. Needs the server key. */
export function billingAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  return key ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}
