import "server-only";
import Stripe from "stripe";
import { documents, loanOfficers, locks, uniqueSlug } from "./store";
import { slugify } from "./format";
import { PLAN } from "./plan";
import { accountPath } from "./loLinks";
import { mailConfigured, sendMail } from "./mail";
import type { Billing, LoanOfficer } from "./types";

/**
 * Self-signup billing. A loan officer fills in the signup form, pays (or
 * starts the free trial) in Stripe Checkout, and their loan officer record
 * is created when the checkout completes: from the success page or the
 * webhook, whichever comes first. The webhook then keeps `billing` in sync
 * with the subscription, which decides whether they keep getting kits
 * (isActive in plan.ts).
 *
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, optional STRIPE_PRICE_ID
 * (otherwise a $150/month price is found or created by its lookup key).
 */

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Payments aren't set up yet (STRIPE_SECRET_KEY).");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

/** Test-mode keys start sk_test_; the landing page says so, so nobody thinks a test card was charged. */
export function stripeTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
}

/** The monthly price: STRIPE_PRICE_ID, or the one with our lookup key, created the first time. */
async function planPrice(): Promise<string> {
  if (process.env.STRIPE_PRICE_ID) return process.env.STRIPE_PRICE_ID;
  const s = stripe();
  const found = await s.prices.list({ lookup_keys: [PLAN.lookupKey], active: true, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  const product = await s.products.create({
    name: PLAN.name,
    description: "Listing marketing kits for your agents' new listings, by Own It Social.",
  });
  const price = await s.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: PLAN.priceUsd * 100,
    recurring: { interval: PLAN.interval },
    lookup_key: PLAN.lookupKey,
  });
  return price.id;
}

/** What the signup form collects. Carried through Checkout as metadata. */
export interface SignupInput {
  name: string;
  email: string;
  phone?: string;
  title?: string;
  company: string;
  nmls: string;
  companyNmls?: string;
}

/**
 * Stripe Checkout for the plan. New signups get the free trial; a loan
 * officer restarting a canceled subscription (`customerId`) pays from day one.
 */
export async function createCheckout(
  input: SignupInput,
  origin: string,
  customerId?: string,
  cancelPath = "/signup?canceled=1",
): Promise<string> {
  const metadata: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) if (v) metadata[k] = String(v).slice(0, 450);
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: await planPrice(), quantity: 1 }],
    ...(customerId ? { customer: customerId } : { customer_email: input.email }),
    metadata,
    subscription_data: { trial_period_days: (!customerId && PLAN.trialDays) || undefined, metadata },
    // Card up front, even for the free trial.
    payment_method_collection: "always",
    allow_promotion_codes: true,
    success_url: `${origin}/signup/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${cancelPath}`,
  });
  if (!session.url) throw new Error("Stripe didn't return a checkout page.");
  return session.url;
}

const customerKey = (customerId: string) => `stripe-customer-${customerId}`;

function billingFrom(sub: Stripe.Subscription, signedUpAt?: string): Billing {
  const iso = (secs?: number | null) => (secs ? new Date(secs * 1000).toISOString() : undefined);
  const periodEnd = sub.items.data[0]?.current_period_end;
  const now = new Date().toISOString();
  return {
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    subscriptionId: sub.id,
    status: sub.status,
    trialEnd: iso(sub.trial_end),
    currentPeriodEnd: iso(periodEnd),
    cancelAtPeriodEnd: sub.cancel_at_period_end || !!sub.cancel_at,
    signedUpAt: signedUpAt ?? iso(sub.created) ?? now,
    updatedAt: now,
  };
}

export async function loForCustomer(customerId: string): Promise<LoanOfficer | null> {
  const slug = await documents.get<string>(customerKey(customerId));
  return slug ? loanOfficers.get(slug) : null;
}

/**
 * Creates the loan officer for a completed checkout, once. Safe to call from
 * both the success page and the webhook. Returns the loan officer, or null
 * if the checkout isn't finished.
 */
export async function activateCheckout(sessionId: string, origin: string): Promise<LoanOfficer | null> {
  const s = stripe();
  const session = await s.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  if (session.status !== "complete" || !session.customer || !session.subscription) return null;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer.id;
  const sub =
    typeof session.subscription === "string" ? await s.subscriptions.retrieve(session.subscription) : session.subscription;

  // A returning customer restarting their subscription keeps their record.
  const existing = await loForCustomer(customerId);
  if (existing) return (await syncSubscription(sub)) ?? existing;

  // The success page and the webhook can arrive together; only one creates the record.
  const lock = await locks.acquire(`checkout-${sessionId}`, 60);
  if (!lock) {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const lo = await loForCustomer(customerId);
      if (lo) return lo;
    }
    return null;
  }
  try {
    const again = await loForCustomer(customerId);
    if (again) return (await syncSubscription(sub)) ?? again;
    const m = session.metadata ?? {};
    const name = m.name || session.customer_details?.name || "Loan officer";
    const now = new Date().toISOString();
    const lo: LoanOfficer = {
      slug: await uniqueSlug(loanOfficers, slugify(name) || "loan-officer"),
      name,
      title: m.title || undefined,
      nmls: m.nmls ?? "",
      company: m.company ?? "",
      companyNmls: m.companyNmls || undefined,
      phone: m.phone || undefined,
      email: m.email || session.customer_details?.email || session.customer_email || undefined,
      showPayments: true,
      billing: billingFrom(sub, now),
      createdAt: now,
      updatedAt: now,
    };
    await loanOfficers.save(lo);
    await documents.set(customerKey(customerId), lo.slug);
    await s.customers.update(customerId, { metadata: { loanOfficerSlug: lo.slug } }).catch(() => {});
    await sendWelcome(lo, origin).catch((err) => console.error("Welcome email failed", err));
    return lo;
  } finally {
    await locks.release(`checkout-${sessionId}`, lock);
  }
}

/** Copies a subscription change (trial ended, card failed, canceled…) onto the loan officer. */
export async function syncSubscription(sub: Stripe.Subscription): Promise<LoanOfficer | null> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const lo = await loForCustomer(customerId);
  if (!lo) return null;
  // An older subscription for the same customer must not overwrite a newer one.
  if (lo.billing?.subscriptionId && lo.billing.subscriptionId !== sub.id && sub.status === "canceled") return lo;
  const updated: LoanOfficer = { ...lo, billing: billingFrom(sub, lo.billing?.signedUpAt), updatedAt: new Date().toISOString() };
  await loanOfficers.save(updated);
  return updated;
}

/** Stripe's hosted page for changing the card, seeing invoices or canceling. */
export async function billingPortalUrl(lo: LoanOfficer, returnUrl: string): Promise<string> {
  if (!lo.billing) throw new Error("No billing account");
  const session = await stripe().billingPortal.sessions.create({ customer: lo.billing.customerId, return_url: returnUrl });
  return session.url;
}

/** Self-signup loan officers with this email (case-insensitive). */
export async function findByEmail(email: string): Promise<LoanOfficer[]> {
  const e = email.trim().toLowerCase();
  if (!e) return [];
  return (await loanOfficers.list()).filter((lo) => lo.email?.trim().toLowerCase() === e);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function emailShell(body: string): string {
  return `<div style="background:#f4f3f1;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#0a0a0a">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px">
    <p style="margin:0 0 24px;text-align:center;font-family:'Arial Black',Arial,sans-serif;font-weight:900;font-size:22px;letter-spacing:-0.5px;line-height:1">OWN IT<br>SOCIAL</p>
    ${body}
  </div>
</div>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0"><tr><td style="background:#0a0a0a;border-radius:999px;padding:14px 28px"><a href="${esc(href)}" style="color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;letter-spacing:1px;text-transform:uppercase">${esc(label)}</a></td></tr></table>`;
}

/** Account link email: sent after signup and whenever someone asks to sign in. */
export async function sendAccountLink(lo: LoanOfficer, origin: string, welcome = false): Promise<string[]> {
  if (!lo.email) return ["No email address on file"];
  const link = `${origin}${accountPath(lo.slug)}`;
  const first = lo.name.split(/\s+/)[0];
  const body = welcome
    ? `<p style="font-size:16px;line-height:1.6;margin:0 0 14px">Hi ${esc(first)},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 14px">Welcome to Listing Kits. Our team will reach out to get your headshot and logo and to set up the agents you work with and the areas you cover.</p>
    ${button(link, "Finish setup")}
    <p style="font-size:14px;line-height:1.6;margin:0 0 14px;color:#5b5b5b">Once your agents are set up, we check for their new listings every Monday and Thursday morning and email you each finished kit. You can build a kit for any listing yourself from your account page today.</p>
    <p style="font-size:14px;line-height:1.6;margin:0;color:#5b5b5b">Keep this email: the button is your private sign-in link.</p>`
    : `<p style="font-size:16px;line-height:1.6;margin:0 0 14px">Hi ${esc(first)},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 14px">Here's your sign-in link for Listing Kits.</p>
    ${button(link, "Open my account")}
    <p style="font-size:14px;line-height:1.6;margin:0;color:#5b5b5b">If you didn't ask for this, you can ignore it.</p>`;
  return sendMail([
    { to: [lo.email], subject: welcome ? "Welcome to Listing Kits: finish your setup" : "Your Listing Kits sign-in link", html: emailShell(body) },
  ]);
}

async function sendWelcome(lo: LoanOfficer, origin: string) {
  if (!mailConfigured()) return;
  const errors = await sendAccountLink(lo, origin, true);
  if (errors.length) console.error(errors.join("; "));
  // Let the team know someone signed up.
  const notify = process.env.SIGNUP_NOTIFY_EMAIL || process.env.MAIL_FROM;
  if (notify)
    await sendMail([
      {
        to: [notify],
        subject: `New Listing Kits signup: ${lo.name}`,
        html: emailShell(
          `<p style="font-size:15px;line-height:1.6">${esc(lo.name)}${lo.title ? `, ${esc(lo.title)}` : ""}<br>${esc(lo.company)} · NMLS #${esc(lo.nmls)}<br>${esc(lo.email ?? "")}${lo.phone ? ` · ${esc(lo.phone)}` : ""}</p><p style="font-size:15px;line-height:1.6">Started a ${PLAN.trialDays}-day free trial.</p>${button(`${origin}/admin/loan-officers`, "Open admin")}`,
        ),
      },
    ]);
}
