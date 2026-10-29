"use server";

import { redirect } from "next/navigation";
import { countToday, loanOfficers } from "@/lib/store";
import { validLoToken } from "@/lib/loLinks";
import { findByAddress, findByKey, indexKey, normalizeMls } from "@/lib/detect/mls";
import { buildKitForLo, existingKit } from "@/lib/detect/build";
import type { SourceListing } from "@/lib/detect/types";

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
  const address = text(fd, "address");
  const mls = normalizeMls(mlsInput);
  if (!mls && !address) return { error: "Enter the listing's MLS number." };

  try {
    let listing = mls ? await findByKey(mls) : null;
    if (!listing && address) {
      if ((await countToday(`address-lookup:${lo.slug}`)) > ADDRESS_LOOKUPS_PER_DAY)
        return { mls: mlsInput, address, askAddress: true, error: "That's the limit of address lookups for today. Try again tomorrow." };
      const results = await findByAddress(address);
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
