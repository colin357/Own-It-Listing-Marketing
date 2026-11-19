import "server-only";
import sampleListing from "../../data/listings/123-maple-ridge-dr-austin-tx.json";
import sampleLo from "../../data/loan-officers/jordan-avery.json";
import { applyRates, currentMarketRates } from "./rates";
import type { Listing, LoanOfficer } from "./types";

/**
 * The demo listing and loan officer bundled in /data, used for the sample
 * graphics on the landing page. Always read from the bundle, so it works the
 * same in production (where kits live in Redis) as locally.
 */
export async function sampleKit(): Promise<{ listing: Listing; lo: LoanOfficer }> {
  // These are rendered at build time, so a database outage (or Upstash's
  // monthly request cap, Nov 19, 2026) must not fail the deploy: fall back
  // to the bundled rate instead.
  const rates = await currentMarketRates().catch((err) => {
    console.error("Sample graphics: market rates unavailable, using the bundled rate", err);
    return null;
  });
  // National averages when we have them; the bundled default rate otherwise, so the payment flyers never come out blank.
  const lo = { ...(sampleLo as LoanOfficer), ...(rates ? { payment: undefined } : {}) };
  // No open house (its date would go stale) and current rates.
  const listing = { ...(sampleListing as unknown as Listing), openHouse: undefined, financing: undefined };
  return { listing: applyRates(listing, lo, rates), lo };
}
