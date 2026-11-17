import type { Listing, LoanOfficer, PaymentSettings } from "./types";
import { LISTING_STATUSES } from "./types";
import { activeConcession, concessionBenefit, concessionEffect } from "./concessions";
import { principalAndInterest } from "./amortize";

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

/**
 * Principal & interest teaser shown on the social graphics. Uses the rate
 * sent with the listing, falling back to the loan officer's default.
 */
export function paymentInfo(l: Listing, lo: LoanOfficer) {
  if (!l.showPayment) return null;
  if (l.status === "just-sold" || l.status === "under-contract") return null;
  const ratePct = l.financing?.ratePct ?? lo.payment?.ratePct;
  if (ratePct == null) return null;
  const settings: PaymentSettings = {
    ratePct,
    downPaymentPct: lo.payment?.downPaymentPct ?? 20,
    termYears: lo.payment?.termYears ?? 30,
  };
  let monthly = monthlyPayment(l.price, settings);
  let apr = l.financing?.ratePct != null ? l.financing.aprPct : lo.payment?.aprPct;
  // A seller-paid permanent buydown lowers the advertised rate; temporary buydowns don't.
  let buydownNote = "";
  const c = activeConcession(l);
  if (c?.type === "permanent" && settings.termYears === 30) {
    const loanAmount = l.price * (1 - settings.downPaymentPct / 100);
    const e = concessionEffect(
      { program: "conventional", downPct: settings.downPaymentPct, loanAmount, ratePct, aprPct: apr, principalInterest: monthly, total: monthly, cashToClose: 0 },
      l.price,
      c,
    );
    if (e.rateCut > 0) {
      buydownNote = ` Reflects a seller-paid permanent buydown of ${e.points} discount points from ${ratePct}%.`;
      settings.ratePct = e.ratePct;
      monthly = e.principalInterest;
      apr = e.aprPct;
    }
  }
  return {
    monthly,
    ratePct: settings.ratePct,
    aprPct: apr,
    loanAmount: l.price * (1 - settings.downPaymentPct / 100),
    termYears: settings.termYears,
    label: `${formatPrice(monthly)}/mo*`,
    disclaimer: `*Est. principal & interest only on a ${settings.termYears}-yr fixed loan at ${settings.ratePct}% interest${apr ? ` (${apr}% APR)` : ""} with ${settings.downPaymentPct}% down.${buydownNote} Excludes taxes, insurance, HOA and PMI.${l.financing?.ratePct != null && l.financing.rateNote ? ` ${l.financing.rateNote}` : ""} Rates subject to change. Not a commitment to lend.`,
  };
}

/**
 * What the seller's incentive does for the buyer, for the graphics. Buyers
 * don't know what a "2-1 buydown" is, so lead with the rate they get:
 *
 *   5.255% year 1 · 6.255% year 2
 *   then 7.255% (7.356% APR)*
 *   Seller pays to lower your rate for the first 2 years
 *
 * Reg Z (12 CFR 1026.24(c), (f)(2)) treats a stated rate as a trigger: an ad
 * for a rate that changes must give every rate, how long each applies, and
 * the APR, with equal prominence. So the step-up and APR always sit in the
 * same type as the year-1 rate, and no rate is shown when there's no APR.
 */
export function buyerBenefit(l: Listing, lo: LoanOfficer): { big: string[]; line: string } | null {
  const c = activeConcession(l);
  if (!c) return null;
  const line = concessionBenefit(c);
  if (c.type === "closing-costs") return { big: [`${formatPrice(c.amount)} toward closing costs`], line };
  const pay = paymentInfo(l, lo);
  if (!pay || pay.termYears !== 30) return { big: [], line };
  if (c.type === "permanent") {
    // paymentInfo already shows the bought-down payment; show what it saves.
    const before = principalAndInterest(pay.loanAmount, (l.financing?.ratePct ?? lo.payment?.ratePct)!);
    const saved = before - pay.monthly;
    return { big: saved >= 1 ? [`Save ${formatPrice(Math.round(saved))}/mo*`] : [], line };
  }
  const e = concessionEffect(
    { program: "conventional", downPct: lo.payment?.downPaymentPct ?? 20, loanAmount: pay.loanAmount, ratePct: pay.ratePct, principalInterest: pay.monthly, total: pay.monthly, cashToClose: 0 },
    l.price,
    c,
  );
  if (!e.schedule.length || !pay.aprPct) return { big: [], line };
  const steps = e.schedule.slice(0, -1).map((y) => `${y.ratePct}% ${y.label.toLowerCase()}`);
  const note = `then ${pay.ratePct}% (${pay.aprPct}% APR)*`;
  // One step fits on one line; two or three steps get a line of their own.
  return { big: steps.length === 1 ? [`${steps[0]}, ${note}`] : [steps.join(" · "), note], line };
}

export function complianceLine(lo: LoanOfficer): string {
  const parts = [`${lo.name} NMLS #${lo.nmls}`];
  parts.push(lo.companyNmls ? `${lo.company} NMLS #${lo.companyNmls}` : lo.company);
  parts.push("Equal Housing Opportunity");
  return parts.join(" | ");
}

// Own It Social house palette. Loan officers can override brand/accent.
export const INK = "#0a0a0a";
export const PAPER = "#f4f3f1";
export const LINE = "#e4e3e0";
export const DEFAULT_BRAND = INK;
export const DEFAULT_ACCENT = "#8b3dff";
/** Neutral accent for generated graphics (warm stone), so they suit any brand. */
export const GRAPHIC_ACCENT = "#d9d2c5";

/** Black or white, whichever reads better on `hex`. */
export function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Pick whichever has the higher WCAG contrast ratio.
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.05 ? "#ffffff" : INK;
}

/** Colors for the generated graphics: neutral unless the LO set their own accent. */
export function graphicColors(lo: LoanOfficer) {
  const brand = lo.brandColor || DEFAULT_BRAND;
  const accent = lo.accentColor || GRAPHIC_ACCENT;
  return { brand, accent, onBrand: readableOn(brand), onAccent: readableOn(accent) };
}

/** Colors for the web kit page (Own It purple by default). */
export function brandColors(lo: LoanOfficer) {
  const brand = lo.brandColor || DEFAULT_BRAND;
  const accent = lo.accentColor || DEFAULT_ACCENT;
  return { brand, accent, onBrand: readableOn(brand), onAccent: readableOn(accent) };
}

const TEAM_WORDS = /\b(team|group|realty|homes|properties|partners|associates|collective|llc|inc)\b/i;

/** "Jordan Avery" → "Jordan". null for team or company names ("The Wheaton Group"). */
export function firstName(name: string): string | null {
  const words = name.trim().split(/\s+/).filter((w) => w && !/^the$/i.test(w));
  if (!words.length || TEAM_WORDS.test(name)) return null;
  return words[0];
}
