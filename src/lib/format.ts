import type { Listing, LoanOfficer, PaymentSettings } from "./types";
import { LISTING_STATUSES } from "./types";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function statusLabel(listing: Listing): string {
  return LISTING_STATUSES[listing.status];
}

export function streetLine(l: Listing): string {
  return l.unit ? `${l.address} ${l.unit}` : l.address;
}

export function cityLine(l: Listing): string {
  return `${l.city}, ${l.state} ${l.zip}`.trim();
}

export function fullAddress(l: Listing): string {
  return `${streetLine(l)}, ${cityLine(l)}`;
}

/** "4 Beds · 3 Baths · 2,450 Sq Ft" */
export function statsLine(l: Listing, sep = " · "): string {
  const parts: string[] = [];
  if (l.beds != null) parts.push(`${l.beds} Bed${l.beds === 1 ? "" : "s"}`);
  if (l.baths != null) parts.push(`${l.baths} Bath${l.baths === 1 ? "" : "s"}`);
  if (l.sqft != null) parts.push(`${formatNumber(l.sqft)} Sq Ft`);
  return parts.join(sep);
}

export function formatOpenHouse(l: Listing): string | null {
  if (!l.openHouse) return null;
  const d = new Date(`${l.openHouse.date}T12:00:00`);
  const day = isNaN(d.getTime())
    ? l.openHouse.date
    : d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return `${day} · ${l.openHouse.startTime} – ${l.openHouse.endTime}`;
}

/** Principal & interest only. */
export function monthlyPayment(price: number, p: PaymentSettings): number {
  const principal = price * (1 - p.downPaymentPct / 100);
  const r = p.ratePct / 100 / 12;
  const n = p.termYears * 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

/** Returns payment info when it should be shown for this listing, otherwise null. */
export function paymentInfo(l: Listing, lo: LoanOfficer) {
  if (!lo.payment || !l.showPayment) return null;
  if (l.status === "just-sold" || l.status === "under-contract") return null;
  const monthly = monthlyPayment(l.price, lo.payment);
  return {
    monthly,
    label: `${formatPrice(monthly)}/mo*`,
    disclaimer: `*Est. principal & interest only on a ${lo.payment.termYears}-yr fixed loan at ${lo.payment.ratePct}% interest with ${lo.payment.downPaymentPct}% down. Excludes taxes, insurance, HOA and PMI. Rates subject to change. Not a commitment to lend.`,
  };
}

export function complianceLine(lo: LoanOfficer): string {
  const parts = [`${lo.name} NMLS #${lo.nmls}`];
  parts.push(lo.companyNmls ? `${lo.company} NMLS #${lo.companyNmls}` : lo.company);
  parts.push("Equal Housing Opportunity");
  return parts.join(" | ");
}

export const DEFAULT_BRAND = "#0f2a44";
export const DEFAULT_ACCENT = "#c8a24a";

export function brandColors(lo: LoanOfficer) {
  return {
    brand: lo.brandColor || DEFAULT_BRAND,
    accent: lo.accentColor || DEFAULT_ACCENT,
  };
}
