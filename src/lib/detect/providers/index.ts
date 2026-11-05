import "server-only";
import type { ListingProvider, SourceListing } from "../types";
import { rentcastProvider } from "./rentcast";
import { mockProvider } from "./mock";
import { zillowPhotos } from "./zillow-photos";

/** The configured listings feed, or null when none is set up yet. */
export function listingProvider(): ListingProvider | null {
  if (process.env.LISTINGS_PROVIDER === "mock") return mockProvider();
  if (process.env.RENTCAST_API_KEY) return rentcastProvider(process.env.RENTCAST_API_KEY);
  return null;
}

export interface PhotoResult {
  photos: string[];
  /** Why no photos came back (e.g. "Zillow returned nothing for this address"), shown in admin. */
  note?: string;
  description?: string;
  listingUrl?: string;
}

/** Is any photo source configured? */
export function photoSource(): string | null {
  if (process.env.APIFY_TOKEN) return "zillow";
  if (process.env.PHOTO_LOOKUP_URL) return "webhook";
  return null;
}

/**
 * Photos (and description) for listings from feeds without photos, keyed by
 * listing id. Uses Zillow via Apify when APIFY_TOKEN is set; otherwise
 * PHOTO_LOOKUP_URL, any endpoint (e.g. a Zapier/Make webhook) that receives
 * the listing as JSON and answers {"photos": [...], "description", "listingUrl"}.
 */
export async function lookupPhotos(listings: SourceListing[], timeoutSec?: number): Promise<Map<string, PhotoResult>> {
  if (process.env.APIFY_TOKEN) return zillowPhotos(process.env.APIFY_TOKEN, listings, timeoutSec);
  const out = new Map<string, PhotoResult>();
  const url = process.env.PHOTO_LOOKUP_URL;
  if (!url) return out;
  for (const listing of listings) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.PHOTO_LOOKUP_TOKEN ? { Authorization: `Bearer ${process.env.PHOTO_LOOKUP_TOKEN}` } : {}),
      },
      body: JSON.stringify(listing),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Photo lookup ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json().catch(() => ({}))) as Partial<PhotoResult>;
    out.set(listing.id, {
      photos: (Array.isArray(body.photos) ? body.photos : []).map(String).filter((p) => /^https?:\/\//.test(p)),
      description: typeof body.description === "string" ? body.description : undefined,
      listingUrl:
        typeof body.listingUrl === "string" && /^https?:\/\//.test(body.listingUrl) ? body.listingUrl : undefined,
    });
  }
  return out;
}
