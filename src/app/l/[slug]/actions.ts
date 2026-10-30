"use server";

import { revalidatePath } from "next/cache";
import { listings } from "@/lib/store";
import { normalizeBuydown } from "@/lib/validate";
import { offerAmount } from "@/lib/concessions";
import { getKit } from "@/lib/listings";
import { programOptions } from "@/lib/mortgage";
import type { Concession } from "@/lib/types";
import { phoneDigits } from "@/lib/contact";

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

/**
 * Saves where the buyer page's "Schedule a tour" button goes: the agent's own
 * phone and email. A blank field keeps what's there.
 */
export async function saveAgentContactAction(slug: string, phone: string, email: string): Promise<{ error?: string }> {
  const listing = await listings.get(slug);
  if (!listing) return { error: "Listing not found" };
  const p = phone.trim();
  const e = email.trim();
  if (p && phoneDigits(p).length !== 10) return { error: "Enter a 10-digit phone number." };
  if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { error: "Enter a valid email." };
  if (!p && !e) return { error: "Enter your cell or email." };
  const agent = { ...listing.agent };
  if (p) {
    agent.phone = p;
    delete agent.phoneIsOffice;
  }
  if (e) agent.email = e;
  await listings.save({ ...listing, agent, updatedAt: new Date().toISOString() });
  revalidatePath(`/l/${slug}`);
  revalidatePath(`/home/${slug}`);
  return {};
}
