import "server-only";
import { listings, loanOfficers, uniqueSlug } from "./store";
import { slugify } from "./format";
import { parseListingInput, parseLoanOfficerInput, ValidationError } from "./validate";
import type { Listing, LoanOfficer } from "./types";

export async function createListing(raw: Record<string, unknown>): Promise<Listing> {
  const input = parseListingInput(raw);
  if (!(await loanOfficers.get(input.loanOfficerSlug)))
    throw new ValidationError([`Unknown loan officer "${input.loanOfficerSlug}"`]);
  const base = input.slug || slugify([input.address, input.unit, input.city, input.state].filter(Boolean).join(" "));
  const listing: Listing = { ...input, slug: await uniqueSlug(listings, base) };
  await listings.save(listing);
  return listing;
}

export async function updateListing(slug: string, raw: Record<string, unknown>): Promise<Listing | null> {
  const existing = await listings.get(slug);
  if (!existing) return null;
  const input = parseListingInput(raw, existing);
  if (!(await loanOfficers.get(input.loanOfficerSlug)))
    throw new ValidationError([`Unknown loan officer "${input.loanOfficerSlug}"`]);
  // Slugs are part of links already sent to agents, so they never change.
  const listing: Listing = { ...input, slug: existing.slug };
  await listings.save(listing);
  return listing;
}

export async function saveLoanOfficer(raw: Record<string, unknown>, existingSlug?: string): Promise<LoanOfficer> {
  const existing = existingSlug ? await loanOfficers.get(existingSlug) : null;
  if (existingSlug && !existing) throw new ValidationError([`Unknown loan officer "${existingSlug}"`]);
  const lo = parseLoanOfficerInput(raw, existing ?? undefined);
  if (!existing && (await loanOfficers.get(lo.slug)))
    throw new ValidationError([`A loan officer with slug "${lo.slug}" already exists`]);
  await loanOfficers.save(lo);
  return lo;
}

/** Listing plus its loan officer, or null if either is missing. */
export async function getKit(slug: string): Promise<{ listing: Listing; lo: LoanOfficer } | null> {
  const listing = await listings.get(slug);
  if (!listing) return null;
  const lo = await loanOfficers.get(listing.loanOfficerSlug);
  if (!lo) return null;
  return { listing, lo };
}
