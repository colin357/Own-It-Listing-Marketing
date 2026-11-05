import { unauthorized } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { originFromRequest } from "@/lib/site";
import { cronAuthorized, fromVercelCron, newYorkHour } from "@/lib/cron";
import { DEFAULT_DAYS, lastRun, runDetection } from "@/lib/detect/run";

// Feed requests per metro, kit creation, then photo lookups until ~250s.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** The run happens at 3 AM New York time, so photos have hours to load before the 7 AM LO emails. */
const RUN_HOUR = 3;

/**
 * GET /api/cron/detect[?days=7&dryRun=1] — pull new listings for every metro,
 * match listing agents to the roster and create kits. Photos keep loading in
 * the background (/api/cron/photos) and loan officers are emailed at 7 AM
 * (/api/cron/emails).
 *
 * Vercel Cron fires at 07:00 and 08:00 UTC on Mondays and Thursdays and only
 * the one that lands at 3 AM in New York does the work, which keeps it at
 * 3 AM Eastern through daylight saving changes.
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return unauthorized();
  const sp = new URL(req.url).searchParams;
  if (fromVercelCron(req)) {
    if (newYorkHour() !== RUN_HOUR) return Response.json({ skipped: "Not 3 AM in New York." });
    // A manual run in the last 20 hours already pulled these listings; skip the feed (and its cost).
    const last = await lastRun();
    if (last && Date.now() - Date.parse(last.finishedAt) < 20 * 3_600_000)
      return Response.json({ skipped: `Listings were pulled at ${last.finishedAt}.` });
  }
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
