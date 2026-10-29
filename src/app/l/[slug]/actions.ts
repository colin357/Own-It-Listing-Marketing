"use server";

import { revalidatePath } from "next/cache";
import { listings } from "@/lib/store";

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
