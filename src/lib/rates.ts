import "server-only";
import { documents } from "./store";
import { APR_FEES_PCT, estimateApr } from "./mortgage";
import type { Financing, Listing, LoanOfficer } from "./types";

/**
 * National average 30-year fixed rates, refreshed on every detection run.
 * Source: Optimal Blue Mortgage Market Indices published on FRED (daily,
 * free, no key), with Freddie Mac's weekly survey as a conventional fallback.
 * The sources publish rates only, so APRs are estimated (see estimateApr).
 */

export interface MarketRate {
  ratePct: number;
  aprPct: number;
}

export interface MarketRates {
  /** Date the source published the rate (YYYY-MM-DD). */
  asOf: string;
  fetchedAt: string;
  source: string;
  conventional: MarketRate;
  fha: MarketRate;
  va: MarketRate;
}

const FRED = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=";
const SERIES = { conventional: "OBMMIC30YF", fha: "OBMMIFHA30YF", va: "OBMMIVA30YF" } as const;
/** Freddie Mac PMMS 30-yr fixed (weekly), used if the conventional index is unavailable. */
const FALLBACK_CONVENTIONAL = "MORTGAGE30US";

/** Latest non-empty observation from a FRED CSV ("date,value" rows; "." means missing). */
async function latest(series: string): Promise<{ date: string; value: number }> {
  const res = await fetch(FRED + series, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`FRED ${series}: HTTP ${res.status}`);
  const rows = (await res.text()).trim().split(/\r?\n/).slice(1).reverse();
  for (const row of rows) {
    const [date, raw] = row.split(",");
    const value = Number(raw);
    if (date && raw && raw !== "." && Number.isFinite(value) && value > 0) return { date, value };
  }
  throw new Error(`FRED ${series}: no data`);
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export async function fetchMarketRates(): Promise<MarketRates> {
  const [conv, fha, va] = await Promise.allSettled([latest(SERIES.conventional), latest(SERIES.fha), latest(SERIES.va)]);
  let source = "Optimal Blue Mortgage Market Indices (FRED)";
  let c = conv.status === "fulfilled" ? conv.value : null;
  if (!c) {
    c = await latest(FALLBACK_CONVENTIONAL);
    source = "Freddie Mac Primary Mortgage Market Survey (FRED)";
  }
  // FHA and VA fall back to the conventional rate rather than disappearing.
  const f = fha.status === "fulfilled" ? fha.value : c;
  const v = va.status === "fulfilled" ? va.value : f;
  return {
    asOf: c.date,
    fetchedAt: new Date().toISOString(),
    source,
    conventional: { ratePct: round3(c.value), aprPct: estimateApr("conventional", c.value) },
    fha: { ratePct: round3(f.value), aprPct: estimateApr("fha", f.value) },
    va: { ratePct: round3(v.value), aprPct: estimateApr("va", v.value) },
  };
}

export async function getMarketRates(): Promise<MarketRates | null> {
  return documents.get<MarketRates>("market-rates");
}

/**
 * Stored rates, fetched on the spot when there are none yet or the daily run
 * hasn't refreshed them in two days. Falls back to whatever is stored.
 */
export async function currentMarketRates(): Promise<MarketRates | null> {
  const stored = await getMarketRates();
  if (stored && Date.now() - Date.parse(stored.fetchedAt) < 2 * 86_400_000) return stored;
  try {
    return await refreshMarketRates();
  } catch (err) {
    console.error("Market rate refresh failed", err);
    return stored;
  }
}

/** Fetches and stores today's rates. Keeps the previous rates if the fetch fails. */
export async function refreshMarketRates(): Promise<MarketRates> {
  const rates = await fetchMarketRates();
  await documents.set("market-rates", rates);
  return rates;
}

function formatAsOf(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/**
 * The listing as the kit should show it: national average rates fill in when
 * neither the listing nor the loan officer has its own rate, and payments are
 * hidden for loan officers who opted out.
 */
export function applyRates(l: Listing, lo: LoanOfficer, rates: MarketRates | null): Listing {
  if (lo.showPayments === false) return { ...l, showPayment: false };
  if (l.financing?.ratePct != null || lo.payment?.ratePct != null || !rates) return l;
  const financing: Financing = {
    ...l.financing,
    ratePct: rates.conventional.ratePct,
    aprPct: rates.conventional.aprPct,
    fhaRatePct: rates.fha.ratePct,
    fhaAprPct: rates.fha.aprPct,
    vaRatePct: rates.va.ratePct,
    vaAprPct: rates.va.aprPct,
    rateNote: `Rates are national averages for 30-year fixed loans as of ${formatAsOf(rates.asOf)}; APRs are estimates assuming lender fees of ${APR_FEES_PCT}% of the loan, plus FHA upfront and annual mortgage insurance or the VA funding fee. Your rate and APR will differ.`,
  };
  return { ...l, financing };
}
