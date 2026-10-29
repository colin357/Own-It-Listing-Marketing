/**
 * New-listing detection: every day we pull fresh listings around each loan
 * officer's metro from a data provider, match the listing agents against our
 * roster of referral partners, and turn matches into listing kits.
 */

/** A search area for one loan officer (or a team sharing a market). */
export interface Metro {
  /** Loan officer name(s) as written in metros.csv, e.g. "Jake Kurtz / Antonio Gonzalez". */
  name: string;
  /** The individual loan officer names parsed from `name`. */
  loanOfficers: string[];
  city: string;
  state: string;
  zip?: string;
  latitude: number;
  longitude: number;
  radiusMiles: number;
}

/** A referral partner we watch for new listings. */
export interface RosterAgent {
  name: string;
  /** Name of the loan officer this agent works with. */
  loanOfficer: string;
  brokerage?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  /** Photo of the agent, used on the co-branded graphics. */
  headshotUrl?: string;
  notes?: string;
}

/** A listing as returned by a data provider, normalized. */
export interface SourceListing {
  provider: string;
  id: string;
  address: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  latitude?: number;
  longitude?: number;
  price: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  lotSizeSqft?: number;
  yearBuilt?: number;
  propertyType?: string;
  listingType?: string;
  hoaMonthly?: number;
  mlsNumber?: string;
  mlsName?: string;
  listedDate?: string;
  photos: string[];
  description?: string;
  /** Public listing page, when a photo source found one. */
  listingUrl?: string;
  agent: { name: string; phone?: string; email?: string; website?: string };
  office?: { name: string; phone?: string; email?: string; website?: string };
}

export interface ListingProvider {
  name: string;
  /** Active listings within the metro listed in the last `days` days. */
  fetchNewListings(metro: Metro, days: number): Promise<{ listings: SourceListing[]; requests: number }>;
}

export type DetectionStatus =
  /** Kit created. */
  | "created"
  /** Likely match, waiting for someone to approve it in the admin. */
  | "review"
  /** Confident match, but the loan officer has no record in the app yet. */
  | "waiting-lo"
  | "dismissed";

export interface Detection {
  /** `<provider>-<id>`, which also de-duplicates across runs and overlapping metros. */
  slug: string;
  status: DetectionStatus;
  /** 0..1 */
  confidence: number;
  /** Why we think it's a match, e.g. "Exact name, same brokerage". */
  reason: string;
  rosterAgent: RosterAgent;
  loanOfficerName: string;
  /** Set once the loan officer record is found. */
  loanOfficerSlug?: string;
  listing: SourceListing;
  /** Kit slug once created. */
  listingSlug?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DetectionRun {
  startedAt: string;
  finishedAt: string;
  provider: string;
  dryRun: boolean;
  metros: number;
  requests: number;
  listingsScanned: number;
  matches: number;
  created: number;
  /** Kits that were missing photos and got them on this run. */
  photosAdded: number;
  review: number;
  waitingLo: number;
  errors: string[];
}
