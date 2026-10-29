export const LISTING_STATUSES = {
  "coming-soon": "Coming Soon",
  "just-listed": "Just Listed",
  "open-house": "Open House",
  "price-improved": "Price Improved",
  "under-contract": "Under Contract",
  "just-sold": "Just Sold",
} as const;

export type ListingStatus = keyof typeof LISTING_STATUSES;

export interface PaymentSettings {
  /** Annual interest rate, e.g. 6.75 */
  ratePct: number;
  /** APR for that rate. Reg Z requires it whenever an ad states a rate or payment. */
  aprPct?: number;
  /** Down payment percentage, e.g. 20 */
  downPaymentPct: number;
  termYears: number;
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
  /** Apply / pre-qualify link used for QR codes and CTAs. */
  applyUrl?: string;
  headshotUrl?: string;
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
  /** Show payment estimates on this listing's materials. */
  showPayment: boolean;
  /** Set on listings created by new-listing detection. */
  source?: ListingSource;
  createdAt: string;
  updatedAt: string;
}
