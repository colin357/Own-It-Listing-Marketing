import { validLoToken } from "@/lib/loLinks";
import { loanOfficers } from "@/lib/store";
import { getMetros } from "@/lib/detect/roster";
import { resolvePlace, suggestAddresses, type Bias } from "@/lib/addressSuggest";

export const dynamic = "force-dynamic";

/**
 * Suggestions lean toward the LO's own area (their first row in metros.csv).
 * Kept in memory for a while: reading the LO and metros on every keystroke
 * added two database round trips to each suggestion.
 */
const biasCache = new Map<string, { at: number; bias?: Bias }>();
const BIAS_TTL = 30 * 60_000;

async function loBias(slug: string): Promise<Bias | undefined> {
  const hit = biasCache.get(slug);
  if (hit && Date.now() - hit.at < BIAS_TTL) return hit.bias;
  const [lo, metros] = await Promise.all([loanOfficers.get(slug), getMetros()]);
  const name = lo?.name.trim().toLowerCase();
  const m = name ? metros.find((x) => x.loanOfficers.some((n) => n.trim().toLowerCase() === name)) : undefined;
  const bias = m ? { latitude: m.latitude, longitude: m.longitude } : undefined;
  biasCache.set(slug, { at: Date.now(), bias });
  return bias;
}

/** Recent answers, so retyping or backspacing doesn't wait on the geocoder again. */
const answers = new Map<string, unknown>();
function remember(key: string, value: unknown) {
  if (answers.size > 500) answers.delete(answers.keys().next().value as string);
  answers.set(key, value);
}

const json = (body: unknown) =>
  Response.json(body, { headers: { "Cache-Control": "private, max-age=600" } });

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
    if (place) return json({ address: await resolvePlace(place, session) });
    const q = (url.searchParams.get("q") ?? "").slice(0, 120).trim();
    const key = `${slug}|${q.toLowerCase()}`;
    const cached = answers.get(key);
    if (cached) return json(cached);
    const body = { suggestions: await suggestAddresses(q, await loBias(slug), session) };
    remember(key, body);
    return json(body);
  } catch (err) {
    console.error("Address suggestions failed", err);
    return Response.json({ suggestions: [] });
  }
}
