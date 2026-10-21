import { isAuthorizedApiRequest, unauthorized } from "@/lib/auth";
import { asRecord, errorResponse, readJson, withLinks } from "@/lib/api";
import { updateListing } from "@/lib/listings";
import { listings } from "@/lib/store";

type Ctx = RouteContext<"/api/listings/[slug]">;

export async function GET(req: Request, ctx: Ctx) {
  if (!isAuthorizedApiRequest(req)) return unauthorized();
  const listing = await listings.get((await ctx.params).slug);
  return listing ? Response.json(await withLinks(req, listing)) : Response.json({ error: "Not found" }, { status: 404 });
}

/** PUT replaces the listing. */
export async function PUT(req: Request, ctx: Ctx) {
  if (!isAuthorizedApiRequest(req)) return unauthorized();
  try {
    const listing = await updateListing((await ctx.params).slug, asRecord(await readJson(req)));
    return listing ? Response.json(await withLinks(req, listing)) : Response.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    return errorResponse(err);
  }
}

/** PATCH merges fields, e.g. {"status": "just-sold"} or {"price": 499000, "status": "price-improved"}. */
export async function PATCH(req: Request, ctx: Ctx) {
  if (!isAuthorizedApiRequest(req)) return unauthorized();
  try {
    const { slug } = await ctx.params;
    const existing = await listings.get(slug);
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
    const patch = asRecord(await readJson(req));
    const agentPatch = patch.agent && typeof patch.agent === "object" ? patch.agent : {};
    const merged = { ...existing, ...patch, agent: { ...existing.agent, ...agentPatch } };
    const listing = await updateListing(slug, merged);
    return Response.json(await withLinks(req, listing!));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  if (!isAuthorizedApiRequest(req)) return unauthorized();
  await listings.remove((await ctx.params).slug);
  return new Response(null, { status: 204 });
}
