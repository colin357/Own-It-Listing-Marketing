import { isAuthorizedApiRequest, unauthorized } from "@/lib/auth";
import { asRecord, errorResponse, readJson, withLinks } from "@/lib/api";
import { createListing } from "@/lib/listings";
import { listings } from "@/lib/store";

/** GET /api/listings[?loanOfficer=slug] — list listings, newest first. */
export async function GET(req: Request) {
  if (!isAuthorizedApiRequest(req)) return unauthorized();
  const lo = new URL(req.url).searchParams.get("loanOfficer");
  const all = await listings.list();
  const filtered = lo ? all.filter((l) => l.loanOfficerSlug === lo) : all;
  return Response.json({ listings: filtered.map((l) => withLinks(req, l)) });
}

/**
 * POST /api/listings — create a listing (or an array of listings) and get
 * back the shareable kit URL. This is the endpoint to wire into Zapier /
 * Make / your CRM so every new listing produces a kit automatically.
 */
export async function POST(req: Request) {
  if (!isAuthorizedApiRequest(req)) return unauthorized();
  try {
    const body = await readJson(req);
    if (Array.isArray(body)) {
      const results = [];
      for (const [index, item] of body.entries()) {
        try {
          results.push({ index, ok: true, listing: withLinks(req, await createListing(asRecord(item))) });
        } catch (err) {
          const res = errorResponse(err);
          results.push({ index, ok: false, ...(await res.json()) });
        }
      }
      return Response.json({ results }, { status: results.every((r) => r.ok) ? 201 : 207 });
    }
    const listing = await createListing(asRecord(body));
    return Response.json(withLinks(req, listing), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
