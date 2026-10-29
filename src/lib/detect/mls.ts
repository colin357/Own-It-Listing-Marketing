import "server-only";
import { mlsIndex } from "../store";
import { rentcastByAddress } from "./providers/rentcast";
import type { SourceListing } from "./types";

/** "mls# 12-3456 " → "123456"; MLS numbers are compared without spaces, dashes or prefixes. */
export function normalizeMls(input: string): string {
  return input
    .toUpperCase()
    .replace(/^\s*(MLS)?\s*(#|NO\.?|NUMBER)?\s*:?/, "")
    .replace(/[^A-Z0-9]/g, "");
}

/** Index key for a listing: its MLS number, or the provider id when the feed has none. */
export function indexKey(l: SourceListing): string {
  return l.mlsNumber ? normalizeMls(l.mlsNumber) : `ID-${l.provider}-${l.id}`;
}

/** Some MLSs prefix numbers with a board code ("ACT-20845123"); agents often type just the digits. */
function digitsOnly(key: string): string | null {
  const d = key.replace(/^[A-Z]+/, "");
  return d !== key && /^\d{5,}$/.test(d) ? d : null;
}

/** Remembers listings from a feed so they can be found by MLS # later. */
export async function indexListings(listings: SourceListing[]) {
  const entries: [string, SourceListing][] = [];
  for (const l of listings) {
    const key = indexKey(l);
    entries.push([key, l]);
    const short = digitsOnly(key);
    if (short) entries.push([short, l]);
  }
  await mlsIndex.putMany(entries);
}

/** A listing by index key or typed MLS #, with or without the board prefix. */
export async function findByKey(key: string): Promise<SourceListing | null> {
  if (!key) return null;
  const hit = await mlsIndex.get(key);
  const short = hit ? null : digitsOnly(key);
  return hit ?? (short ? mlsIndex.get(short) : null);
}

/**
 * Live lookup by street address (one RentCast request). The result is indexed
 * so building the kit afterwards doesn't cost a second request.
 */
export async function findByAddress(address: string): Promise<SourceListing[]> {
  const key = process.env.RENTCAST_API_KEY;
  if (!key) throw new Error("Address lookup needs RENTCAST_API_KEY.");
  const found = await rentcastByAddress(key, address);
  await indexListings(found);
  return found;
}
