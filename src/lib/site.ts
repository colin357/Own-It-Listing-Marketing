import { headers } from "next/headers";

/** Absolute origin for links we hand to agents (share URLs, QR codes). */
export async function siteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function originFromRequest(req: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return new URL(req.url).origin;
}

/** The public page an agent sends to buyers (photos, details, payments, a call button). */
export function buyerPagePath(slug: string): string {
  return `/home/${slug}`;
}
