export const LISTING_STATUSES = {
  "coming-soon": "Coming Soon",
  "just-listed": "Just Listed",
  // Kits a loan officer builds by hand are for homes that have been on the market a while.
  featured: "Featured Listing",
  "new-construction": "New Construction",
  "open-house": "Open House",
  "price-improved": "Price Improved",
  "under-contract": "Under Contract",
  "just-sold": "Just Sold",
} as const;

export type ListingStatus = keyof typeof LISTING_STATUSES;

/** How buyers can use a seller concession (see src/lib/concessions.ts). */
export const BUYDOWN_TYPES = ["2-1", "1-0", "3-2-1", "permanent", "closing-costs"] as const;

export type BuydownType = (typeof BUYDOWN_TYPES)[number];

/** Seller concession the agent is offering, in dollars, and how buyers can use it. */
export interface Concession {
  amount: number;
  type: BuydownType;
}

export interface PaymentSettings {
  /** Annual interest rate, e.g. 6.75 */
  ratePct: number;
  /** APR for that rate. Reg Z requires it whenever an ad states a rate or payment. */
  aprPct?: number;
  /** Down payment percentage, e.g. 20 */
  downPaymentPct: number;
  termYears: number;
}

/** Square crop of a headshot: centre as a fraction of the image (0–1), zoom 1 = largest square that fits. */
export interface HeadshotCrop {
  x: number;
  y: number;
  zoom: number;
}

/** A client of ours. Every listing kit is co-branded with one loan officer. */
export interface LoanOfficer {
  slug: string;
  name: string;
  title?: string;
  nmls: string;
  company: string;
  companyNmls?: string;
  phone?: string;
  email?: string;
  /** Assistants and others copied (CC) on every kit email this loan officer gets. */
  ccEmails?: string[];
  /** Apply / pre-qualify link used for QR codes and CTAs. */
  applyUrl?: string;
  headshotUrl?: string;
  /** How the headshot is framed in the circle on graphics and pages. Set in admin; absent = centred. */
  headshotCrop?: HeadshotCrop;
  logoUrl?: string;
  /** Primary brand color (hex). */
  brandColor?: string;
  /** Accent color (hex). */
  accentColor?: string;
  /** Extra compliance text appended to every material. */
  disclaimer?: string;
  /** false hides payment estimates and the financing flyers on this LO's kits. */
  showPayments?: boolean;
  /** When set, materials show an estimated monthly payment. */
  payment?: PaymentSettings;
  /** Set on loan officers who signed up and pay through Stripe. Absent for clients Own It manages. */
  billing?: Billing;
  createdAt: string;
  updatedAt: string;
}

/** The listing agent (the loan officer's referral partner). */
export interface Agent {
  name: string;
  phone?: string;
  email?: string;
  brokerage?: string;
  license?: string;
  headshotUrl?: string;
}

export interface OpenHouse {
  /** YYYY-MM-DD */
  date: string;
  /** e.g. "1:00 PM" */
  startTime: string;
  endTime: string;
}

/**
 * Per-listing financing inputs, usually sent by the webhook. Drives the
 * payment-options flyer and the "Est. $X/mo" teaser on the other graphics.
 */
export interface Financing {
  /** Conventional note rate, e.g. 6.375 */
  ratePct: number;
  /** Conventional APR (required by Reg Z when advertising payments/rates). */
  aprPct?: number;
  /** FHA note rate; defaults to ratePct. */
  fhaRatePct?: number;
  fhaAprPct?: number;
  /** VA note rate; defaults to the FHA rate. */
  vaRatePct?: number;
  vaAprPct?: number;
  /** Where the rates came from, added to the disclaimer (e.g. national averages as of a date). */
  rateNote?: string;
  /** Actual annual property taxes (from MLS). Estimated by state when absent. */
  annualTaxes?: number;
  /** Annual homeowners insurance. Estimated by state when absent. */
  annualInsurance?: number;
  hoaMonthly?: number;
}

/** Where an automatically detected listing came from. */
export interface ListingSource {
  /** Data provider, e.g. "rentcast". */
  provider: string;
  /** The provider's listing id. */
  id: string;
  mlsNumber?: string;
  mlsName?: string;
  /** Set when the 90-days-on-market pull found it. */
  pull?: "90-days";
  detectedAt: string;
}

export interface Listing {
  slug: string;
  loanOfficerSlug: string;
  status: ListingStatus;
  address: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  lotSize?: string;
  yearBuilt?: number;
  description?: string;
  highlights: string[];
  photos: string[];
  /** Link to the MLS / agent's listing page. */
  listingUrl?: string;
  openHouse?: OpenHouse;
  agent: Agent;
  financing?: Financing;
  /** Seller credit offered on the listing, set by the agent on the kit page. */
  concession?: Concession;
  /** Show payment estimates on this listing's materials. */
  showPayment: boolean;
  /** Set on listings created by new-listing detection. */
  source?: ListingSource;
  /** Builder credited in place of a listing agent (new construction). No agent headshot then. */
  builder?: string;
  createdAt: string;
  updatedAt: string;
}

/** A self-signup loan officer's Stripe subscription, kept in sync by the Stripe webhook. */
export interface Billing {
  customerId: string;
  subscriptionId?: string;
  /** Stripe subscription status: trialing, active, past_due, canceled, unpaid, incomplete… */
  status: string;
  trialEnd?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  signedUpAt: string;
  updatedAt: string;
}
