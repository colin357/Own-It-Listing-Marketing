import { isAuthorizedApiRequest, unauthorized } from "@/lib/auth";
import { asRecord, errorResponse, readJson } from "@/lib/api";
import { saveLoanOfficer } from "@/lib/listings";
import { loanOfficers } from "@/lib/store";

export async function GET(req: Request) {
  if (!isAuthorizedApiRequest(req)) return unauthorized();
  return Response.json({ loanOfficers: await loanOfficers.list() });
}

export async function POST(req: Request) {
  if (!isAuthorizedApiRequest(req)) return unauthorized();
  try {
    return Response.json(await saveLoanOfficer(asRecord(await readJson(req))), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
