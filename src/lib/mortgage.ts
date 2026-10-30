import type { Listing, LoanOfficer } from "./types";
import { formatPrice } from "./format";
import { principalAndInterest } from "./amortize";
import {
  activeConcession,
  CLOSING_COST_PCT,
  concessionDisclaimer,
  concessionEffect,
  type ConcessionEffect,
  type Program as LoanProgram,
} from "./concessions";

export { principalAndInterest };

/**
 * PITI scenarios for the payment-options flyer.
 *
 * Everything here is an estimate for marketing purposes. Taxes and insurance
 * use the listing's actual figures when the webhook sends them, otherwise
 * state averages below. Assumptions are centralized as constants so a
 * compliance or capital-markets team can tune them in one place.
 */

/** Approximate effective property-tax rate (% of value per year), by state. */
const PROPERTY_TAX_PCT: Record<string, number> = {
  AL: 0.38, AK: 1.04, AZ: 0.52, AR: 0.57, CA: 0.71, CO: 0.49, CT: 1.48, DE: 0.53, DC: 0.57, FL: 0.8,
  GA: 0.81, HI: 0.27, ID: 0.56, IL: 1.95, IN: 0.75, IA: 1.43, KS: 1.29, KY: 0.8, LA: 0.53, ME: 1.1,
  MD: 0.98, MA: 1.04, MI: 1.24, MN: 1.02, MS: 0.67, MO: 0.91, MT: 0.67, NE: 1.5, NV: 0.5, NH: 1.61,
  NJ: 2.08, NM: 0.67, NY: 1.36, NC: 0.7, ND: 0.92, OH: 1.36, OK: 0.82, OR: 0.86, PA: 1.41, RI: 1.3,
  SC: 0.53, SD: 1.07, TN: 0.56, TX: 1.47, UT: 0.52, VT: 1.7, VA: 0.8, WA: 0.84, WV: 0.55, WI: 1.51,
  WY: 0.54,
};
const DEFAULT_TAX_PCT = 1.0;

/**
 * Approximate average annual homeowners premium for $300k of dwelling
 * coverage, by state. Scaled by dwelling coverage (assumed 80% of price,
 * since land isn't insured).
 */
const INSURANCE_PER_300K: Record<string, number> = {
  AL: 3000, AK: 1200, AZ: 2100, AR: 3700, CA: 1800, CO: 3800, CT: 2000, DE: 1000, DC: 1500, FL: 5000,
  GA: 2400, HI: 600, ID: 1300, IL: 2300, IN: 2000, IA: 2400, KS: 4400, KY: 2800, LA: 4000, ME: 1400,
  MD: 1700, MA: 1800, MI: 2000, MN: 2800, MS: 3300, MO: 2900, MT: 2800, NE: 5100, NV: 1100, NH: 1200,
  NJ: 1300, NM: 2100, NY: 1600, NC: 2200, ND: 2600, OH: 1500, OK: 5800, OR: 1100, PA: 1300, RI: 2100,
  SC: 2300, SD: 3600, TN: 2500, TX: 4000, UT: 1200, VT: 1000, VA: 1500, WA: 1500, WV: 1400, WI: 1500,
  WY: 1900,
};
const DEFAULT_INSURANCE_PER_300K = 2400;
const DWELLING_SHARE = 0.8;

const TERM_YEARS = 30;
/** Conventional PMI, annual % of loan, for a 95% LTV borrower with good credit. */
const CONV_PMI_PCT = 0.55;
/** FHA: 1.75% upfront MIP financed into the loan, 0.55% annual MIP (30-yr, LTV > 95%). */
const FHA_UFMIP_PCT = 1.75;
const FHA_ANNUAL_MIP_PCT = 0.55;
/** FHA annual MIP above the high-balance threshold. */
const FHA_ANNUAL_MIP_HIGH_PCT = 0.75;
const FHA_HIGH_BALANCE = 726_200;
/** VA funding fee, first use, under 5% down. Financed into the loan; no monthly mortgage insurance. */
const VA_FUNDING_FEE_PCT = 2.15;
/** Lender fees (origination, points, etc.) assumed when estimating an APR from a published rate. */
export const APR_FEES_PCT = 1;

/**
 * Qualification rules of thumb per program, used for the "what it takes"
 * flyer. maxDti is a debt-to-income ratio lenders commonly approve through
 * automated underwriting, kept below each program's ceiling so the income
 * shown is realistic rather than a best case:
 * - Conventional: Fannie Mae DU / Freddie Mac LPA allow up to 50%; 45% is the
 *   manual-underwriting limit and a safe everyday figure.
 * - FHA: automated approvals go up to about 56.9%; 50% is the manual limit
 *   with compensating factors.
 * - VA: no maximum. 41% is only a benchmark above which the lender documents
 *   residual income, and approvals at 50% or more are routine, so using 41%
 *   made VA buyers look like they need more income than conventional buyers.
 */
export const GUIDELINES: Record<string, { minCredit: number; maxDti: number; bestFor: string }> = {
  "conv-low": { minCredit: 620, maxDti: 45, bestFor: "Good credit and some savings" },
  "conv-20": { minCredit: 620, maxDti: 45, bestFor: "No mortgage insurance, lowest payment" },
  fha: { minCredit: 580, maxDti: 50, bestFor: "Lower credit scores and smaller savings" },
  va: { minCredit: 620, maxDti: 50, bestFor: "Eligible veterans and service members" },
};

export interface Scenario {
  id: string;
  program: LoanProgram;
  name: string;
  detail: string;
  downPct: number;
  downPayment: number;
  loanAmount: number;
  ratePct: number;
  aprPct?: number;
  principalInterest: number;
  taxes: number;
  insurance: number;
  mortgageInsurance: number;
  miLabel: string;
  hoa: number;
  total: number;
  /** Estimated down payment plus closing costs. */
  cashToClose: number;
  /** The seller concession applied to this scenario, when the listing has one. */
  concession?: ConcessionEffect;
}

export interface PaymentOptions {
  scenarios: Scenario[];
  annualTaxes: number;
  annualInsurance: number;
  taxesEstimated: boolean;
  insuranceEstimated: boolean;
  disclaimer: string;
}

export function estimateAnnualTaxes(price: number, state: string): number {
  return (price * (PROPERTY_TAX_PCT[state.toUpperCase()] ?? DEFAULT_TAX_PCT)) / 100;
}

export function estimateAnnualInsurance(price: number, state: string): number {
  const per300k = INSURANCE_PER_300K[state.toUpperCase()] ?? DEFAULT_INSURANCE_PER_300K;
  return (per300k * price * DWELLING_SHARE) / 300_000;
}

function presentValue(payment: number, monthlyRate: number, n = TERM_YEARS * 12): number {
  return monthlyRate === 0 ? payment * n : (payment * (1 - Math.pow(1 + monthlyRate, -n))) / monthlyRate;
}

/**
 * Estimated APR for a 30-year fixed loan at `ratePct`: the rate at which the
 * payments (including FHA annual MIP) repay the amount financed, after lender
 * fees of APR_FEES_PCT and FHA upfront MIP / VA funding fee. Conventional
 * assumes 20% down (no PMI). Scale-free, so any loan amount gives the same APR.
 */
export function estimateApr(program: "conventional" | "fha" | "va", ratePct: number): number {
  const base = 100_000;
  const note = program === "fha" ? base * (1 + FHA_UFMIP_PCT / 100) : program === "va" ? base * (1 + VA_FUNDING_FEE_PCT / 100) : base;
  const mi = program === "fha" ? (base * FHA_ANNUAL_MIP_PCT) / 100 / 12 : 0;
  const payment = principalAndInterest(note, ratePct) + mi;
  const financed = base * (1 - APR_FEES_PCT / 100);
  let lo = 0;
  let hi = 0.05;
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    if (presentValue(payment, mid) > financed) lo = mid;
    else hi = mid;
  }
  return Math.round(lo * 12 * 100 * 1000) / 1000;
}

interface Inputs {
  price: number;
  ratePct: number;
  aprPct?: number;
  fhaRatePct: number;
  fhaAprPct?: number;
  vaRatePct: number;
  vaAprPct?: number;
  taxes: number;
  insurance: number;
  hoa: number;
  rateNote?: string;
}

function inputs(l: Listing, lo: LoanOfficer) {
  const f = l.financing;
  const ratePct = f?.ratePct ?? lo.payment?.ratePct;
  if (ratePct == null || !l.showPayment) return null;
  const fromListing = f?.ratePct != null;
  const annualTaxes = f?.annualTaxes ?? estimateAnnualTaxes(l.price, l.state);
  const annualInsurance = f?.annualInsurance ?? estimateAnnualInsurance(l.price, l.state);
  // The loan officer's default rate carries its own APR.
  const aprPct = fromListing ? f?.aprPct : lo.payment?.aprPct;
  // A program without its own rate borrows the next one's rate, and its APR with it,
  // so a rate is never shown without an APR (Reg Z).
  const fhaRatePct = f?.fhaRatePct ?? ratePct;
  const fhaAprPct = f?.fhaRatePct != null ? f.fhaAprPct : aprPct;
  const i: Inputs = {
    price: l.price,
    ratePct,
    aprPct,
    fhaRatePct,
    fhaAprPct,
    vaRatePct: f?.vaRatePct ?? fhaRatePct,
    vaAprPct: f?.vaRatePct != null ? f.vaAprPct : fhaAprPct,
    taxes: annualTaxes / 12,
    insurance: annualInsurance / 12,
    hoa: f?.hoaMonthly ?? 0,
    rateNote: fromListing ? f?.rateNote : undefined,
  };
  return { i, annualTaxes, annualInsurance, taxesEstimated: f?.annualTaxes == null, insuranceEstimated: f?.annualInsurance == null };
}

function conventional(i: Inputs, id: string, downPct: number): Scenario {
  const downPayment = i.price * (downPct / 100);
  const loanAmount = i.price - downPayment;
  const principalInterest = principalAndInterest(loanAmount, i.ratePct);
  const mortgageInsurance = downPct < 20 ? (loanAmount * CONV_PMI_PCT) / 100 / 12 : 0;
  return {
    id,
    program: "conventional",
    name: "Conventional",
    detail: `${downPct}% down`,
    downPct,
    downPayment,
    loanAmount,
    ratePct: i.ratePct,
    aprPct: i.aprPct,
    principalInterest,
    taxes: i.taxes,
    insurance: i.insurance,
    mortgageInsurance,
    miLabel: "PMI",
    hoa: i.hoa,
    total: principalInterest + i.taxes + i.insurance + mortgageInsurance + i.hoa,
    cashToClose: downPayment + (i.price * CLOSING_COST_PCT) / 100,
  };
}

function fha(i: Inputs): Scenario {
  const downPct = 3.5;
  const downPayment = i.price * (downPct / 100);
  const baseLoan = i.price - downPayment;
  const loanAmount = baseLoan * (1 + FHA_UFMIP_PCT / 100);
  const principalInterest = principalAndInterest(loanAmount, i.fhaRatePct);
  const mipPct = baseLoan > FHA_HIGH_BALANCE ? FHA_ANNUAL_MIP_HIGH_PCT : FHA_ANNUAL_MIP_PCT;
  const mortgageInsurance = (baseLoan * mipPct) / 100 / 12;
  return {
    id: "fha",
    program: "fha",
    name: "FHA",
    detail: "3.5% down",
    downPct,
    downPayment,
    loanAmount,
    ratePct: i.fhaRatePct,
    aprPct: i.fhaAprPct,
    principalInterest,
    taxes: i.taxes,
    insurance: i.insurance,
    mortgageInsurance,
    miLabel: "MIP",
    hoa: i.hoa,
    total: principalInterest + i.taxes + i.insurance + mortgageInsurance + i.hoa,
    cashToClose: downPayment + (i.price * CLOSING_COST_PCT) / 100,
  };
}

function va(i: Inputs): Scenario {
  const loanAmount = i.price * (1 + VA_FUNDING_FEE_PCT / 100);
  const principalInterest = principalAndInterest(loanAmount, i.vaRatePct);
  return {
    id: "va",
    program: "va",
    name: "VA",
    detail: "0% down",
    downPct: 0,
    downPayment: 0,
    loanAmount,
    ratePct: i.vaRatePct,
    aprPct: i.vaAprPct,
    principalInterest,
    taxes: i.taxes,
    insurance: i.insurance,
    mortgageInsurance: 0,
    miLabel: "None",
    hoa: i.hoa,
    total: principalInterest + i.taxes + i.insurance + i.hoa,
    cashToClose: (i.price * CLOSING_COST_PCT) / 100,
  };
}

function buildDisclaimer(
  l: Listing,
  scenarios: Scenario[],
  x: NonNullable<ReturnType<typeof inputs>>,
  extra: string[] = [],
): string {
  const rateText = scenarios
    .map((s) => `${s.name} ${s.detail}: ${s.ratePct}% rate${s.aprPct ? ` (${s.aprPct}% APR)` : ""}, ${formatPrice(s.downPayment)} down, ${formatPrice(Math.round(s.loanAmount))} loan`)
    .join("; ");
  const hasFha = scenarios.some((s) => s.id === "fha");
  const hasVa = scenarios.some((s) => s.id === "va");
  return [
    `Payments are estimates for illustration only, based on a ${formatPrice(l.price)} purchase price and ${TERM_YEARS}-year fixed terms. ${rateText}.`,
    `Payments include principal, interest, ${x.taxesEstimated ? "estimated " : ""}property taxes of ${formatPrice(Math.round(x.annualTaxes))}/yr, ${x.insuranceEstimated ? "estimated " : ""}homeowners insurance of ${formatPrice(Math.round(x.annualInsurance))}/yr${x.i.hoa ? `, HOA dues of ${formatPrice(x.i.hoa)}/mo` : ""} and mortgage insurance where applicable.`,
    hasFha ? `FHA includes a ${FHA_UFMIP_PCT}% upfront MIP financed into the loan and annual MIP; FHA loans are subject to county loan limits.` : "",
    hasVa ? `VA assumes first-time use with the ${VA_FUNDING_FEE_PCT}% funding fee financed; eligibility required.` : "",
    x.i.rateNote ?? "",
    activeConcession(l) ? concessionDisclaimer(activeConcession(l)!) : "",
    ...extra,
    `Actual rates, payments and mortgage insurance vary based on credit, loan amount, occupancy and other factors. Rates subject to change without notice. Not a commitment to lend. Subject to credit approval.`,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Applies the listing's seller concession: a permanent buydown lowers the
 * rate and payment, leftover credit lowers cash to close. Temporary buydowns
 * keep the note-rate payment (what the buyer qualifies at) and add a schedule.
 */
function withConcession<T extends Scenario>(l: Listing, s: T): T {
  const c = activeConcession(l);
  if (!c) return s;
  const e = concessionEffect(s, l.price, c);
  return { ...s, ratePct: e.ratePct, aprPct: e.aprPct, principalInterest: e.principalInterest, total: e.total, cashToClose: e.cashToClose, concession: e };
}

/** Returns the three PITI scenarios, or null when there's no rate or payments are hidden. */
export function paymentOptions(l: Listing, lo: LoanOfficer): PaymentOptions | null {
  const x = inputs(l, lo);
  if (!x) return null;
  const scenarios = [conventional(x.i, "conv-low", 5), conventional(x.i, "conv-20", 20), fha(x.i)].map((s) => withConcession(l, s));
  return {
    scenarios,
    annualTaxes: x.annualTaxes,
    annualInsurance: x.annualInsurance,
    taxesEstimated: x.taxesEstimated,
    insuranceEstimated: x.insuranceEstimated,
    disclaimer: buildDisclaimer(l, scenarios, x),
  };
}

export interface Program extends Scenario {
  minCredit: number;
  maxDti: number;
  bestFor: string;
  /** Gross household income needed at the guideline DTI, with no other debts. */
  incomeNeeded: number;
}

export interface ProgramOptions extends PaymentOptions {
  scenarios: Program[];
  /** Extra yearly income needed for every $500/mo of other debts (car, cards, student loans), at the strictest DTI shown. */
  incomePer500Debt: number;
  /** The disclaimer without the qualification notes, for flyers that only show payments. */
  paymentDisclaimer: string;
  /** What "cash to close" and the credit scores mean, for flyers that use paymentDisclaimer. */
  cashNote: string;
}

/** Four loan programs (incl. VA) with cash to close and qualification rules of thumb. */
export function programOptions(l: Listing, lo: LoanOfficer): ProgramOptions | null {
  const x = inputs(l, lo);
  if (!x) return null;
  const scenarios: Program[] = [conventional(x.i, "conv-low", 5), conventional(x.i, "conv-20", 20), fha(x.i), va(x.i)].map((base) => {
    const s = withConcession(l, base);
    const g = GUIDELINES[s.id];
    return { ...s, ...g, incomeNeeded: (s.total * 12) / (g.maxDti / 100) };
  });
  // Group programs sharing a ratio: "45% for Conventional and 50% for FHA and VA".
  const byDti = new Map<number, string[]>();
  for (const s of scenarios) {
    const names = byDti.get(s.maxDti) ?? [];
    if (!names.includes(s.name)) names.push(s.name);
    byDti.set(s.maxDti, names);
  }
  const ratios = [...byDti].map(([dti, names]) => `${dti}% for ${names.join(" and ")}`).join(" and ");
  const dtiNote = `Income needed is gross household income at a debt-to-income ratio of ${ratios}, assuming no other monthly debts; VA also requires residual income. Credit scores are typical minimums; requirements vary by lender and borrower. Cash to close includes the down payment and estimated closing costs and prepaids of ${CLOSING_COST_PCT}% of the price.`;
  return {
    scenarios,
    annualTaxes: x.annualTaxes,
    annualInsurance: x.annualInsurance,
    taxesEstimated: x.taxesEstimated,
    insuranceEstimated: x.insuranceEstimated,
    incomePer500Debt: (500 * 12) / (Math.min(...scenarios.map((s) => s.maxDti)) / 100),
    disclaimer: buildDisclaimer(l, scenarios, x, [dtiNote]),
    paymentDisclaimer: buildDisclaimer(l, scenarios, x),
    cashNote: `Cash to close includes the down payment and estimated closing costs and prepaids of ${CLOSING_COST_PCT}% of the price. Credit scores are typical minimums.`,
  };
}
