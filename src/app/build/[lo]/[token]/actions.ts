"use server";

import { redirect } from "next/navigation";
import { countToday, loanOfficers, uncountToday } from "@/lib/store";
import { validLoToken } from "@/lib/loLinks";
import { findByAddress, findByKey, indexKey, normalizeMls } from "@/lib/detect/mls";
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
  mls?: string;
  address?: string;
  /** Show the address field: the MLS # wasn't found. */
  askAddress?: boolean;
  error?: string;
  found?: FoundListing;
}

async function authorizedLo(slug: string, token: string) {
  if (!validLoToken(slug, token)) return null;
  return loanOfficers.get(slug);
}

const text = (fd: FormData, name: string) => String(fd.get(name) ?? "").trim();

const ADDRESS_HELP = "Add the city, state and ZIP, like 123 Main St, Austin, TX 78704.";

/** True when the address has a ZIP or ends in a city and two-letter state, so RentCast can place it. */
function completeAddress(address: string): boolean {
  return /\b\d{5}\b/.test(address) || /,\s*[^,]+,?\s+[A-Za-z]{2}\.?\s*$/.test(address);
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
  const mlsInput = text(fd, "mls");
  const mls = normalizeMls(mlsInput);
  // The address box keeps its last value. If only the MLS # changed since the last
  // search, that address belongs to another listing, so don't search (or count) it again.
  const typed = text(fd, "address");
  const stale = !!typed && typed === text(fd, "prevAddress") && mls !== normalizeMls(text(fd, "prevMls"));
  const address = stale ? "" : typed;
  if (!mls && !address) return { error: "Enter the listing's MLS number." };

  try {
    let listing = mls ? await findByKey(mls) : null;
    if (!listing && address) {
      if (!completeAddress(address)) return { mls: mlsInput, address, askAddress: true, error: ADDRESS_HELP };
      const counter = `address-lookup:${lo.slug}`;
      if ((await countToday(counter)) > ADDRESS_LOOKUPS_PER_DAY)
        return {
          mls: mlsInput,
          address,
          askAddress: true,
          error: `That's the ${ADDRESS_LOOKUPS_PER_DAY} address lookups for today. Try again tomorrow.`,
        };
      let results: SourceListing[];
      try {
        results = await findByAddress(address);
      } catch (err) {
        if (!(err instanceof UnreadableAddressError)) throw err;
        await uncountToday(counter);
        return { mls: mlsInput, address, askAddress: true, error: `We couldn't read that address. ${ADDRESS_HELP}` };
      }
      listing = results.find((l) => mls && l.mlsNumber && normalizeMls(l.mlsNumber) === mls) ?? results[0] ?? null;
      if (!listing)
        return {
          mls: mlsInput,
          address,
          askAddress: true,
          error: "We couldn't find a listing at that address. Check the spelling and include the city, state and ZIP.",
        };
    }
    if (!listing) return { mls: mlsInput, askAddress: true };
    const kit = await existingKit(lo, listing);
    return { mls: mlsInput, address, found: summary(listing, kit?.slug) };
  } catch (err) {
    console.error("MLS lookup failed", err);
    return { mls: mlsInput, address, askAddress: !!address, error: "The lookup didn't work just now. Try again in a minute." };
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
