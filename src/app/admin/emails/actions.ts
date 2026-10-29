"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { siteUrl } from "@/lib/site";
import { sendDigests } from "@/lib/digest";

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
