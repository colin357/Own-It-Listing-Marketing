import "server-only";
import { detections, documents, listings, loanOfficers } from "../store";
import { createListing } from "../listings";
import { formatNumber, slugify } from "../format";
import type { Listing, LoanOfficer } from "../types";
import { AUTO_CONFIDENCE, buildMatcher, nameParts, type Match } from "./match";
import { getMetros, getRoster } from "./roster";
import { listingProvider, lookupPhotos, photoSource, type PhotoResult } from "./providers";
import type { Detection, DetectionRun, SourceListing } from "./types";

/** Loan officer record for a roster/metro name, matched on first + last name. */
function loFinder(los: LoanOfficer[]) {
  const byName = new Map<string, LoanOfficer>();
  for (const lo of los) {
    const p = nameParts(lo.name);
    if (p) byName.set(`${p.first} ${p.last}`, lo);
  }
  return (name: string) => {
    const p = nameParts(name);
    return p ? byName.get(`${p.first} ${p.last}`) : undefined;
  };
}

function lotSizeLabel(sqft?: number): string | undefined {
  if (!sqft) return undefined;
  return sqft >= 21_780 ? `${(sqft / 43_560).toFixed(2)} acres` : `${formatNumber(Math.round(sqft))} sq ft`;
}

function highlightsFor(l: SourceListing): string[] {
  const h: string[] = [];
  if (l.listingType === "New Construction") h.push("New construction");
  if (l.yearBuilt) h.push(`Built in ${l.yearBuilt}`);
  const lot = lotSizeLabel(l.lotSizeSqft);
  if (lot && l.lotSizeSqft! >= 10_000) h.push(`${lot} lot`);
  return h;
}

/** Creates the listing kit for a detection and records where it came from. */
export async function createKitFromDetection(det: Detection, lo: LoanOfficer): Promise<Listing> {
  const s = det.listing;
  const created = await createListing({
    loanOfficerSlug: lo.slug,
    status: "just-listed",
    address: s.address,
    unit: s.unit,
    city: s.city,
    state: s.state,
    zip: s.zip,
    price: s.price,
    beds: s.beds,
    baths: s.baths,
    sqft: s.sqft,
    lotSize: lotSizeLabel(s.lotSizeSqft),
    yearBuilt: s.yearBuilt,
    description: s.description,
    highlights: highlightsFor(s),
    photos: s.photos,
    agent: {
      name: s.agent.name,
      phone: s.agent.phone ?? det.rosterAgent.phone,
      email: s.agent.email ?? det.rosterAgent.email,
      brokerage: s.office?.name ?? det.rosterAgent.brokerage,
    },
    listingUrl: s.listingUrl,
  });
  const listing: Listing = {
    ...created,
    source: { provider: s.provider, id: s.id, mlsNumber: s.mlsNumber, mlsName: s.mlsName, detectedAt: det.createdAt },
  };
  await listings.save(listing);
  return listing;
}

/**
 * Optional notification so a Zap/Make scenario can text or email the loan
 * officer (or the agent) the moment a kit exists.
 */
async function notify(origin: string, listing: Listing, lo: LoanOfficer, det: Detection) {
  const url = process.env.DETECTION_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "kit.created",
        kitUrl: `${origin}/l/${listing.slug}`,
        downloadUrl: `${origin}/l/${listing.slug}/download`,
        needsPhotos: listing.photos.length === 0,
        listing: {
          slug: listing.slug,
          address: listing.address,
          city: listing.city,
          state: listing.state,
          zip: listing.zip,
          price: listing.price,
          mlsNumber: det.listing.mlsNumber,
        },
        agent: listing.agent,
        loanOfficer: { slug: lo.slug, name: lo.name, email: lo.email, phone: lo.phone },
        match: { confidence: det.confidence, reason: det.reason },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.error("Detection webhook failed", err);
  }
}

function applyPhotos(l: SourceListing, p?: PhotoResult): SourceListing {
  if (!p) return l;
  return {
    ...l,
    photos: l.photos.length ? l.photos : p.photos,
    description: l.description ?? p.description,
    ...(p.listingUrl ? { listingUrl: p.listingUrl } : {}),
  };
}

export interface RunOptions {
  /** Look back this many days (overlap protects against a missed run). */
  days?: number;
  /** Match and report, but don't save anything or create kits. */
  dryRun?: boolean;
  origin: string;
}

export async function runDetection({ days = 2, dryRun = false, origin }: RunOptions) {
  const startedAt = new Date().toISOString();
  const provider = listingProvider();
  if (!provider) throw new Error("No listings feed configured. Set RENTCAST_API_KEY.");
  const [roster, metros, los] = await Promise.all([getRoster(), getMetros(), loanOfficers.list()]);
  if (!roster.length || !metros.length) throw new Error("Upload the agent roster and metros first (Admin → Roster).");

  const match = buildMatcher(roster, metros);
  const findLo = loFinder(los);
  const errors: string[] = [];
  const seen = new Set<string>();
  const found: { listing: SourceListing; match: Match; slug: string }[] = [];
  let requests = 0;
  let scanned = 0;

  for (const metro of metros) {
    try {
      const res = await provider.fetchNewListings(metro, days);
      requests += res.requests;
      for (const l of res.listings) {
        // Metros overlap (e.g. Frisco and Carrollton), so the same listing can come back twice.
        if (seen.has(l.id)) continue;
        seen.add(l.id);
        scanned++;
        const m = match(l);
        if (!m) continue;
        const slug = slugify(`${l.provider}-${l.id}`);
        if (await detections.get(slug)) continue;
        found.push({ listing: l, match: m, slug });
      }
    } catch (err) {
      errors.push((err as Error).message);
    }
  }

  // Photos only for matches, which keeps scraping to a handful of homes a day.
  let photos = new Map<string, PhotoResult>();
  if (photoSource() && found.length && !dryRun) {
    try {
      photos = await lookupPhotos(found.map((f) => f.listing));
    } catch (err) {
      errors.push(`Photo lookup failed: ${(err as Error).message}`);
    }
  }

  const now = new Date().toISOString();
  const results: Detection[] = [];
  let created = 0;
  let photosAdded = 0;
  for (const f of found) {
    const loName = f.match.agent.loanOfficer;
    const lo = findLo(loName);
    const det: Detection = {
      slug: f.slug,
      status: f.match.confidence >= AUTO_CONFIDENCE ? (lo ? "created" : "waiting-lo") : "review",
      confidence: f.match.confidence,
      reason: f.match.reason,
      rosterAgent: f.match.agent,
      loanOfficerName: loName,
      loanOfficerSlug: lo?.slug,
      listing: applyPhotos(f.listing, photos.get(f.listing.id)),
      createdAt: now,
      updatedAt: now,
    };
    if (!dryRun) {
      if (det.status === "created" && lo) {
        try {
          const kit = await createKitFromDetection(det, lo);
          det.listingSlug = kit.slug;
          created++;
          await notify(origin, kit, lo, det);
        } catch (err) {
          det.status = "review";
          det.reason += `; kit creation failed: ${(err as Error).message}`;
          errors.push(`${det.listing.address}: ${(err as Error).message}`);
        }
      }
      await detections.save(det);
    }
    results.push(det);
  }

  if (!dryRun) {
    const open = await detections.list();

    // Zillow often shows a listing's photos a day or two after it hits the feed,
    // so keep retrying for a week for kits still without photos.
    const weekAgo = Date.now() - 7 * 86_400_000;
    const retry = [];
    for (const det of open) {
      if (det.status !== "created" || !det.listingSlug || Date.parse(det.createdAt) < weekAgo) continue;
      const kit = await listings.get(det.listingSlug);
      if (kit && !kit.photos.length) retry.push({ det, kit });
    }
    if (retry.length && photoSource()) {
      try {
        const found = await lookupPhotos(retry.map((r) => r.det.listing));
        for (const { det, kit } of retry) {
          const p = found.get(det.listing.id);
          if (!p?.photos.length) continue;
          // Re-read so a photo the agent just uploaded isn't overwritten.
          const latest = await listings.get(kit.slug);
          if (!latest || latest.photos.length) continue;
          await listings.save({
            ...latest,
            photos: p.photos,
            description: latest.description ?? p.description,
            listingUrl: latest.listingUrl ?? p.listingUrl,
            updatedAt: new Date().toISOString(),
          });
          await detections.save({ ...det, listing: applyPhotos(det.listing, p), updatedAt: new Date().toISOString() });
          photosAdded++;
        }
      } catch (err) {
        errors.push(`Photo retry failed: ${(err as Error).message}`);
      }
    }

    // Confident matches that were waiting for their loan officer to be added.
    for (const det of open) {
      if (det.status !== "waiting-lo") continue;
      const lo = findLo(det.loanOfficerName);
      if (!lo) continue;
      try {
        const kit = await createKitFromDetection(det, lo);
        await detections.save({
          ...det,
          status: "created",
          loanOfficerSlug: lo.slug,
          listingSlug: kit.slug,
          updatedAt: new Date().toISOString(),
        });
        created++;
        await notify(origin, kit, lo, det);
      } catch (err) {
        errors.push(`${det.listing.address}: ${(err as Error).message}`);
      }
    }
  }

  const run: DetectionRun = {
    startedAt,
    finishedAt: new Date().toISOString(),
    provider: provider.name,
    dryRun,
    metros: metros.length,
    requests,
    listingsScanned: scanned,
    matches: results.length,
    created,
    photosAdded,
    review: results.filter((d) => d.status === "review").length,
    waitingLo: results.filter((d) => d.status === "waiting-lo").length,
    errors,
  };
  // A test run saves nothing else, so keep what it found for the admin page to show.
  await documents.set(dryRun ? "detection-test" : "detection-run", dryRun ? { run, detections: results } : run);
  return { run, detections: results };
}

/** Approve a detection from the review queue (or one waiting on its loan officer). */
export async function approveDetection(slug: string, origin: string, loSlug?: string) {
  const det = await detections.get(slug);
  if (!det) throw new Error("Detection not found");
  if (det.status === "created" && det.listingSlug) return det;
  const los = await loanOfficers.list();
  const lo = loSlug ? los.find((x) => x.slug === loSlug) : loFinder(los)(det.loanOfficerName);
  if (!lo) throw new Error(`Add loan officer "${det.loanOfficerName}" first, or pick one.`);
  let listing = det.listing;
  if (!listing.photos.length && photoSource()) {
    const p = (await lookupPhotos([listing]).catch(() => null))?.get(listing.id);
    listing = applyPhotos(listing, p);
  }
  const ready = { ...det, listing };
  const kit = await createKitFromDetection(ready, lo);
  const saved: Detection = {
    ...ready,
    status: "created",
    loanOfficerSlug: lo.slug,
    listingSlug: kit.slug,
    updatedAt: new Date().toISOString(),
  };
  await detections.save(saved);
  await notify(origin, kit, lo, saved);
  return saved;
}

export async function dismissDetection(slug: string) {
  const det = await detections.get(slug);
  if (!det) return;
  await detections.save({ ...det, status: "dismissed", updatedAt: new Date().toISOString() });
}

export async function lastRun() {
  return documents.get<DetectionRun>("detection-run");
}

export async function lastTestRun() {
  return documents.get<{ run: DetectionRun; detections: Detection[] }>("detection-test");
}
