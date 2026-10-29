"use server";

import { revalidatePath } from "next/cache";
import { listings } from "@/lib/store";
import { normalizeBuydown } from "@/lib/validate";
import { MAX_CONCESSION_PCT } from "@/lib/concessions";

const MAX_AGENT_PHOTOS = 30;

/** Saves the agent's uploaded photos onto a kit that had none. */
export async function addAgentPhotosAction(slug: string, urls: string[]): Promise<{ error?: string }> {
  const listing = await listings.get(slug);
  if (!listing) return { error: "Listing not found" };
  if (listing.photos.length) return { error: "This listing already has photos." };
  const photos = urls
    .filter((u) => {
      try {
        const url = new URL(u);
        // Only files uploaded through our Blob store, into this listing's folder.
        return url.protocol === "https:" && url.hostname.endsWith(".blob.vercel-storage.com") && url.pathname.startsWith(`/listings/${slug}/`);
      } catch {
        return false;
      }
    })
    .slice(0, MAX_AGENT_PHOTOS);
  if (!photos.length) return { error: "No photos uploaded" };
  await listings.save({ ...listing, photos, updatedAt: new Date().toISOString() });
  revalidatePath(`/l/${slug}`);
  return {};
}

/** Saves the seller credit the agent set on the kit page. An amount of 0 removes it. */
export async function saveConcessionAction(slug: string, amount: number, type: string): Promise<{ error?: string }> {
  const listing = await listings.get(slug);
  if (!listing) return { error: "Listing not found" };
  if (listing.status === "just-sold" || listing.status === "under-contract")
    return { error: "Seller credits only show while the home is for sale." };
  const buydown = normalizeBuydown(type);
  if (!buydown) return { error: "Pick how buyers can use the credit." };
  if (!Number.isFinite(amount) || amount < 0) return { error: "Enter a dollar amount." };
  const max = (listing.price * MAX_CONCESSION_PCT) / 100;
  if (amount > max + 1) return { error: `No loan type allows more than ${MAX_CONCESSION_PCT}% of the price.` };
  const concession = amount >= 1 ? { amount: Math.round(amount), type: buydown } : undefined;
  await listings.save({ ...listing, concession, updatedAt: new Date().toISOString() });
  revalidatePath(`/l/${slug}`);
  return {};
}
