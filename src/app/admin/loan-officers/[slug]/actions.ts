"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { siteUrl } from "@/lib/site";
import { runDetection } from "@/lib/detect/run";
import { sendDigests } from "@/lib/digest";
import { mailConfigured } from "@/lib/mail";
import { loanOfficers } from "@/lib/store";

function back(slug: string, msg: string): never {
  revalidatePath(`/admin/loan-officers/${slug}`);
  redirect(`/admin/loan-officers/${slug}?msg=${encodeURIComponent(msg)}#manual-pull`);
}

/** Pulls new and 90-day listings in this loan officer's areas only. Sends no email. */
export async function runLoPullAction(slug: string) {
  let msg: string;
  try {
    const { run } = await runDetection({ origin: await siteUrl(), loSlug: slug });
    msg =
      `Pull done: ${run.metros} area${run.metros === 1 ? "" : "s"} checked, ${run.listingsScanned} listings scanned, ` +
      `${run.matches} new match${run.matches === 1 ? "" : "es"}, ${run.created} kit${run.created === 1 ? "" : "s"} created` +
      (run.review ? `, ${run.review} waiting for your review on New listings` : "") +
      (run.photosQueued ? `, photos still loading for ${run.photosQueued}` : "") +
      (run.errors.length ? `. Errors: ${run.errors.slice(0, 3).join(" ")}` : "") +
      ". Nothing was emailed.";
  } catch (err) {
    msg = `Pull failed: ${(err as Error).message}`;
  }
  back(slug, msg);
}

/** Emails this loan officer the kits waiting for them (with photos), now. Nobody else is emailed. */
export async function sendLoEmailAction(slug: string) {
  let msg: string;
  try {
    const lo = await loanOfficers.get(slug);
    if (!lo) throw new Error("That loan officer wasn't found.");
    if (!lo.email) throw new Error(`${lo.name} has no email address.`);
    if (!mailConfigured()) throw new Error("Email isn't set up.");
    const { sent, errors } = await sendDigests(await siteUrl(), slug);
    msg = sent
      ? `Sent ${sent} email${sent === 1 ? "" : "s"} to ${lo.name}.${errors.length ? ` ${errors.join(" ")}` : ""}`
      : `Nothing sent: no kits with photos are waiting for ${lo.name}.${errors.length ? ` ${errors.join(" ")}` : ""}`;
  } catch (err) {
    msg = `Sending failed: ${(err as Error).message}`;
  }
  back(slug, msg);
}
