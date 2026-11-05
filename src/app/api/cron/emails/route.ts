import { unauthorized } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { originFromRequest } from "@/lib/site";
import { cronAuthorized, fromVercelCron, newYorkHour } from "@/lib/cron";
import { holdDigests, photosLoading, sendDigestsWhenReady } from "@/lib/detect/photo-queue";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const SEND_HOUR = 7;
/** If photos are still loading at 7 AM, wait for them until about 9 AM at most. */
const MAX_WAIT_MS = 2 * 3_600_000;

/**
 * GET /api/cron/emails — each loan officer gets one email with every kit
 * they haven't been sent yet. Vercel Cron fires daily at 11:00, 12:00 and
 * 13:00 UTC; the one at 7 AM New York time sends (or, if photos are still
 * loading, waits for /api/cron/photos to send once they're in). The later
 * ones retry anything that didn't go out. Days with no new kits send nothing.
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return unauthorized();
  const origin = originFromRequest(req);
  try {
    const hour = newYorkHour();
    if (fromVercelCron(req) && hour < SEND_HOUR) return Response.json({ skipped: "Before 7 AM in New York." });
    if (hour === SEND_HOUR && (await photosLoading())) {
      await holdDigests(MAX_WAIT_MS);
      return Response.json({ held: "Photos are still loading; emails go out when they're done (by about 9 AM)." });
    }
    return Response.json(await sendDigestsWhenReady(origin));
  } catch (err) {
    return errorResponse(err);
  }
}
