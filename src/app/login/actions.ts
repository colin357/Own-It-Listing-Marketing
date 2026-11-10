"use server";

import { findByEmail, sendAccountLink } from "@/lib/billing";
import { countToday } from "@/lib/store";
import { siteUrl } from "@/lib/site";

export interface LoginState {
  sent?: boolean;
  error?: string;
  email?: string;
}

/** Emails the account link. Always answers the same way, so it doesn't reveal who has an account. */
export async function loginAction(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const email = String(fd.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter the email you signed up with.", email };
  if ((await countToday(`login:${email.toLowerCase()}`)) > 5) return { sent: true, email };
  const [lo] = await findByEmail(email);
  if (lo) {
    const errors = await sendAccountLink(lo, await siteUrl());
    if (errors.length) console.error("Sign-in email failed", errors);
  }
  return { sent: true, email };
}
