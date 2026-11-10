import { headers } from "next/headers";

/** NEXT_PUBLIC_SITE_URL as a full origin, adding https:// when it was set without one (e.g. "kits.ownitsocial.com"). */
export function configuredOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

/** Absolute origin for links we hand to agents (share URLs, QR codes). */
export async function siteUrl(): Promise<string> {
  const configured = configuredOrigin();
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function originFromRequest(req: Request): string {
  const configured = configuredOrigin();
  if (configured) return configured;
  return new URL(req.url).origin;
}

/** The public page an agent sends to buyers (photos, details, payments, a call button). */
export function buyerPagePath(slug: string): string {
  return `/home/${slug}`;
}
