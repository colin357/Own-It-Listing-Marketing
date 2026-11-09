import { validLoToken } from "@/lib/loLinks";
import { loanOfficers } from "@/lib/store";
import { getMetros } from "@/lib/detect/roster";
import { resolvePlace, suggestAddresses, type Bias } from "@/lib/addressSuggest";

export const dynamic = "force-dynamic";

/** Suggestions lean toward the LO's own area (their first row in metros.csv). */
async function loBias(slug: string): Promise<Bias | undefined> {
  const [lo, metros] = await Promise.all([loanOfficers.get(slug), getMetros()]);
  if (!lo) return undefined;
  const name = lo.name.trim().toLowerCase();
  const m = metros.find((x) => x.loanOfficers.some((n) => n.trim().toLowerCase() === name));
  return m ? { latitude: m.latitude, longitude: m.longitude } : undefined;
}

/**
 * Address autocomplete for the build page. `?q=` returns suggestions;
 * `?place=` turns a picked Google suggestion into a full address with ZIP.
 * Only works with a valid LO link, so the geocoder quota isn't open to anyone.
 */
export async function GET(req: Request, ctx: RouteContext<"/build/[lo]/[token]/suggest">) {
  const { lo: slug, token } = await ctx.params;
  if (!validLoToken(slug, token)) return Response.json({ error: "Not found" }, { status: 404 });
  const url = new URL(req.url);
  const session = url.searchParams.get("session")?.slice(0, 64) || undefined;
  try {
    const place = url.searchParams.get("place");
    if (place) return Response.json({ address: await resolvePlace(place, session) });
    const q = (url.searchParams.get("q") ?? "").slice(0, 120);
    return Response.json({ suggestions: await suggestAddresses(q, await loBias(slug), session) });
  } catch (err) {
    console.error("Address suggestions failed", err);
    return Response.json({ suggestions: [] });
  }
}
