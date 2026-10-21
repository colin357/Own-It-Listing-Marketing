import type { Agent, Listing, ListingStatus, LoanOfficer, OpenHouse, PaymentSettings } from "./types";
import { LISTING_STATUSES } from "./types";
import { slugify } from "./format";

/**
 * Input normalization shared by the JSON API (Zapier / Make / CRM webhooks)
 * and the admin forms. It is deliberately forgiving: numbers may arrive as
 * "$450,000", lists may arrive as newline/comma separated strings, and agent
 * fields may be nested (`agent.name`) or flat (`agentName`).
 */

export class ValidationError extends Error {
  constructor(public issues: string[]) {
    super(issues.join("; "));
  }
}

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function list(v: unknown, splitUrls = false): string[] {
  if (v == null) return [];
  // URLs may legitimately contain commas, so only split on a comma that starts a new URL.
  const arr = Array.isArray(v) ? v : String(v).split(splitUrls ? /\n+|,\s*(?=https?:)/ : /\n+/);
  return arr.map((x) => String(x).trim()).filter(Boolean);
}

function bool(v: unknown, fallback: boolean): boolean {
  if (v == null || v === "") return fallback;
  if (typeof v === "boolean") return v;
  return ["1", "true", "on", "yes"].includes(String(v).toLowerCase());
}

function hex(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  const h = s.startsWith("#") ? s : `#${s}`;
  return /^#[0-9a-fA-F]{6}$/.test(h) ? h : undefined;
}

function url(v: unknown, field: string, issues: string[]): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    return u.toString();
  } catch {
    issues.push(`${field} must be a valid http(s) URL`);
    return undefined;
  }
}

function pick(raw: Raw, ...keys: string[]): unknown {
  for (const k of keys) {
    const parts = k.split(".");
    let cur: unknown = raw;
    for (const p of parts) cur = cur && typeof cur === "object" ? (cur as Raw)[p] : undefined;
    if (cur != null && cur !== "") return cur;
  }
  return undefined;
}

function normalizeStatus(v: unknown): ListingStatus {
  const s = slugify(str(v) ?? "just-listed");
  if (s in LISTING_STATUSES) return s as ListingStatus;
  if (s === "sold") return "just-sold";
  if (s === "pending") return "under-contract";
  if (s === "price-reduced" || s === "price-reduction" || s === "price-improvement") return "price-improved";
  return "just-listed";
}

export function parseListingInput(raw: Raw, existing?: Listing): Omit<Listing, "slug"> & { slug?: string } {
  const issues: string[] = [];
  const now = new Date().toISOString();

  const agent: Agent = {
    name: str(pick(raw, "agentName", "agent.name")) ?? "",
    phone: str(pick(raw, "agentPhone", "agent.phone")),
    email: str(pick(raw, "agentEmail", "agent.email")),
    brokerage: str(pick(raw, "agentBrokerage", "brokerage", "agent.brokerage")),
    license: str(pick(raw, "agentLicense", "agent.license")),
    headshotUrl: url(pick(raw, "agentHeadshotUrl", "agent.headshotUrl"), "agent.headshotUrl", issues),
  };

  let openHouse: OpenHouse | undefined;
  const ohDate = str(pick(raw, "openHouseDate", "openHouse.date"));
  if (ohDate) {
    openHouse = {
      date: ohDate,
      startTime: str(pick(raw, "openHouseStart", "openHouse.startTime")) ?? "",
      endTime: str(pick(raw, "openHouseEnd", "openHouse.endTime")) ?? "",
    };
  }

  const listing = {
    slug: str(raw.slug) ? slugify(String(raw.slug)) : existing?.slug,
    loanOfficerSlug: str(pick(raw, "loanOfficerSlug", "loanOfficer")) ?? "",
    status: normalizeStatus(raw.status),
    address: str(pick(raw, "address", "street")) ?? "",
    unit: str(raw.unit),
    city: str(raw.city) ?? "",
    state: (str(raw.state) ?? "").toUpperCase(),
    zip: str(pick(raw, "zip", "postalCode")) ?? "",
    price: num(raw.price) ?? NaN,
    beds: num(pick(raw, "beds", "bedrooms")),
    baths: num(pick(raw, "baths", "bathrooms")),
    sqft: num(pick(raw, "sqft", "squareFeet")),
    lotSize: str(raw.lotSize),
    yearBuilt: num(raw.yearBuilt),
    description: str(raw.description),
    highlights: list(raw.highlights),
    photos: list(pick(raw, "photos", "photoUrls"), true)
      .map((p, i) => url(p, `photos[${i}]`, issues))
      .filter((p): p is string => !!p),
    listingUrl: url(raw.listingUrl, "listingUrl", issues),
    openHouse,
    agent,
    showPayment: bool(raw.showPayment, existing?.showPayment ?? true),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (!listing.loanOfficerSlug) issues.push("loanOfficerSlug is required");
  if (!listing.address) issues.push("address is required");
  if (!listing.city) issues.push("city is required");
  if (!listing.state) issues.push("state is required");
  if (!Number.isFinite(listing.price) || listing.price <= 0) issues.push("price must be a positive number");
  if (!agent.name) issues.push("agent.name is required");
  if (openHouse && (!openHouse.startTime || !openHouse.endTime))
    issues.push("openHouse needs startTime and endTime");

  if (issues.length) throw new ValidationError(issues);
  return listing;
}

export function parseLoanOfficerInput(raw: Raw, existing?: LoanOfficer): LoanOfficer {
  const issues: string[] = [];
  const now = new Date().toISOString();
  const name = str(raw.name) ?? "";

  let payment: PaymentSettings | undefined;
  const ratePct = num(pick(raw, "paymentRatePct", "payment.ratePct"));
  if (ratePct != null) {
    payment = {
      ratePct,
      downPaymentPct: num(pick(raw, "paymentDownPct", "payment.downPaymentPct")) ?? 20,
      termYears: num(pick(raw, "paymentTermYears", "payment.termYears")) ?? 30,
    };
  }

  const lo: LoanOfficer = {
    slug: existing?.slug ?? slugify(str(raw.slug) ?? name),
    name,
    title: str(raw.title),
    nmls: str(raw.nmls) ?? "",
    company: str(raw.company) ?? "",
    companyNmls: str(raw.companyNmls),
    phone: str(raw.phone),
    email: str(raw.email),
    applyUrl: url(raw.applyUrl, "applyUrl", issues),
    headshotUrl: url(raw.headshotUrl, "headshotUrl", issues),
    logoUrl: url(raw.logoUrl, "logoUrl", issues),
    brandColor: hex(raw.brandColor),
    accentColor: hex(raw.accentColor),
    disclaimer: str(raw.disclaimer),
    payment,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (!lo.name) issues.push("name is required");
  if (!lo.slug) issues.push("slug could not be derived from name");
  if (!lo.nmls) issues.push("nmls is required");
  if (!lo.company) issues.push("company is required");
  if (issues.length) throw new ValidationError(issues);
  return lo;
}
