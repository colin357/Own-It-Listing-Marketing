"use server";

import { redirect } from "next/navigation";
import { countToday, loanOfficers, uncountToday } from "@/lib/store";
import { validLoToken } from "@/lib/loLinks";
import { findByAddress, findByKey, findInZip, indexKey } from "@/lib/detect/mls";
import { homeAddress } from "@/lib/detect/dedupe";
import { buildKitForLo, existingKit } from "@/lib/detect/build";
import type { SourceListing } from "@/lib/detect/types";
import { UnreadableAddressError } from "@/lib/detect/providers/rentcast";

/** Live address lookups per loan officer per day, to protect the RentCast quota. */
const ADDRESS_LOOKUPS_PER_DAY = 25;

export interface FoundListing {
  key: string;
  address: string;
  cityLine: string;
  price: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  mlsNumber?: string;
  agent: string;
  office?: string;
  listedDate?: string;
  existingSlug?: string;
}

export interface FindState {
  address?: string;
  error?: string;
  found?: FoundListing;
}

async function authorizedLo(slug: string, token: string) {
  if (!validLoToken(slug, token)) return null;
  return loanOfficers.get(slug);
}

const text = (fd: FormData, name: string) => String(fd.get(name) ?? "").trim();

const LIMIT_MESSAGE =
  "You've reached today's limit for address searches. It resets tomorrow. Need this one sooner? Contact Own It Social.";

const ADDRESS_HELP = "Add the city, state and ZIP, like 123 Main St, Austin, TX 78704.";

/** True when the address has a ZIP or ends in a city and two-letter state, so RentCast can place it. */
function completeAddress(address: string): boolean {
  return /\b\d{5}\b/.test(address) || /,\s*[^,]+,?\s+[A-Za-z]{2}\.?\s*$/.test(address);
}

/** The five-digit ZIP in a typed address, if any ("..., SC 29470" → "29470"). */
function zipOf(address: string): string | null {
  return address.match(/\b(\d{5})(?:-\d{4})?\s*$/)?.[1] ?? address.match(/,[^,]*\b(\d{5})\b/)?.[1] ?? null;
}

/**
 * The listing in `pool` the LO meant: the same street address ("Dr" and
 * "Drive" match), then same house number and street name when only the
 * suffix or a direction differs.
 */
function pickListing(pool: SourceListing[], address: string, zip: string): SourceListing | null {
  const typed = homeAddress({ address: address.split(",")[0], zip }).street;
  const exact = pool.find((l) => homeAddress(l).street === typed);
  if (exact) return exact;
  const [num, name] = typed.split(" ");
  if (!num || !/^\d/.test(num) || !name) return null;
  return (
    pool.find((l) => {
      const [n, ...rest] = homeAddress(l).street.split(" ");
      return n === num && rest.includes(name);
    }) ?? null
  );
}

function summary(l: SourceListing, existingSlug?: string): FoundListing {
  return {
    key: indexKey(l),
    address: l.unit ? `${l.address} ${l.unit}` : l.address,
    cityLine: `${l.city}, ${l.state} ${l.zip}`.trim(),
    price: l.price,
    beds: l.beds,
    baths: l.baths,
    sqft: l.sqft,
    mlsNumber: l.mlsNumber,
    agent: l.agent.name,
    office: l.office?.name,
    listedDate: l.listedDate,
    existingSlug,
  };
}

export async function findListingAction(slug: string, token: string, _prev: FindState, fd: FormData): Promise<FindState> {
  const lo = await authorizedLo(slug, token);
  if (!lo) return { error: "This link isn't valid anymore. Ask Own It Social for a new one." };
  const address = text(fd, "address");
  if (!address) return { error: "Enter the property address." };
  if (!completeAddress(address)) return { address, error: ADDRESS_HELP };

  try {
    const counter = `address-lookup:${lo.slug}`;
    const limitReached: FindState = { address, error: LIMIT_MESSAGE };
    if ((await countToday(counter)) > ADDRESS_LOOKUPS_PER_DAY) return limitReached;
    let results: SourceListing[];
    try {
      results = await findByAddress(address);
    } catch (err) {
      if (!(err instanceof UnreadableAddressError)) throw err;
      await uncountToday(counter);
      return { address, error: `We couldn't read that address. ${ADDRESS_HELP}` };
    }
    let listing: SourceListing | null = results[0] ?? null;
    // RentCast's address search misses some active listings (new streets, new
    // construction, its own spelling of the address). Look through every active
    // listing in the ZIP instead, matching by street address.
    const zip = listing ? null : zipOf(address);
    if (zip) {
      if ((await countToday(counter)) > ADDRESS_LOOKUPS_PER_DAY) return limitReached;
      listing = pickListing(await findInZip(zip), address, zip);
    }
    if (!listing)
      return {
        address,
        error: "We couldn't find an active listing at that address. Check the spelling and include the city, state and ZIP.",
      };
    const kit = await existingKit(lo, listing);
    return { address, found: summary(listing, kit?.slug) };
  } catch (err) {
    console.error("Address lookup failed", err);
    return { address, error: "The lookup didn't work just now. Try again in a minute." };
  }
}

export interface BuildState {
  error?: string;
}

export async function buildKitAction(slug: string, token: string, _prev: BuildState, fd: FormData): Promise<BuildState> {
  const lo = await authorizedLo(slug, token);
  if (!lo) return { error: "This link isn't valid anymore. Ask Own It Social for a new one." };
  const listing = await findByKey(text(fd, "key"));
  if (!listing) return { error: "That listing expired from our search. Look it up again." };
  let kitSlug: string;
  try {
    kitSlug = (await buildKitForLo(lo, listing)).slug;
  } catch (err) {
    console.error("Kit build failed", err);
    return { error: `We couldn't build the kit: ${(err as Error).message}` };
  }
  redirect(`/l/${kitSlug}`);
}
