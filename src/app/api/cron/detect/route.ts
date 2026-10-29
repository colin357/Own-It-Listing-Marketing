import { isAuthorizedApiRequest, unauthorized } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { originFromRequest } from "@/lib/site";
import { DEFAULT_DAYS, runDetection } from "@/lib/detect/run";

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
 * Vercel Cron runs in UTC, so vercel.json fires at both 11:00 and 12:00 UTC
 * and only the one that lands at 7 AM in New York does the work. That keeps
 * the run at 7 AM Eastern through daylight saving changes.
 */
function isScheduledHour(): boolean {
  const hour = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date());
  return Number(hour) === 7;
}

/**
 * GET /api/cron/detect[?days=7&dryRun=1] — pull new listings for every metro,
 * match listing agents to the roster, create kits and email each loan officer.
 * Runs Mondays and Thursdays at 7 AM Eastern via vercel.json.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return unauthorized();
  const sp = new URL(req.url).searchParams;
  if (req.headers.get("user-agent")?.startsWith("vercel-cron") && !isScheduledHour())
    return Response.json({ skipped: "Not 7 AM in New York; the other scheduled run handles today." });
  const days = Math.min(30, Math.max(1, Number(sp.get("days")) || DEFAULT_DAYS));
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
