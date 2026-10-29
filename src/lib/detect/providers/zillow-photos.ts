import "server-only";
import type { SourceListing } from "../types";
import type { PhotoResult } from "./index";

/**
 * Listing photos and description from the public Zillow listing, via an
 * Apify actor (default maxcopell/zillow-detail-scraper, which accepts plain
 * addresses). One synchronous actor run per batch of matched listings.
 *
 * Output shapes vary between actor versions, so photo fields are read
 * defensively and the largest JPEG of each photo is kept.
 */

const DEFAULT_ACTOR = "maxcopell~zillow-detail-scraper";
const MAX_PHOTOS = 25;

type Item = Record<string, unknown>;

/** "123 Main St, Austin, TX 78704" */
export function addressQuery(l: SourceListing): string {
  const street = l.unit ? `${l.address} ${l.unit}` : l.address;
  return `${street}, ${l.city}, ${l.state} ${l.zip}`.trim();
}

/** Lowercase street number + first word of the street name + zip, for matching results back. */
export function addressKey(street: string, zip?: string): string {
  const s = street.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim().split(/\s+/);
  return `${s[0] ?? ""} ${s[1] ?? ""} ${(zip ?? "").slice(0, 5)}`.trim();
}

function largestJpeg(photo: unknown): string | undefined {
  if (!photo || typeof photo !== "object") return typeof photo === "string" ? photo : undefined;
  const p = photo as Item;
  const mixed = (p.mixedSources as Item | undefined)?.jpeg;
  if (Array.isArray(mixed) && mixed.length) {
    const best = [...mixed].sort((a, b) => Number((b as Item).width ?? 0) - Number((a as Item).width ?? 0))[0] as Item;
    if (typeof best.url === "string") return best.url;
  }
  for (const k of ["url", "href", "hiRes", "src"]) if (typeof p[k] === "string") return p[k] as string;
  return undefined;
}

export function photosFromItem(item: Item): string[] {
  for (const key of ["listingPhotos", "responsivePhotos", "originalPhotos", "photos", "photoUrls", "images"]) {
    const arr = item[key];
    if (Array.isArray(arr) && arr.length) {
      const urls = arr.map(largestJpeg).filter((u): u is string => !!u && /^https?:\/\//.test(u));
      if (urls.length) return [...new Set(urls)].slice(0, MAX_PHOTOS);
    }
  }
  const main = item.mainImage as Item | undefined;
  const hero = main && (main.hiRes ?? main.medium);
  return typeof hero === "string" ? [hero] : [];
}

function itemAddressKey(item: Item): string {
  const addr = (item.address ?? item.listingAddress) as Item | string | undefined;
  if (typeof addr === "object" && addr) {
    const street = String(addr.streetAddress ?? addr.street ?? addr.full ?? "");
    return addressKey(street, String(addr.zipcode ?? addr.zipCode ?? addr.zip ?? "") || street.match(/\b\d{5}\b/)?.[0]);
  }
  const street = String(item.streetAddress ?? addr ?? "");
  return addressKey(street, String(item.zipcode ?? item.zipCode ?? "") || street.match(/\b\d{5}\b/)?.[0]);
}

export async function zillowPhotos(token: string, listings: SourceListing[]): Promise<Map<string, PhotoResult>> {
  const out = new Map<string, PhotoResult>();
  if (!listings.length) return out;
  const actor = process.env.APIFY_ZILLOW_ACTOR || DEFAULT_ACTOR;
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=180&maxItems=${listings.length * 2}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ addresses: listings.map(addressQuery), propertyStatus: "FOR_SALE" }),
      cache: "no-store",
      // Apify holds sync runs open for up to 300s; leave room in the 300s function budget.
      signal: AbortSignal.timeout(200_000),
    },
  );
  if (!res.ok) throw new Error(`Apify ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const items = (await res.json()) as Item[];

  const byKey = new Map<string, Item>();
  for (const item of Array.isArray(items) ? items : []) byKey.set(itemAddressKey(item), item);
  for (const l of listings) {
    const item = byKey.get(addressKey(l.address, l.zip)) ?? (listings.length === 1 && items.length === 1 ? items[0] : undefined);
    if (!item) continue;
    const photos = photosFromItem(item);
    const description = typeof item.description === "string" ? item.description : undefined;
    const link = [item.hdpUrl, item.url, item.propertyUrl].find((u) => typeof u === "string") as string | undefined;
    const listingUrl = link ? (link.startsWith("http") ? link : `https://www.zillow.com${link}`) : undefined;
    out.set(l.id, { photos, description, listingUrl });
  }
  return out;
}
