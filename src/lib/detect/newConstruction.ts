import type { SourceListing } from "./types";

/**
 * New construction: RentCast says so, or the home is built this year or
 * next. These are often listed by the builder with no listing agent.
 */
export function isNewConstruction(l: Pick<SourceListing, "listingType" | "yearBuilt">, now = new Date()): boolean {
  if (l.listingType?.toLowerCase() === "new construction") return true;
  return !!l.yearBuilt && l.yearBuilt >= now.getFullYear();
}
