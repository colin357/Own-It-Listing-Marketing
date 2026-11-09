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
  const rates = await currentMarketRates();
  // National averages when we have them; the bundled default rate otherwise, so the payment flyers never come out blank.
  const lo = { ...(sampleLo as LoanOfficer), ...(rates ? { payment: undefined } : {}) };
  // No open house (its date would go stale) and current rates.
  const listing = { ...(sampleListing as unknown as Listing), openHouse: undefined, financing: undefined };
  return { listing: applyRates(listing, lo, rates), lo };
}
