import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { milesBetween } from "../match";
import type { ListingProvider, SourceListing } from "../types";

/**
 * Local testing without a data subscription: serves listings from
 * data/mock-listings.json (same shape as SourceListing). Enable with
 * LISTINGS_PROVIDER=mock.
 */
export function mockProvider(): ListingProvider {
  return {
    name: "mock",
    async fetchNewListings(metro) {
      let all: SourceListing[] = [];
      try {
        all = JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "mock-listings.json"), "utf8"));
      } catch {
        return { listings: [], requests: 1 };
      }
      const listings = all
        .map((l) => ({ ...l, provider: "mock", photos: l.photos ?? [] }))
        .filter(
          (l) =>
            l.latitude == null ||
            l.longitude == null ||
            milesBetween(metro.latitude, metro.longitude, l.latitude, l.longitude) <= metro.radiusMiles,
        );
      return { listings, requests: 1 };
    },
  };
}
