"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { siteUrl } from "@/lib/site";
import { sendDigests, testDigest } from "@/lib/digest";
import { sendMail } from "@/lib/mail";

export async function sendNowAction() {
  let msg: string;
  try {
    const { sent, errors } = await sendDigests(await siteUrl());
    msg = `Sent ${sent} email${sent === 1 ? "" : "s"}.${errors.length ? ` ${errors.join(" ")}` : ""}`;
  } catch (err) {
    msg = `Sending failed: ${(err as Error).message}`;
  }
  revalidatePath("/admin/emails");
  redirect(`/admin/emails?msg=${encodeURIComponent(msg)}`);
}

/** Sends one loan officer's email to MAIL_FROM only, without marking anything sent. */
export async function sendTestAction() {
  let msg: string;
  try {
    const d = await testDigest(await siteUrl());
    if (!d) throw new Error("There are no kits yet, so there's nothing to put in a test email.");
    const to = process.env.MAIL_FROM!;
    const errors = await sendMail([{ to: [to], subject: `[TEST for ${d.loName}] ${d.subject}`, html: d.html }]);
    msg = errors.length ? `Test failed: ${errors.join(" ")}` : `Test email (${d.loName}'s) sent to ${to}. Nothing was sent to loan officers.`;
  } catch (err) {
    msg = `Test failed: ${(err as Error).message}`;
  }
  redirect(`/admin/emails?msg=${encodeURIComponent(msg)}`);
}
