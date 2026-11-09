"use server";

import { revalidatePath } from "next/cache";
import { loanOfficers } from "@/lib/store";
import { validAccountToken } from "@/lib/loLinks";
import { loanOfficerToValues } from "@/lib/formValues";
import { parseLoanOfficerInput, ValidationError } from "@/lib/validate";
import type { LoanOfficer } from "@/lib/types";

export interface AccountFormState {
  issues?: string[];
  saved?: boolean;
  values?: Record<string, string>;
}

async function authorized(slug: string, token: string): Promise<LoanOfficer | null> {
  if (!validAccountToken(slug, token)) return null;
  return loanOfficers.get(slug);
}

const PROFILE_FIELDS = ["name", "title", "nmls", "company", "companyNmls", "phone", "email", "applyUrl", "brandColor", "disclaimer"];

export async function saveProfileAction(slug: string, token: string, _prev: AccountFormState, fd: FormData): Promise<AccountFormState> {
  const values = Object.fromEntries(PROFILE_FIELDS.map((k) => [k, String(fd.get(k) ?? "").trim()]));
  const lo = await authorized(slug, token);
  if (!lo) return { issues: ["This link isn't valid anymore. Sign in again from the home page."], values };
  if (!values.email) return { issues: ["email is required"], values };
  try {
    // Fields this form doesn't show (payments, accent color, photos) keep their saved values.
    const updated = parseLoanOfficerInput({ ...loanOfficerToValues(lo), ...values }, lo);
    await loanOfficers.save(updated);
  } catch (err) {
    return { issues: err instanceof ValidationError ? err.issues : [(err as Error).message], values };
  }
  revalidatePath(`/account/${slug}/${token}`);
  return { saved: true };
}

/** Saves an uploaded headshot or logo URL (the file itself went straight to Blob). */
export async function saveImageAction(slug: string, token: string, field: "headshotUrl" | "logoUrl", url: string) {
  const lo = await authorized(slug, token);
  if (!lo) return { error: "This link isn't valid anymore." };
  if (!/^https:\/\/[^/]+\.blob\.vercel-storage\.com\/lo\//.test(url) && process.env.VERCEL) return { error: "Unexpected upload location" };
  await loanOfficers.save({ ...lo, [field]: url, updatedAt: new Date().toISOString() });
  revalidatePath(`/account/${slug}/${token}`);
  return {};
}
