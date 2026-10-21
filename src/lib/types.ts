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
  /** Override the loan officer's payment estimate for this listing. */
  showPayment: boolean;
  createdAt: string;
  updatedAt: string;
}
