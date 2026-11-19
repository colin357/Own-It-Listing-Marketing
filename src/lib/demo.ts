import "server-only";
import { cookies } from "next/headers";
import { offerAmount, offeredBuydowns } from "./concessions";
import { programOptions } from "./mortgage";
import { sampleKit } from "./sample";
import { normalizeBuydown } from "./validate";
import type { Concession, Listing, LoanOfficer } from "./types";

/**
 * The public sample kit at /l/demo (and its buyer page at /home/demo), linked
 * from the landing page so a loan officer can click through a real kit before
 * signing up. It's the bundled demo listing, never saved anywhere: the seller
 * incentive a visitor taps lives in a cookie, so every visitor gets their own.
 */
export const DEMO_SLUG = "demo";
const COOKIE = "demo-incentive";

export const isDemo = (slug: string) => slug === DEMO_SLUG;

async function pickedIncentive(): Promise<string | undefined> {
  try {
    return (await cookies()).get(COOKIE)?.value;
  } catch {
    return undefined; // outside a request (build time)
  }
}

export async function demoKit(): Promise<{ listing: Listing; lo: LoanOfficer }> {
  const { listing: base, lo } = await sampleKit();
  let listing: Listing = { ...base, slug: DEMO_SLUG };
  const buydown = normalizeBuydown((await pickedIncentive()) ?? "");
  if (buydown && offeredBuydowns(listing.price).includes(buydown)) {
    const programs = programOptions({ ...listing, concession: undefined }, lo);
    const concession: Concession = { amount: offerAmount(buydown, programs?.scenarios ?? [], listing.price), type: buydown };
    listing = { ...listing, concession };
  }
  return { listing, lo };
}

/** Remembers the incentive a visitor tapped on the sample kit ("none" clears it). */
export async function saveDemoIncentive(type: string): Promise<{ error?: string }> {
  const jar = await cookies();
  if (type === "none") {
    jar.delete(COOKIE);
    return {};
  }
  if (!normalizeBuydown(type)) return { error: "Pick an option." };
  jar.set(COOKIE, type, { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax" });
  return {};
}
