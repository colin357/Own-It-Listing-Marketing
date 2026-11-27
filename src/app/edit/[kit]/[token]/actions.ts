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

/** What a loan officer can change. Address and loan officer stay admin-only. */
const KIT_EDIT_FIELDS = [
  "status",
  "agentName",
  "agentBrokerage",
  "agentPhone",
  "agentEmail",
  "agentLicense",
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

/** True when the last name changed, i.e. a different person rather than a typo or nickname fix. */
function differentPerson(before: string, after: string): boolean {
  const last = (n: string) => n.trim().toLowerCase().split(/\s+/).pop()?.replace(/[^a-z]/g, "") ?? "";
  return last(before) !== last(after);
}

export async function saveKitEditAction(kit: string, token: string, _prev: EditKitState, fd: FormData): Promise<EditKitState> {
  const values: Record<string, string> = {};
  for (const k of KIT_EDIT_FIELDS) values[k] = String(fd.get(k) ?? "").trim();
  values.showPayment = fd.has("showPayment") ? "true" : "false";
  const builder = fd.has("builder") ? String(fd.get("builder") ?? "").trim() : undefined;
  if (builder !== undefined) values.builder = builder;

  if (!validKitEditToken(kit, token)) return { issues: ["This link isn't valid anymore. Ask us for a new one."], values };
  const existing = await listings.get(kit);
  if (!existing) return { issues: ["This kit no longer exists."], values };
  values.photos = allowedPhotos(values.photos, existing);
  if (existing.builder && !builder) return { issues: ["Add the builder's name so it shows on the graphics."], values };
  // A builder kit can leave the sales contact blank: the builder's name stands in, as on the build page.
  if (existing.builder && !values.agentName) values.agentName = builder!;
  if (!values.agentName) return { issues: ["Add the agent's name."], values };
  if (values.rate && !values.apr) return { issues: ["Add the APR with the rate. Every rate shown needs its APR."], values };
  if (values.fhaRate && !values.fhaApr) return { issues: ["Add the FHA APR with the FHA rate."], values };
  if (values.openHouseDate && (!values.openHouseStart || !values.openHouseEnd))
    return { issues: ["Add a start and end time for the open house."], values };

  try {
    // Fields this form doesn't show (address, headshot, seller incentive…) keep their saved values.
    const parsed = parseListingInput({ ...listingToValues(existing), ...values }, existing);
    const financing = parsed.financing
      ? { ...parsed.financing, vaRatePct: existing.financing?.vaRatePct, vaAprPct: existing.financing?.vaAprPct }
      : undefined;
    // A different agent (not just a spelling fix) shouldn't keep the old agent's face; their own saved headshot fills in.
    const agent = differentPerson(existing.agent.name, parsed.agent.name)
      ? { ...parsed.agent, headshotUrl: undefined }
      : { ...parsed.agent, headshotUrl: existing.agent.headshotUrl };
    await listings.save({
      ...existing,
      ...parsed,
      agent,
      financing,
      slug: existing.slug,
      builder: existing.builder ? builder : undefined,
    });
  } catch (err) {
    return { issues: err instanceof ValidationError ? err.issues : [(err as Error).message], values };
  }
  revalidatePath(`/l/${kit}`);
  revalidatePath(`/home/${kit}`);
  // Hand back what was saved so the form re-renders with it (React resets a form after its action runs).
  return { saved: true, values };
}
