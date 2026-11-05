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

/** Matches actor output back to the listings that were asked for, keyed by listing id. */
export function matchItems(listings: SourceListing[], items: unknown): Map<string, PhotoResult> {
  const out = new Map<string, PhotoResult>();
  const list = Array.isArray(items) ? (items as Item[]) : [];
  const byKey = new Map<string, Item>();
  for (const item of list) byKey.set(itemAddressKey(item), item);
  for (const l of listings) {
    const item = byKey.get(addressKey(l.address, l.zip)) ?? (listings.length === 1 && list.length === 1 ? list[0] : undefined);
    if (!item) continue;
    const photos = photosFromItem(item);
    const description = typeof item.description === "string" ? item.description : undefined;
    const link = [item.hdpUrl, item.url, item.propertyUrl].find((u) => typeof u === "string") as string | undefined;
    const listingUrl = link ? (link.startsWith("http") ? link : `https://www.zillow.com${link}`) : undefined;
    out.set(l.id, { photos, description, listingUrl });
  }
  return out;
}

const API = "https://api.apify.com/v2";
const actorId = () => process.env.APIFY_ZILLOW_ACTOR || DEFAULT_ACTOR;
const actorInput = (listings: SourceListing[]) =>
  JSON.stringify({ addresses: listings.map(addressQuery), propertyStatus: "FOR_SALE" });

/** Apify answered with a limit (too many runs or not enough memory on the plan), so try again later. */
export class ApifyBusyError extends Error {}

async function apify<T>(token: string, path: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 200);
    if (res.status === 402 || res.status === 429) throw new ApifyBusyError(`Apify ${res.status}: ${text}`);
    throw new Error(`Apify ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export interface ApifyRun {
  id: string;
  status: string;
  datasetId: string;
}

type RunData = { data: { id: string; status: string; defaultDatasetId: string } };
const toRun = ({ data }: RunData): ApifyRun => ({ id: data.id, status: data.status, datasetId: data.defaultDatasetId });

/**
 * Starts a scrape and returns at once. The run keeps going on Apify's side
 * however long it takes, so it never races our own function time limit.
 */
export async function startZillowRun(token: string, listings: SourceListing[], timeoutSec = 900): Promise<ApifyRun> {
  return toRun(
    await apify<RunData>(token, `/acts/${actorId()}/runs?timeout=${timeoutSec}&maxItems=${listings.length * 2}`, {
      method: "POST",
      body: actorInput(listings),
    }),
  );
}

/** Current state of a run, waiting up to `waitSec` (max 60) for it to finish. */
export async function getZillowRun(token: string, runId: string, waitSec = 0): Promise<ApifyRun> {
  const wait = Math.max(0, Math.min(60, Math.floor(waitSec)));
  return toRun(await apify<RunData>(token, `/actor-runs/${runId}?waitForFinish=${wait}`, {}, (wait + 20) * 1000));
}

/** Done one way or another. TIMED-OUT and ABORTED runs still hold whatever they scraped. */
export const runFinished = (status: string) => ["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"].includes(status);

export async function zillowRunItems(token: string, datasetId: string): Promise<unknown[]> {
  return apify<unknown[]>(token, `/datasets/${datasetId}/items?clean=true&format=json`, {}, 60_000);
}

export async function abortZillowRun(token: string, runId: string): Promise<void> {
  await apify(token, `/actor-runs/${runId}/abort`, { method: "POST" }).catch(() => undefined);
}

/** One scrape that waits for its results; for a single home (approve, build from MLS #). */
export async function zillowPhotos(
  token: string,
  listings: SourceListing[],
  timeoutSec = 180,
): Promise<Map<string, PhotoResult>> {
  if (!listings.length) return new Map();
  const res = await fetch(
    `${API}/acts/${actorId()}/run-sync-get-dataset-items?timeout=${timeoutSec}&maxItems=${listings.length * 2}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: actorInput(listings),
      cache: "no-store",
      // Apify holds sync runs open for up to 300s; the caller sizes timeoutSec to fit the function budget.
      signal: AbortSignal.timeout((timeoutSec + 20) * 1000),
    },
  );
  if (!res.ok) throw new Error(`Apify ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return matchItems(listings, await res.json());
}
