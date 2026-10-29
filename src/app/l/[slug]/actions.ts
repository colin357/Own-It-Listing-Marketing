"use server";

import { revalidatePath } from "next/cache";
import { listings } from "@/lib/store";
import { normalizeBuydown } from "@/lib/validate";
import { offerAmount } from "@/lib/concessions";
import { getKit } from "@/lib/listings";
import { programOptions } from "@/lib/mortgage";
import type { Concession } from "@/lib/types";

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

/** Saves the seller incentive the agent picked on the kit page. "none" removes it. */
export async function saveConcessionAction(slug: string, type: string): Promise<{ error?: string }> {
  const listing = await listings.get(slug);
  if (!listing) return { error: "Listing not found" };
  if (listing.status === "just-sold" || listing.status === "under-contract")
    return { error: "Seller incentives only show while the home is for sale." };
  let concession: Concession | undefined;
  if (type !== "none") {
    const buydown = normalizeBuydown(type);
    if (!buydown) return { error: "Pick an option." };
    const kit = await getKit(slug);
    const programs = kit ? programOptions({ ...kit.listing, concession: undefined }, kit.lo) : null;
    concession = { amount: offerAmount(buydown, programs?.scenarios ?? [], listing.price), type: buydown };
  }
  await listings.save({ ...listing, concession, updatedAt: new Date().toISOString() });
  revalidatePath(`/l/${slug}`);
  return {};
}
