import { getKit } from "@/lib/listings";
import type { Listing, LoanOfficer } from "@/lib/types";

/**
 * The kit(s) for an "Email kit" page: the listing in the path, plus any in
 * ?with=a,b (one agent's other listings, see agentEmailPagePath). Extra
 * listings must belong to the same loan officer; others are ignored.
 */
export async function loadEmailKits(
  slug: string,
  withParam: string | string[] | null | undefined,
): Promise<{ listings: Listing[]; lo: LoanOfficer } | null> {
  const kit = await getKit(slug);
  if (!kit) return null;
  const raw = Array.isArray(withParam) ? withParam.join(",") : (withParam ?? "");
  const more = [...new Set(raw.split(",").map((s) => s.trim()).filter((s) => s && s !== slug))].slice(0, 20);
  const others = (await Promise.all(more.map((s) => getKit(s))))
    .filter((k) => !!k && k.lo.slug === kit.lo.slug)
    .map((k) => k!.listing);
  return { listings: [kit.listing, ...others], lo: kit.lo };
}
