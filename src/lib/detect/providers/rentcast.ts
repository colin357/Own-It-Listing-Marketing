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
  mlsName?: string;
  mlsNumber?: string;
  listingAgent?: RentcastContact;
  listingOffice?: RentcastContact;
}

/** Land and rentals-style records aren't useful for listing kits. */
const SKIP_TYPES = new Set(["Land", "Apartment"]);

export function fromRentcast(r: RentcastListing): SourceListing | null {
  if (!r.listingAgent?.name || !r.addressLine1 || !r.price) return null;
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
    photos: [],
    agent: { name: r.listingAgent.name, ...pickContact(r.listingAgent) },
    office: r.listingOffice?.name ? { name: r.listingOffice.name, ...pickContact(r.listingOffice) } : undefined,
  };
}

function pickContact(c: RentcastContact) {
  return { phone: c.phone || undefined, email: c.email || undefined, website: c.website || undefined };
}

export function rentcastProvider(apiKey: string): ListingProvider {
  return {
    name: "rentcast",
    async fetchNewListings(metro: Metro, days: number) {
      const out: SourceListing[] = [];
      let requests = 0;
      for (let page = 0; page < MAX_PAGES; page++) {
        const params = new URLSearchParams({
          latitude: String(metro.latitude),
          longitude: String(metro.longitude),
          radius: String(metro.radiusMiles),
          status: "Active",
          // Max days since listed (min 1).
          daysOld: String(Math.max(1, days)),
          limit: String(PAGE),
          offset: String(page * PAGE),
        });
        const res = await fetch(`${BASE}?${params}`, {
          headers: { "X-Api-Key": apiKey, Accept: "application/json" },
          cache: "no-store",
        });
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
export async function rentcastByAddress(apiKey: string, address: string): Promise<SourceListing[]> {
  const params = new URLSearchParams({ address, limit: "5" });
  const res = await fetch(`${BASE}?${params}`, {
    headers: { "X-Api-Key": apiKey, Accept: "application/json" },
    cache: "no-store",
  });
  // RentCast answers 404 when nothing is listed at the address.
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`RentCast ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const rows = (await res.json()) as RentcastListing[];
  return rows
    .sort((a, b) => Number(b.status === "Active") - Number(a.status === "Active"))
    .map(fromRentcast)
    .filter((l): l is SourceListing => !!l);
}
