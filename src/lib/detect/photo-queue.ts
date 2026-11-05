import "server-only";
import { detections, documents, listings, locks, photoQueue } from "../store";
import { sendDigests } from "../digest";
import { lookupPhotos, photoSource, type PhotoResult } from "./providers";
import {
  abortZillowRun,
  ApifyBusyError,
  ApifyLimitError,
  getZillowRun,
  matchItems,
  runFinished,
  startZillowRun,
  zillowRunItems,
} from "./providers/zillow-photos";
import type { Detection, SourceListing } from "./types";

/**
 * Listing photos load in the background, not inside the detection run.
 *
 * A run can match hundreds of homes, and one Zillow scrape for all of them
 * can't finish inside Vercel's 5-minute function limit. So every match goes
 * into a queue (Redis sorted set, scored by when to try next). Each pass
 * starts a few small Apify runs (10 homes each), which keep going on Apify's
 * side however long they take; a later pass collects what they found. The
 * 3 AM run works the queue while it has time left, and /api/cron/photos picks
 * it up every 5 minutes after that.
 *
 * Homes Zillow doesn't show yet are retried with growing gaps for a week.
 */

/** Homes per Apify run, small enough that each finishes in a minute or two. */
const BATCH = 10;
/** Apify runs going at once. Apify's plan limits (memory, concurrent runs) push back with a 402/429, which we wait out. */
const MAX_RUNS = Math.max(1, Number(process.env.APIFY_MAX_RUNS) || 4);
/** Apify's own timeout for one run. */
const RUN_TIMEOUT_SEC = 900;
/** A run still going after this long is stopped and its homes requeued. */
const RUN_MAX_AGE_MS = 20 * 60_000;
/** While a home is in a run, its queue entry is pushed out this far so nothing else picks it up. */
const LEASE_MS = 30 * 60_000;
/** Zillow often lists photos a day or two late, so keep trying for this long. */
const KEEP_TRYING_DAYS = 7;
/** Waits after Zillow had no photos yet: 1h, 3h, 6h, 12h, then daily. */
const NOT_FOUND_RETRY_MS = [1, 3, 6, 12, 24].map((h) => h * 3_600_000);
/** Wait after Apify failed. */
const ERROR_RETRY_MS = 5 * 60_000;
/** Wait after Apify said the plan is at its limit (runs or memory); a running scrape usually frees room within a minute or two. */
const BUSY_RETRY_MS = 60_000;
/** After this many failed runs for a home, treat it like "not on Zillow yet" so it backs off. */
const MAX_QUICK_ERRORS = 5;

/** After Apify says the account is out of usage, check again this often (one request) until it works. */
const LIMIT_RETRY_MS = 30 * 60_000;

const RUNS_DOC = "photo-runs";
const BLOCKED_DOC = "photo-blocked";
const HOLD_DOC = "digest-hold";
const LOCK = "photo-queue";

interface InFlight {
  runId: string;
  datasetId: string;
  slugs: string[];
  startedAt: number;
}

/** Set while Apify refuses runs because the account is out of usage. */
export interface PhotoBlock {
  message: string;
  since: number;
  /** Next time a pass tries Apify again. */
  retryAt: number;
}

export async function photoBlock(): Promise<PhotoBlock | null> {
  return (await documents.get<PhotoBlock | null>(BLOCKED_DOC)) ?? null;
}

export interface QueueResult {
  /** Homes that got photos in this pass. */
  added: number;
  /** Homes sent to Apify in this pass. */
  started: number;
  /** Still queued (any time) and in Apify runs right now. */
  queued: number;
  inFlight: number;
  errors: string[];
  /** Another pass was already working the queue. */
  busy?: boolean;
  /** Apify is refusing runs (account out of usage); lookups are paused. */
  blocked?: PhotoBlock;
}

export function applyPhotos(l: SourceListing, p?: PhotoResult): SourceListing {
  if (!p) return l;
  return {
    ...l,
    photos: l.photos.length ? l.photos : p.photos,
    description: l.description ?? p.description,
    ...(p.listingUrl ? { listingUrl: p.listingUrl } : {}),
  };
}

/** Queue detections for a photo lookup (now, unless given). Already-queued ones keep their place unless `replace`. */
export async function queuePhotos(slugs: string[], dueAt = Date.now(), replace = false) {
  await photoQueue.add([...new Set(slugs)], dueAt, replace);
}

const inFlightRuns = async () => (await documents.get<InFlight[]>(RUNS_DOC)) ?? [];

/** Does this detection (or its kit) still need photos? */
async function needsPhotos(det: Detection | null): Promise<boolean> {
  if (!det || det.status === "dismissed") return false;
  if (det.listingSlug) {
    const kit = await listings.get(det.listingSlug);
    return !!kit && !kit.photos.length;
  }
  return !det.listing.photos.length;
}

/** Saves found photos to the detection and its kit, or schedules the next try. */
async function settle(slug: string, p: PhotoResult | undefined, failed: boolean): Promise<boolean> {
  const det = await detections.get(slug);
  if (!(await needsPhotos(det)) || !det) {
    await photoQueue.remove([slug]);
    return false;
  }
  const now = new Date().toISOString();
  if (p?.photos.length) {
    if (det.listingSlug) {
      // Re-read so a photo the agent just uploaded isn't overwritten.
      const latest = await listings.get(det.listingSlug);
      if (latest && !latest.photos.length) {
        await listings.save({
          ...latest,
          photos: p.photos,
          description: latest.description ?? p.description,
          listingUrl: latest.listingUrl ?? p.listingUrl,
          updatedAt: now,
        });
      }
    }
    await detections.save({ ...det, listing: applyPhotos(det.listing, p), updatedAt: now });
    await photoQueue.remove([slug]);
    return true;
  }
  const errors = (det.photoErrors ?? 0) + (failed ? 1 : 0);
  const quickRetry = failed && errors < MAX_QUICK_ERRORS;
  const tries = (det.photoTries ?? 0) + (quickRetry ? 0 : 1);
  await detections.save({ ...det, photoTries: tries, photoErrors: errors, updatedAt: now });
  const tooOld = Date.now() - Date.parse(det.createdAt) > KEEP_TRYING_DAYS * 86_400_000;
  if (tooOld) {
    await photoQueue.remove([slug]);
    return false;
  }
  const wait = quickRetry ? ERROR_RETRY_MS : NOT_FOUND_RETRY_MS[Math.min(tries - 1, NOT_FOUND_RETRY_MS.length - 1)];
  await photoQueue.add([slug], Date.now() + wait, true);
  return false;
}

/**
 * Works the photo queue until `deadline` (ms): collects finished Apify runs,
 * starts new ones for homes that are due, and waits on running ones in
 * between. Runs still going at the deadline are collected by the next pass.
 */
export async function processPhotoQueue({
  deadline,
  force = false,
}: {
  deadline: number;
  /** Try Apify even while paused for its usage limit (the admin "Fetch missing photos" button). */
  force?: boolean;
}): Promise<QueueResult> {
  const result: QueueResult = { added: 0, started: 0, queued: 0, inFlight: 0, errors: [] };
  const source = photoSource();
  if (!source) return result;

  let runs = await inFlightRuns();
  let block = await photoBlock();
  if (block && !force && Date.now() < block.retryAt) {
    return { ...result, blocked: block, queued: await photoQueue.count(), inFlight: runs.length };
  }
  // Nothing to do: skip the lock and return (this is most 5-minute ticks).
  if (!runs.length && !(await photoQueue.count(Date.now()))) {
    result.queued = await photoQueue.count();
    return result;
  }

  const lock = await locks.acquire(LOCK, Math.ceil((deadline - Date.now()) / 1000) + 60);
  if (!lock) return { ...result, busy: true, queued: await photoQueue.count(), inFlight: runs.length };
  const token = process.env.APIFY_TOKEN;
  try {
    runs = await inFlightRuns();
    const left = () => deadline - Date.now();

    while (left() > 15_000) {
      // 1. Collect runs that finished (or have gone on too long).
      if (token) {
        const still: InFlight[] = [];
        for (const run of runs) {
          try {
            const state = await getZillowRun(token, run.runId);
            const stale = Date.now() - run.startedAt > RUN_MAX_AGE_MS;
            if (!runFinished(state.status) && !stale) {
              still.push(run);
              continue;
            }
            if (!runFinished(state.status)) await abortZillowRun(token, run.runId);
            const dets = await Promise.all(run.slugs.map((s) => detections.get(s)));
            const asked = dets.filter((d): d is Detection => !!d).map((d) => d.listing);
            const items = await zillowRunItems(token, state.datasetId).catch(() => []);
            const found = matchItems(asked, items);
            const failed = state.status !== "SUCCEEDED";
            for (const d of dets) {
              if (!d) continue;
              if (await settle(d.slug, found.get(d.listing.id), failed && !found.get(d.listing.id)?.photos.length))
                result.added++;
            }
            if (failed) result.errors.push(`A Zillow photo run ended ${state.status.toLowerCase()}; its homes will be retried.`);
          } catch (err) {
            // Couldn't reach Apify about this run; keep it and look again next time.
            still.push(run);
            result.errors.push(`Photo run check failed: ${(err as Error).message}`);
          }
        }
        runs = still;
        await documents.set(RUNS_DOC, runs);
      }

      // 2. Start runs for homes that are due.
      let startedNow = 0;
      while ((source !== "zillow" || runs.length < MAX_RUNS) && left() > 30_000) {
        const due = await photoQueue.due(Date.now(), BATCH);
        if (!due.length) break;
        const dets = await Promise.all(due.map((s) => detections.get(s)));
        const keep: Detection[] = [];
        for (let i = 0; i < due.length; i++) {
          if (await needsPhotos(dets[i])) keep.push(dets[i]!);
          else await photoQueue.remove([due[i]]);
        }
        if (!keep.length) continue;
        const slugs = keep.map((d) => d.slug);
        await photoQueue.add(slugs, Date.now() + LEASE_MS, true);
        try {
          if (token) {
            const run = await startZillowRun(token, keep.map((d) => d.listing), RUN_TIMEOUT_SEC);
            runs.push({ runId: run.id, datasetId: run.datasetId, slugs, startedAt: Date.now() });
            await documents.set(RUNS_DOC, runs);
            if (block) {
              await documents.set(BLOCKED_DOC, null);
              block = null;
            }
          } else {
            // PHOTO_LOOKUP_URL webhook: answers right away, one home at a time.
            const found = await lookupPhotos(keep.map((d) => d.listing));
            for (const d of keep) if (await settle(d.slug, found.get(d.listing.id), false)) result.added++;
          }
          result.started += keep.length;
          startedNow++;
        } catch (err) {
          if (err instanceof ApifyLimitError) {
            // Out of usage: no point trying every 5 minutes. Pause, check again in 30, and say so in admin.
            const now = Date.now();
            block = { message: (err as Error).message, since: block?.since ?? now, retryAt: now + LIMIT_RETRY_MS };
            await documents.set(BLOCKED_DOC, block);
            await photoQueue.add(slugs, now, true);
            result.blocked = block;
            result.errors.push(
              "Photo lookups are paused: Apify says the account's monthly usage limit is used up. Raise it in Apify (Settings → Usage & billing) and photos resume on their own within 30 minutes.",
            );
            break;
          }
          const busy = err instanceof ApifyBusyError;
          await photoQueue.add(slugs, Date.now() + (busy ? BUSY_RETRY_MS : ERROR_RETRY_MS), true);
          if (!busy) result.errors.push(`Photo lookup failed: ${(err as Error).message}`);
          break; // Apify is at its limit (or down); let running scrapes finish first.
        }
      }

      if (result.blocked && !runs.length) break;
      if (!runs.length && !(await photoQueue.count(Date.now()))) {
        // Homes put back after Apify said "busy" come due in a minute; wait for them if there's time.
        if (left() > BUSY_RETRY_MS + 45_000 && (await photoQueue.count(Date.now() + BUSY_RETRY_MS))) {
          await new Promise((r) => setTimeout(r, BUSY_RETRY_MS + 1000));
          continue;
        }
        break;
      }
      if (!token) {
        if (!startedNow) break;
        continue;
      }
      // 3. Wait for the oldest run to finish (Apify holds the request open), then go round again.
      const wait = Math.min(45, Math.floor(left() / 1000) - 20);
      if (wait < 5 || !runs.length) break;
      await getZillowRun(token, runs[0].runId, wait).catch(() => undefined);
    }
    result.inFlight = runs.length;
    result.queued = await photoQueue.count();
    return result;
  } finally {
    await locks.release(LOCK, lock);
  }
}

/** True while homes from the latest run are still waiting on their first photo lookup. */
export async function photosLoading(): Promise<boolean> {
  if ((await inFlightRuns()).length) return true;
  // Paused for Apify's usage limit: photos won't arrive by themselves, so don't hold the LO emails for them.
  if (await photoBlock()) return false;
  // First lookups are due now; homes Zillow didn't have yet are pushed out an hour or more.
  return (await photoQueue.count(Date.now() + 15 * 60_000)) > 0;
}

/**
 * The LO digest shows each kit's first photo, so after a run it waits for
 * photos to load, up to `maxMs`. The photo cron sends it once they're in.
 */
export async function holdDigests(maxMs: number) {
  await documents.set(HOLD_DOC, { until: Date.now() + maxMs });
}

/**
 * Sends LO digests unless they're being held for photos. With `onlyIfHeld`,
 * does nothing when no hold is set (so the 5-minute photo cron doesn't scan
 * every kit on every tick).
 */
export async function sendDigestsWhenReady(
  origin: string,
  { onlyIfHeld = false } = {},
): Promise<{ sent: number; errors: string[]; held?: boolean }> {
  const hold = await documents.get<{ until: number } | null>(HOLD_DOC);
  if (!hold && onlyIfHeld) return { sent: 0, errors: [] };
  if (hold && Date.now() < hold.until && (await photosLoading())) return { sent: 0, errors: [], held: true };
  const mail = await sendDigests(origin);
  if (hold) await documents.set(HOLD_DOC, null);
  return mail;
}
