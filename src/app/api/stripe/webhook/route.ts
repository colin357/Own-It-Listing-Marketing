import type Stripe from "stripe";
import { activateCheckout, stripe, syncSubscription } from "@/lib/billing";
import { originFromRequest } from "@/lib/site";

/**
 * Stripe webhook. In the Stripe dashboard (Developers → Webhooks) point an
 * endpoint at https://kits.ownitsocial.com/api/stripe/webhook with these
 * events, and put its signing secret in STRIPE_WEBHOOK_SECRET:
 *   checkout.session.completed
 *   customer.subscription.created / updated / deleted
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "STRIPE_WEBHOOK_SECRET is not set" }, { status: 501 });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, req.headers.get("stripe-signature") ?? "", secret);
  } catch (err) {
    return Response.json({ error: `Bad signature: ${(err as Error).message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        if (event.data.object.mode === "subscription") await activateCheckout(event.data.object.id, originFromRequest(req));
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
    }
  } catch (err) {
    console.error(`Stripe ${event.type} failed`, err);
    // 500 makes Stripe retry later.
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
  return Response.json({ received: true });
}
