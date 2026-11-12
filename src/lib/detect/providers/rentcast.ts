import "server-only";
import type { ListingProvider, Metro, SourceListing } from "../types";

/**
 * RentCast sale listings (https://developers.rentcast.io/reference/sale-listings).
 * Gives the listing agent, office and core property facts. No photos or
 * description, so a photo source fills those in when one is configured.
 */

const BASE = "https://api.rentcast.io/v1/listings/sale";
const PAGE = 500;
/** Safety cap per metro per run, so a misconfigured radius can't burn the monthly quota. */
const MAX_PAGES = 10;

interface RentcastContact {
  name?: string;
  phone?: string;
  email?: string;
  website?: string;
}

interface RentcastListing {
  id: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  lotSize?: number;
  yearBuilt?: number;
  hoa?: { fee?: number };
  status?: string;
  price?: number;
  listingType?: string;
  listedDate?: string;
  daysOnMarket?: number;
  mlsName?: string;
  mlsNumber?: string;
  listingAgent?: RentcastContact;
  listingOffice?: RentcastContact;
}

/** Land and rentals-style records aren't useful for listing kits. */
const SKIP_TYPES = new Set(["Land", "Apartment"]);

/**
 * `needAgent: false` keeps listings RentCast has no agent for (often
 * new-construction homes listed by a builder). Detection needs the agent to
 * match the roster, but an LO building a kit by hand can type the agent in.
 */
export function fromRentcast(r: RentcastListing, { needAgent = true } = {}): SourceListing | null {
  if ((needAgent && !r.listingAgent?.name) || !r.addressLine1 || !r.price) return null;
  if (r.propertyType && SKIP_TYPES.has(r.propertyType)) return null;
  return {
    provider: "rentcast",
    id: r.id,
    address: r.addressLine1,
    unit: r.addressLine2 || undefined,
    city: r.city ?? "",
    state: r.state ?? "",
    zip: r.zipCode ?? "",
    latitude: r.latitude,
    longitude: r.longitude,
    price: r.price,
    beds: r.bedrooms,
    baths: r.bathrooms,
    sqft: r.squareFootage,
    lotSizeSqft: r.lotSize,
    yearBuilt: r.yearBuilt,
    propertyType: r.propertyType,
    listingType: r.listingType,
    hoaMonthly: r.hoa?.fee,
    mlsNumber: r.mlsNumber,
    mlsName: r.mlsName,
    listedDate: r.listedDate,
    daysOnMarket: r.daysOnMarket,
    photos: [],
    agent: { name: r.listingAgent?.name ?? "", ...pickContact(r.listingAgent ?? {}) },
    office: r.listingOffice?.name ? { name: r.listingOffice.name, ...pickContact(r.listingOffice) } : undefined,
  };
}

function pickContact(c: RentcastContact) {
  return { phone: c.phone || undefined, email: c.email || undefined, website: c.website || undefined };
}

/**
 * One feed page, with a 30s timeout so one slow request can't stall the whole
 * run, and one retry after a rate limit (429), server error or timeout.
 */
async function fetchWithRetry(url: string, apiKey: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "X-Api-Key": apiKey, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt > 0) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

export function rentcastProvider(apiKey: string): ListingProvider {
  return {
    name: "rentcast",
    async fetchNewListings(metro: Metro, days: number, minDays?: number) {
      const out: SourceListing[] = [];
      let requests = 0;
      for (let page = 0; page < MAX_PAGES; page++) {
        const params = new URLSearchParams({
          latitude: String(metro.latitude),
          longitude: String(metro.longitude),
          radius: String(metro.radiusMiles),
          status: "Active",
          // Max days since listed (min 1), or a "min:max" range.
          daysOld: minDays ? `${Math.max(1, minDays)}:${Math.max(minDays, days)}` : String(Math.max(1, days)),
          limit: String(PAGE),
          offset: String(page * PAGE),
        });
        const res = await fetchWithRetry(`${BASE}?${params}`, apiKey);
        requests++;
        if (!res.ok) throw new Error(`RentCast ${res.status} for ${metro.name}: ${(await res.text()).slice(0, 200)}`);
        const rows = (await res.json()) as RentcastListing[];
        for (const r of rows) {
          const l = fromRentcast(r);
          if (l) out.push(l);
        }
        if (rows.length < PAGE) break;
      }
      return { listings: out, requests };
    },
  };
}

/**
 * Sale listings at one address ("123 Main St, Austin, TX 78704"), newest
 * first. One request, for building a kit when the MLS # isn't indexed yet.
 */
export class UnreadableAddressError extends Error {}

/**
 * Every active sale listing in one ZIP, however long ago it was listed (one
 * request, up to 500 listings). The fallback when the address search misses:
 * RentCast's address search needs its own spelling of the address, and new
 * streets or new-construction homes often aren't matched by it, but the
 * listing is still in the ZIP's feed.
 */
export async function rentcastActiveInZip(apiKey: string, zip: string): Promise<SourceListing[]> {
  const params = new URLSearchParams({ zipCode: zip, status: "Active", limit: String(PAGE) });
  const res = await fetchWithRetry(`${BASE}?${params}`, apiKey);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`RentCast ${res.status} for ZIP ${zip}: ${(await res.text()).slice(0, 200)}`);
  const rows = (await res.json()) as RentcastListing[];
  const kept = rows.map((r) => fromRentcast(r, { needAgent: false })).filter((l): l is SourceListing => !!l);
  console.info(`RentCast ZIP ${zip}: ${rows.length} active listings, ${kept.length} usable`);
  return kept;
}

export async function rentcastByAddress(apiKey: string, address: string): Promise<SourceListing[]> {
  const params = new URLSearchParams({ address, limit: "5" });
  const res = await fetch(`${BASE}?${params}`, {
    headers: { "X-Api-Key": apiKey, Accept: "application/json" },
    cache: "no-store",
  });
  // RentCast answers 404 when nothing is listed at the address.
  if (res.status === 404) {
    console.info(`RentCast address "${address}": no listing (404)`);
    return [];
  }
  // 400 means RentCast couldn't parse or place the address (e.g. no city or ZIP).
  if (res.status === 400) throw new UnreadableAddressError(await res.text());
  if (!res.ok) throw new Error(`RentCast ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const rows = (await res.json()) as RentcastListing[];
  console.info(
    `RentCast address "${address}": ${rows.length} result(s)`,
    rows.map((r) => `${r.addressLine1} ${r.zipCode} ${r.status} mls=${r.mlsNumber ?? "-"} agent=${r.listingAgent?.name ? "yes" : "no"} type=${r.listingType ?? "-"} built=${r.yearBuilt ?? "-"}`),
  );
  return rows
    .sort((a, b) => Number(b.status === "Active") - Number(a.status === "Active"))
    .map((r) => fromRentcast(r, { needAgent: false }))
    .filter((l): l is SourceListing => !!l);
}
