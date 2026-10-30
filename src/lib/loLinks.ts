import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Each loan officer gets a private "build a kit" link, /build/<slug>/<token>.
 * The token is an HMAC of the slug, so nothing is stored and links never
 * expire. Set LO_LINK_SECRET to rotate every link at once (it falls back to
 * ADMIN_PASSWORD, so changing that also changes the links).
 */
function secret(): string | null {
  return process.env.LO_LINK_SECRET || process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== "production" ? "dev" : null);
}

export function loToken(slug: string): string | null {
  const s = secret();
  return s ? createHmac("sha256", s).update(`build:${slug}`).digest("base64url").slice(0, 16) : null;
}

export function validLoToken(slug: string, token: string): boolean {
  const expected = loToken(slug);
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function buildPath(slug: string): string | null {
  const token = loToken(slug);
  return token ? `/build/${slug}/${token}` : null;
}
