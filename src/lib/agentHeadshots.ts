import "server-only";
import { documents } from "./store";
import type { Listing } from "./types";

/**
 * Headshots agents upload on their kit page, saved per agent so the photo
 * carries over to every kit for that agent (current and future), not just
 * the one they uploaded it on. One small JSON map: agent key → image URL.
 */
const DOC = "agent-headshots";

/** "Jordan  Avery-Smith" → "jordan avery smith". Same agent name on any kit = same key. */
export function agentKey(name: string | undefined): string | null {
  const key = (name ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return key || null;
}

async function all(): Promise<Record<string, string>> {
  return (await documents.get<Record<string, string>>(DOC)) ?? {};
}

export async function savedHeadshot(agentName: string | undefined): Promise<string | undefined> {
  const key = agentKey(agentName);
  return key ? (await all())[key] : undefined;
}

export async function saveHeadshot(agentName: string, url: string): Promise<void> {
  const key = agentKey(agentName);
  if (!key) return;
  await documents.set(DOC, { ...(await all()), [key]: url });
}

/** Fills in the agent's saved headshot on a kit that has none of its own. */
export async function withSavedHeadshot(listing: Listing): Promise<Listing> {
  if (listing.agent.headshotUrl) return listing;
  const url = await savedHeadshot(listing.agent.name);
  return url ? { ...listing, agent: { ...listing.agent, headshotUrl: url } } : listing;
}

/** Only images uploaded through our Blob store into this kit's headshot folder. */
export function isUploadedHeadshot(u: string, slug: string): boolean {
  try {
    const url = new URL(u);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".blob.vercel-storage.com") &&
      url.pathname.startsWith(`/headshots/${slug}/`)
    );
  } catch {
    return false;
  }
}
