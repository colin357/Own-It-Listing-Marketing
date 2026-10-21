import { isAuthorizedApiRequest, unauthorized } from "@/lib/auth";
import { asRecord, errorResponse, readJson } from "@/lib/api";
import { saveLoanOfficer } from "@/lib/listings";
import { loanOfficers } from "@/lib/store";

type Ctx = RouteContext<"/api/loan-officers/[slug]">;

export async function GET(req: Request, ctx: Ctx) {
  if (!isAuthorizedApiRequest(req)) return unauthorized();
  const lo = await loanOfficers.get((await ctx.params).slug);
  return lo ? Response.json(lo) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function PUT(req: Request, ctx: Ctx) {
  if (!isAuthorizedApiRequest(req)) return unauthorized();
  try {
    return Response.json(await saveLoanOfficer(asRecord(await readJson(req)), (await ctx.params).slug));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  if (!isAuthorizedApiRequest(req)) return unauthorized();
  await loanOfficers.remove((await ctx.params).slug);
  return new Response(null, { status: 204 });
}
