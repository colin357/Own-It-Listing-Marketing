import type { LoanOfficer } from "./types";

/** The self-signup plan sold on the landing page. Change the price here and in Stripe together. */
export const PLAN = {
  name: "Listing Kits",
  priceUsd: 150,
  interval: "month" as const,
  trialDays: 7,
  /** Stripe price lookup key; the price is created on first checkout if it doesn't exist. */
  lookupKey: "listing-kits-monthly-150",
};

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "team@ownitsocial.com";

/** Stripe statuses that keep kits coming. past_due is a grace period while Stripe retries the card. */
const LIVE = new Set(["trialing", "active", "past_due"]);

/**
 * Whether this loan officer gets new kits (detection, the kit builder, emails).
 * Loan officers Own It manages have no billing record and are always active.
 */
export function isActive(lo: Pick<LoanOfficer, "billing">): boolean {
  return !lo.billing || LIVE.has(lo.billing.status);
}

export function isSelfServe(lo: Pick<LoanOfficer, "billing">): boolean {
  return !!lo.billing;
}

export function billingLabel(lo: Pick<LoanOfficer, "billing">): string {
  const b = lo.billing;
  if (!b) return "Managed client";
  const date = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  if (b.status === "trialing" && b.cancelAtPeriodEnd) return `Free trial, ends ${date(b.trialEnd)} (canceled)`;
  if (b.status === "trialing") return `Free trial until ${date(b.trialEnd)}`;
  if (b.status === "active" && b.cancelAtPeriodEnd) return `Active, ends ${date(b.currentPeriodEnd)}`;
  if (b.status === "active") return `Active, renews ${date(b.currentPeriodEnd)}`;
  if (b.status === "past_due") return "Payment failed, retrying";
  if (b.status === "canceled") return "Canceled";
  return b.status.replace(/_/g, " ");
}
