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
  return addressQueries(l)[0];
}

/**
 * Ways to write the address for Zillow's search, best first. A retry after
 * "not found" uses the next one, since Zillow sometimes can't find a unit
 * number or a ZIP that RentCast formats differently.
 */
export function addressQueries(l: SourceListing): string[] {
  const street = l.unit ? `${l.address} ${l.unit}` : l.address;
  const all = [
    `${street}, ${l.city}, ${l.state} ${l.zip}`,
    `${l.address}, ${l.city}, ${l.state} ${l.zip}`,
    `${street}, ${l.city}, ${l.state}`,
  ].map((q) => q.replace(/\s+/g, " ").trim());
  return [...new Set(all)];
}

/** Query to use on the given try (0 = first lookup). */
export function addressQueryFor(l: SourceListing, tries = 0): string {
  const qs = addressQueries(l);
  return qs[tries % qs.length];
}

const DIRECTIONS: Record<string, string> = {
  north: "n", south: "s", east: "e", west: "w",
  northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw",
};
const UNIT_WORDS = new Set(["apt", "unit", "ste", "suite", "bldg", "lot", "trlr", "spc", "rm", "fl"]);

/** Lowercase words of a street, directions shortened, punctuation dropped. */
function streetWords(street: string): string[] {
  return street
    .toLowerCase()
    .replace(/#/g, " unit ")
    .replace(/[^a-z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => DIRECTIONS[w] ?? w);
}

/** House number + first word of the street name (skipping a direction) + zip, for matching results back. */
export function addressKey(street: string, zip?: string): string {
  const w = streetWords(street);
  const name = w.slice(1).find((x) => !Object.values(DIRECTIONS).includes(x)) ?? w[1] ?? "";
  return `${w[0] ?? ""} ${name} ${(zip ?? "").slice(0, 5)}`.trim();
}

/** Unit number from a street line ("123 Main St APT 4B" -> "4b"), if any. */
function unitOf(street: string): string | undefined {
  const w = streetWords(street);
  const i = w.findIndex((x, n) => n > 0 && UNIT_WORDS.has(x));
  return i > 0 ? w[i + 1] : undefined;
}

const sameText = (a: string, b: string) =>
  a.toLowerCase().replace(/[^a-z0-9]/g, "") === b.toLowerCase().replace(/[^a-z0-9]/g, "");

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

/** Street line and zip of an actor result, whichever address fields it has. */
function itemAddress(item: Item): { street: string; zip: string } {
  for (const key of ["listingAddress", "address"]) {
    const addr = item[key];
    if (addr && typeof addr === "object") {
      const a = addr as Item;
      const street = String(a.streetAddress ?? a.street ?? a.full ?? "");
      const zip = String(a.zipcode ?? a.zipCode ?? a.zip ?? "") || street.match(/\b\d{5}\b/)?.[0] || "";
      if (street) return { street, zip };
    }
    if (typeof addr === "string" && addr) return { street: addr, zip: addr.match(/\b\d{5}\b/)?.[0] ?? "" };
  }
  const street = String(item.streetAddress ?? "");
  return { street, zip: String(item.zipcode ?? item.zipCode ?? "") || street.match(/\b\d{5}\b/)?.[0] || "" };
}

function describe(item: Item): string {
  const { street, zip } = itemAddress(item);
  return `${street}${zip ? ` ${zip}` : ""}`.trim() || "an unknown address";
}

/**
 * Matches actor output back to the listings that were asked for, keyed by
 * listing id. Every listing asked for gets an entry; one without photos says
 * why in `note`. `queries` is the address text sent for each listing id
 * (defaults to addressQuery).
 *
 * Matching, most certain first: the actor's echo of our query
 * (addressOrUrlFromInput), then house number + street name + zip (and unit,
 * when both sides have one), then house number + zip when that's unique.
 */
export function matchItems(
  listings: SourceListing[],
  items: unknown,
  queries?: Map<string, string>,
): Map<string, PhotoResult> {
  const out = new Map<string, PhotoResult>();
  const list = (Array.isArray(items) ? (items as Item[]) : []).filter((x) => x && typeof x === "object");
  const used = new Set<Item>();
  const number = (street: string) => streetWords(street)[0] ?? "";

  const pick = (l: SourceListing): Item | undefined => {
    const query = queries?.get(l.id) ?? addressQuery(l);
    const free = list.filter((x) => !used.has(x));
    // 1. The actor says which input it was answering. Trust it if the house number agrees.
    const echoed = free.find(
      (x) =>
        typeof x.addressOrUrlFromInput === "string" &&
        sameText(x.addressOrUrlFromInput, query) &&
        (!itemAddress(x).street || number(itemAddress(x).street) === number(l.address)),
    );
    if (echoed) return echoed;
    // 2. Same house number, street name and zip (and unit, when both sides give one).
    const key = addressKey(l.address, l.zip);
    const wantUnit = l.unit ? streetWords(l.unit).filter((w) => !UNIT_WORDS.has(w)).pop() : undefined;
    const byKey = free.filter((x) => {
      const a = itemAddress(x);
      if (addressKey(a.street, a.zip) !== key) return false;
      const unit = unitOf(a.street);
      return !wantUnit || !unit || unit === wantUnit;
    });
    if (byKey.length) return byKey[0];
    // 3. Same house number and zip, and nothing else in the batch could be it.
    const loose = free.filter((x) => {
      const a = itemAddress(x);
      return number(a.street) === number(l.address) && a.zip.slice(0, 5) === l.zip.slice(0, 5);
    });
    const rivals = listings.filter((o) => number(o.address) === number(l.address) && o.zip.slice(0, 5) === l.zip.slice(0, 5));
    if (loose.length === 1 && rivals.length === 1) return loose[0];
    // 4. One home asked, one answer.
    if (listings.length === 1 && free.length === 1 && number(itemAddress(free[0]).street) === number(l.address))
      return free[0];
    return undefined;
  };

  for (const l of listings) {
    const item = pick(l);
    if (!item) {
      const query = queries?.get(l.id) ?? addressQuery(l);
      const near = list.find((x) => typeof x.addressOrUrlFromInput === "string" && sameText(x.addressOrUrlFromInput, query));
      out.set(l.id, {
        photos: [],
        note: near
          ? `Zillow answered "${query}" with a different home (${describe(near)})`
          : `Zillow returned nothing for "${query}"`,
      });
      continue;
    }
    used.add(item);
    const photos = photosFromItem(item);
    const description = typeof item.description === "string" ? item.description : undefined;
    const link = [item.propertyUrl, item.hdpUrl, item.url].find((u) => typeof u === "string") as string | undefined;
    const listingUrl = link ? (link.startsWith("http") ? link : `https://www.zillow.com${link}`) : undefined;
    let note: string | undefined;
    if (!photos.length) {
      const problem = [item.error, item.invalidReason].find((x) => typeof x === "string" && x);
      const status = typeof item.listingStatus === "string" ? item.listingStatus : item.homeStatus;
      note = problem
        ? `Zillow lookup failed: ${String(problem).slice(0, 160)}`
        : `Zillow found ${describe(item)}${status ? ` (${String(status)})` : ""} but it has no photos yet`;
    }
    out.set(l.id, { photos, description, listingUrl, note });
  }
  return out;
}

const API = "https://api.apify.com/v2";
const actorId = () => process.env.APIFY_ZILLOW_ACTOR || DEFAULT_ACTOR;
const actorInput = (addresses: string[]) => JSON.stringify({ addresses, propertyStatus: "FOR_SALE" });

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
export async function startZillowRun(token: string, addresses: string[], timeoutSec = 900): Promise<ApifyRun> {
  return toRun(
    await apify<RunData>(token, `/acts/${actorId()}/runs?timeout=${timeoutSec}&maxItems=${addresses.length * 3}`, {
      method: "POST",
      body: actorInput(addresses),
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
    `${API}/acts/${actorId()}/run-sync-get-dataset-items?timeout=${timeoutSec}&maxItems=${listings.length * 3}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: actorInput(listings.map((l) => addressQuery(l))),
      cache: "no-store",
      // Apify holds sync runs open for up to 300s; the caller sizes timeoutSec to fit the function budget.
      signal: AbortSignal.timeout((timeoutSec + 20) * 1000),
    },
  );
  if (!res.ok) throw new Error(`Apify ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return matchItems(listings, await res.json());
}
