import { unauthorized } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { originFromRequest } from "@/lib/site";
import { cronAuthorized } from "@/lib/cron";
import { processPhotoQueue, sendDigestsWhenReady } from "@/lib/detect/photo-queue";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/photos — every 5 minutes: load listing photos for queued
 * kits (src/lib/detect/photo-queue.ts), then send the 7 AM loan officer
 * emails if they were waiting on photos. Returns at once when nothing is queued.
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return unauthorized();
  try {
    const photos = await processPhotoQueue({ deadline: Date.now() + 240_000 });
    const mail = await sendDigestsWhenReady(originFromRequest(req), { onlyIfHeld: true });
    return Response.json({ photos, emails: mail });
  } catch (err) {
    return errorResponse(err);
  }
}
