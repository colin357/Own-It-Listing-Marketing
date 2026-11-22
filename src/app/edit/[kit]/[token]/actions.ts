"use server";

import { revalidatePath } from "next/cache";
import { listings } from "@/lib/store";
import { validKitEditToken } from "@/lib/loLinks";
import { listingToValues } from "@/lib/formValues";
import { parseListingInput, ValidationError } from "@/lib/validate";
import type { Listing } from "@/lib/types";

export interface EditKitState {
  issues?: string[];
  saved?: boolean;
  values?: Record<string, string>;
}

/** What a loan officer can change. Address, agent and loan officer stay admin-only. */
const KIT_EDIT_FIELDS = [
  "status",
  "price",
  "beds",
  "baths",
  "sqft",
  "lotSize",
  "yearBuilt",
  "description",
  "highlights",
  "photos",
  "openHouseDate",
  "openHouseStart",
  "openHouseEnd",
  "rate",
  "apr",
  "fhaRate",
  "fhaApr",
  "annualTaxes",
  "annualInsurance",
  "hoaMonthly",
  "showPayment",
] as const;

/** Keeps photos the kit already had, plus ones uploaded to this kit's folder. */
function allowedPhotos(raw: string, existing: Listing): string {
  return raw
    .split("\n")
    .map((u) => u.trim())
    .filter((u) => {
      if (!u) return false;
      if (existing.photos.includes(u)) return true;
      try {
        const url = new URL(u);
        return (
          url.protocol === "https:" &&
          url.hostname.endsWith(".blob.vercel-storage.com") &&
          url.pathname.startsWith(`/listings/${existing.slug}/`)
        );
      } catch {
        return false;
      }
    })
    .join("\n");
}

export async function saveKitEditAction(kit: string, token: string, _prev: EditKitState, fd: FormData): Promise<EditKitState> {
  const values: Record<string, string> = {};
  for (const k of KIT_EDIT_FIELDS) values[k] = String(fd.get(k) ?? "").trim();
  values.showPayment = fd.has("showPayment") ? "true" : "false";

  if (!validKitEditToken(kit, token)) return { issues: ["This link isn't valid anymore. Ask us for a new one."], values };
  const existing = await listings.get(kit);
  if (!existing) return { issues: ["This kit no longer exists."], values };
  values.photos = allowedPhotos(values.photos, existing);
  if (values.rate && !values.apr) return { issues: ["Add the APR with the rate. Every rate shown needs its APR."], values };
  if (values.fhaRate && !values.fhaApr) return { issues: ["Add the FHA APR with the FHA rate."], values };
  if (values.openHouseDate && (!values.openHouseStart || !values.openHouseEnd))
    return { issues: ["Add a start and end time for the open house."], values };

  try {
    // Fields this form doesn't show (address, agent, seller incentive…) keep their saved values.
    const parsed = parseListingInput({ ...listingToValues(existing), ...values }, existing);
    const financing = parsed.financing
      ? { ...parsed.financing, vaRatePct: existing.financing?.vaRatePct, vaAprPct: existing.financing?.vaAprPct }
      : undefined;
    await listings.save({ ...existing, ...parsed, financing, slug: existing.slug, builder: existing.builder });
  } catch (err) {
    return { issues: err instanceof ValidationError ? err.issues : [(err as Error).message], values };
  }
  revalidatePath(`/l/${kit}`);
  revalidatePath(`/home/${kit}`);
  // Hand back what was saved so the form re-renders with it (React resets a form after its action runs).
  return { saved: true, values };
}
