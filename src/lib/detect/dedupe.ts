import { normalizeMls } from "./mls";
import { streetWords, UNIT_WORDS } from "./providers/zillow-photos";
import type { Detection, SourceListing } from "./types";

/**
 * The listings feed (RentCast) can return one home as two records with
 * different ids: e.g. a duplex as "6335 Dudley St Unit 6339" one week and
 * "6335 Dudley St" the next. Detections are keyed by provider id, so without
 * this check the same home got a second kit and a second email to the LO.
 */

/** Street suffixes as the USPS abbreviates them, so "Place" and "Pl" match. */
const SUFFIXES: Record<string, string> = {
  street: "st", avenue: "ave", av: "ave", road: "rd", drive: "dr", place: "pl", court: "ct", lane: "ln",
  boulevard: "blvd", circle: "cir", terrace: "ter", parkway: "pkwy", highway: "hwy", trail: "trl",
  way: "way", square: "sq", point: "pt", crossing: "xing", cove: "cv", loop: "loop", path: "path",
};

/** "6335 Dudley St Unit 6339" → { street: "6335 dudley st", unit: "6339" } (directions shortened, zip appended). */
export function homeAddress(l: Pick<SourceListing, "address" | "unit" | "zip">): { street: string; unit?: string } {
  const w = streetWords(l.address);
  const cut = w.findIndex((x, i) => i > 0 && UNIT_WORDS.has(x));
  const base = (cut > 0 ? w.slice(0, cut) : w).map((x, i) => (i > 0 ? (SUFFIXES[x] ?? x) : x));
  const inLine = cut > 0 ? w.slice(cut + 1).join(" ") : "";
  const unit = (l.unit ? streetWords(l.unit).filter((x) => !UNIT_WORDS.has(x)).join(" ") : "") || inLine;
  return { street: `${base.join(" ")} ${(l.zip ?? "").slice(0, 5)}`.trim(), unit: unit || undefined };
}

/**
 * Is `b` the same home for sale as `a`? Yes when the MLS numbers match, or
 * when the street address and zip match (ignoring a unit only one side has)
 * and so does the price. Two condos in one building have different units, so
 * they never count as the same home.
 */
export function sameHome(a: SourceListing, b: SourceListing): boolean {
  if (a.provider === b.provider && a.id === b.id) return true;
  if (a.mlsNumber && b.mlsNumber && normalizeMls(a.mlsNumber) === normalizeMls(b.mlsNumber)) return true;
  const x = homeAddress(a);
  const y = homeAddress(b);
  if (!x.street || x.street !== y.street) return false;
  if (x.unit && y.unit && x.unit !== y.unit) return false;
  return a.price === b.price;
}

/** The first detection in `pool` for the same home as `l`, if any. */
export function findSameHome(l: SourceListing, pool: Iterable<Detection>): Detection | undefined {
  for (const d of pool) if (sameHome(d.listing, l)) return d;
  return undefined;
}

/** Groups of two or more detections that are the same home, oldest first in each group. */
export function duplicateGroups(all: Detection[]): Detection[][] {
  const sorted = [...all].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const groups: Detection[][] = [];
  for (const d of sorted) {
    const g = groups.find((grp) => grp.some((x) => sameHome(x.listing, d.listing)));
    if (g) g.push(d);
    else groups.push([d]);
  }
  return groups.filter((g) => g.length > 1);
}
