import { isAuthorizedApiRequest, unauthorized } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { originFromRequest } from "@/lib/site";
import { runDetection } from "@/lib/detect/run";

// Feed requests per metro plus one photo-scrape batch.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(req: Request) {
  // Vercel Cron sends "Authorization: Bearer $CRON_SECRET"; the API key works for manual runs.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return isAuthorizedApiRequest(req);
}

/**
 * GET /api/cron/detect[?days=2&dryRun=1] — pull new listings for every metro,
 * match listing agents to the roster and create kits. Runs daily via vercel.json.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return unauthorized();
  const sp = new URL(req.url).searchParams;
  const days = Math.min(30, Math.max(1, Number(sp.get("days")) || 2));
  const dryRun = ["1", "true"].includes(sp.get("dryRun") ?? "");
  try {
    const { run, detections } = await runDetection({ days, dryRun, origin: originFromRequest(req) });
    return Response.json({
      run,
      detections: detections.map((d) => ({
        status: d.status,
        confidence: d.confidence,
        reason: d.reason,
        address: `${d.listing.address}, ${d.listing.city}, ${d.listing.state}`,
        agent: d.listing.agent.name,
        loanOfficer: d.loanOfficerName,
        photos: d.listing.photos.length,
        listingSlug: d.listingSlug,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
