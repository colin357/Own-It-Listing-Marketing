import { isAuthorizedApiRequest, unauthorized } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { ValidationError } from "@/lib/validate";
import { getMetros, getRoster, parseCsv, parseMetros, parseRoster, saveMetros, saveRoster } from "@/lib/detect/roster";

/** GET /api/roster — the agents and metros detection watches. */
export async function GET(req: Request) {
  if (!isAuthorizedApiRequest(req)) return unauthorized();
  const [agents, metros] = await Promise.all([getRoster(), getMetros()]);
  return Response.json({ agents, metros });
}

/**
 * POST /api/roster?type=agents|metros — replace the roster or the metros.
 * Body is the CSV (text/csv) or a JSON array of rows with the same columns.
 */
export async function POST(req: Request) {
  if (!isAuthorizedApiRequest(req)) return unauthorized();
  const type = new URL(req.url).searchParams.get("type");
  try {
    if (type !== "agents" && type !== "metros") throw new ValidationError(['type must be "agents" or "metros"']);
    const text = await req.text();
    let rows: Record<string, unknown>[];
    if ((req.headers.get("content-type") ?? "").includes("json")) {
      const body = JSON.parse(text);
      if (!Array.isArray(body)) throw new ValidationError(["JSON body must be an array of rows"]);
      rows = body;
    } else rows = parseCsv(text);
    if (!rows.length) throw new ValidationError(["No rows found"]);
    if (type === "agents") {
      const agents = parseRoster(rows);
      await saveRoster(agents);
      return Response.json({ saved: agents.length });
    }
    const metros = parseMetros(rows);
    await saveMetros(metros);
    return Response.json({ saved: metros.length });
  } catch (err) {
    if (err instanceof SyntaxError) return errorResponse(new ValidationError(["Body must be valid JSON"]));
    return errorResponse(err);
  }
}
