import "server-only";
import { detections, listings } from "../store";
import { slugify } from "../format";
import type { Listing, LoanOfficer } from "../types";
import { buildMatcher, nameParts } from "./match";
import { detectionInputs } from "./roster";
import { lookupPhotos, photoSource } from "./providers";
import { createKitFromDetection } from "./run";
import { normalizeMls } from "./mls";
import { queuePhotos } from "./photo-queue";
import { isNewConstruction } from "./newConstruction";
import type { Detection, RosterAgent, SourceListing } from "./types";

/**
 * Kits a loan officer builds on demand from an MLS # (src/app/build). Uses
 * the same pipeline as detection, and records a detection so the next run
 * doesn't build the same listing again.
 */

function samePerson(a: string, b: string): boolean {
  const x = nameParts(a);
  const y = nameParts(b);
  return !!x && !!y && x.first === y.first && x.last === y.last;
}

/** This loan officer's kit for the listing, if one exists already. */
export async function existingKit(lo: LoanOfficer, l: SourceListing): Promise<Listing | null> {
  const mls = l.mlsNumber ? normalizeMls(l.mlsNumber) : null;
  const all = await listings.list();
  return (
    all.find(
      (k) =>
        k.loanOfficerSlug === lo.slug &&
        !!k.source &&
        ((k.source.provider === l.provider && k.source.id === l.id) ||
          (!!mls && !!k.source.mlsNumber && normalizeMls(k.source.mlsNumber) === mls)),
    ) ?? null
  );
}

export async function buildKitForLo(lo: LoanOfficer, source: SourceListing): Promise<Listing> {
  const existing = await existingKit(lo, source);
  if (existing) return existing;

  let listing = source;
  let photoNote: string | undefined;
  if (!listing.photos.length && photoSource()) {
    try {
      const p = (await lookupPhotos([listing])).get(listing.id);
      photoNote = p?.photos.length ? undefined : (p?.note ?? "Zillow returned nothing for this address");
      if (p)
        listing = {
          ...listing,
          photos: p.photos,
          description: listing.description ?? p.description,
          ...(p.listingUrl ? { listingUrl: p.listingUrl } : {}),
        };
    } catch (err) {
      // The kit still works without photos; the agent can add them on the kit page,
      // and the photo queue keeps looking (below).
      console.error("Photo lookup failed", err);
      photoNote = "The Zillow lookup didn't finish; retrying";
    }
  }

  // The roster may know the agent's headshot, phone or email.
  const { roster, metros } = await detectionInputs();
  const match = roster.length ? buildMatcher(roster, metros)(listing) : null;
  const ownAgent = match && samePerson(match.agent.loanOfficer, lo.name) ? match.agent : null;
  const rosterAgent: RosterAgent = ownAgent ?? {
    name: listing.agent.name,
    loanOfficer: lo.name,
    brokerage: listing.office?.name,
  };

  const now = new Date().toISOString();
  const det: Detection = {
    slug: slugify(`${listing.provider}-${listing.id}`),
    status: "created",
    confidence: 1,
    reason: `Built by ${lo.name} from ${listing.mlsNumber ? `MLS #${listing.mlsNumber}` : listing.address}`,
    rosterAgent,
    loanOfficerName: lo.name,
    loanOfficerSlug: lo.slug,
    listing,
    // The loan officer is looking at the kit already, so it stays out of the email digest.
    emailedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  // A loan officer builds a kit by hand when the home has been on the market a while,
  // so it isn't "Just Listed". Detected kits from the automatic runs keep "Just Listed".
  const kit = await createKitFromDetection(det, lo, listing.builder || isNewConstruction(listing) ? "new-construction" : "featured");

  // Mark the listing handled for detection, unless it belongs to another loan officer's agent
  // (they should still get their own kit) or someone already decided on it.
  const prior = await detections.get(det.slug);
  const otherLo = match && !ownAgent && !prior;
  const priorOpen = prior && prior.status !== "created" && prior.status !== "dismissed" && samePerson(prior.loanOfficerName, lo.name);
  if ((!prior && !otherLo) || priorOpen) {
    await detections.save({
      ...(prior ?? det),
      ...det,
      createdAt: prior?.createdAt ?? now,
      listingSlug: kit.slug,
      // The first lookup counts as a try, so the next one writes the address differently.
      ...(photoNote ? { photoNote, photoTries: 1, photoCheckedAt: now } : {}),
    });
    // No photos yet: keep looking in the background, the same way detected kits do.
    if (!listing.photos.length && photoSource()) await queuePhotos([det.slug]);
  }

  return kit;
}
