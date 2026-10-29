"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createListing, saveLoanOfficer, updateListing } from "@/lib/listings";
import { listings, loanOfficers } from "@/lib/store";
import { ValidationError } from "@/lib/validate";

export interface FormState {
  issues?: string[];
  values?: Record<string, string>;
}

function formToRecord(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  // Unchecked checkboxes are absent from FormData.
  for (const key of fd.keys())
    if (key.endsWith("__present") && !fd.has(key.slice(0, -"__present".length))) out[key.slice(0, -"__present".length)] = "false";
  return out;
}

function failure(err: unknown, values: Record<string, string>): FormState {
  if (err instanceof ValidationError) return { issues: err.issues, values };
  return { issues: [err instanceof Error ? err.message : "Something went wrong"], values };
}

export async function saveListingAction(slug: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const values = formToRecord(fd);
  let saved: string;
  try {
    const listing = slug ? await updateListing(slug, values) : await createListing(values);
    if (!listing) return { issues: ["Listing no longer exists"], values };
    saved = listing.slug;
  } catch (err) {
    return failure(err, values);
  }
  revalidatePath("/admin");
  redirect(`/admin?saved=${saved}`);
}

export async function deleteListingAction(slug: string) {
  await listings.remove(slug);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function saveLoanOfficerAction(slug: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const values = formToRecord(fd);
  try {
    await saveLoanOfficer(values, slug ?? undefined);
  } catch (err) {
    return failure(err, values);
  }
  revalidatePath("/admin");
  redirect("/admin/loan-officers");
}

export async function deleteLoanOfficerAction(slug: string) {
  const inUse = (await listings.list()).some((l) => l.loanOfficerSlug === slug);
  if (inUse) throw new Error("This loan officer still has listings. Delete or reassign them first.");
  await loanOfficers.remove(slug);
  revalidatePath("/admin");
  redirect("/admin/loan-officers");
}
