import { isAuthorizedApiRequest, unauthorized } from "@/lib/auth";
import { detections } from "@/lib/store";
import { lastRun } from "@/lib/detect/run";

/** GET /api/detections[?status=review] — detected listings, newest first, plus the last run. */
export async function GET(req: Request) {
  if (!isAuthorizedApiRequest(req)) return unauthorized();
  const status = new URL(req.url).searchParams.get("status");
  const all = await detections.list();
  return Response.json({
    lastRun: await lastRun(),
    detections: status ? all.filter((d) => d.status === status) : all,
  });
}
