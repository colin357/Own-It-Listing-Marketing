"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { siteUrl } from "@/lib/site";
import { createCheckout, findByEmail, sendAccountLink, stripeConfigured, type SignupInput } from "@/lib/billing";
import { isActive } from "@/lib/plan";
import { countToday } from "@/lib/store";

export interface SignupState {
  issues?: string[];
  notice?: string;
  values?: Record<string, string>;
}


const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signupAction(_prev: SignupState, fd: FormData): Promise<SignupState> {
  const v = (k: string) => String(fd.get(k) ?? "").trim();
  const values = Object.fromEntries(["name", "email", "phone", "title", "company", "nmls", "companyNmls"].map((k) => [k, v(k)]));
  const issues: string[] = [];
  if (!values.name) issues.push("Enter your full name.");
  if (!EMAIL.test(values.email)) issues.push("Enter a valid email address.");
  if (!values.company) issues.push("Enter your company.");
  if (!/^\d{3,10}$/.test(values.nmls.replace(/\D/g, ""))) issues.push("Enter your NMLS # (numbers only).");
  if (issues.length) return { issues, values };
  if (!stripeConfigured()) return { issues: ["Signups open soon. Email us and we'll set you up."], values };

  const site = await siteUrl();
  const existing = (await findByEmail(values.email)).find((lo) => lo.billing && isActive(lo));
  if (existing) {
    if ((await countToday(`login:${values.email.toLowerCase()}`)) <= 5) await sendAccountLink(existing, site);
    return { notice: "You already have an account. We just emailed your sign-in link.", values };
  }

  const input: SignupInput = {
    name: values.name,
    email: values.email,
    phone: values.phone || undefined,
    title: values.title || undefined,
    company: values.company,
    nmls: values.nmls.replace(/\D/g, ""),
    companyNmls: values.companyNmls.replace(/\D/g, "") || undefined,
  };
  let url: string;
  try {
    url = await createCheckout(input, site, undefined, undefined, await metaClick());
  } catch (err) {
    console.error("Checkout failed", err);
    return { issues: ["We couldn't open the payment page. Try again in a minute."], values };
  }
  redirect(url);
}

/** Meta ad-click cookies and browser details, so the trial can be credited to the ad that brought them. */
async function metaClick() {
  const c = await cookies();
  const h = await headers();
  return {
    fbp: c.get("_fbp")?.value,
    fbc: c.get("_fbc")?.value,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
    ua: h.get("user-agent") ?? undefined,
  };
}
