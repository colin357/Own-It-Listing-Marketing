import type { Listing, LoanOfficer } from "./types";
import { formatPrice } from "./format";

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

export interface Scenario {
  id: string;
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
}

export interface PaymentOptions {
  scenarios: Scenario[];
  annualTaxes: number;
  annualInsurance: number;
  taxesEstimated: boolean;
  insuranceEstimated: boolean;
  disclaimer: string;
}

export function principalAndInterest(loan: number, ratePct: number, years = TERM_YEARS): number {
  const r = ratePct / 100 / 12;
  const n = years * 12;
  return r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
}

export function estimateAnnualTaxes(price: number, state: string): number {
  return (price * (PROPERTY_TAX_PCT[state.toUpperCase()] ?? DEFAULT_TAX_PCT)) / 100;
}

export function estimateAnnualInsurance(price: number, state: string): number {
  const per300k = INSURANCE_PER_300K[state.toUpperCase()] ?? DEFAULT_INSURANCE_PER_300K;
  return (per300k * price * DWELLING_SHARE) / 300_000;
}

/** Returns the three PITI scenarios, or null when there's no rate or payments are hidden. */
export function paymentOptions(l: Listing, lo: LoanOfficer): PaymentOptions | null {
  const f = l.financing;
  const ratePct = f?.ratePct ?? lo.payment?.ratePct;
  if (ratePct == null || !l.showPayment) return null;

  const fhaRatePct = f?.fhaRatePct ?? ratePct;
  const annualTaxes = f?.annualTaxes ?? estimateAnnualTaxes(l.price, l.state);
  const annualInsurance = f?.annualInsurance ?? estimateAnnualInsurance(l.price, l.state);
  const taxes = annualTaxes / 12;
  const insurance = annualInsurance / 12;
  const hoa = f?.hoaMonthly ?? 0;

  const conventional = (id: string, downPct: number): Scenario => {
    const downPayment = l.price * (downPct / 100);
    const loanAmount = l.price - downPayment;
    const principalInterest = principalAndInterest(loanAmount, ratePct);
    const mortgageInsurance = downPct < 20 ? (loanAmount * CONV_PMI_PCT) / 100 / 12 : 0;
    return {
      id,
      name: "Conventional",
      detail: `${downPct}% down`,
      downPct,
      downPayment,
      loanAmount,
      ratePct,
      aprPct: f?.aprPct,
      principalInterest,
      taxes,
      insurance,
      mortgageInsurance,
      miLabel: "PMI",
      hoa,
      total: principalInterest + taxes + insurance + mortgageInsurance + hoa,
    };
  };

  const fha = (): Scenario => {
    const downPct = 3.5;
    const downPayment = l.price * (downPct / 100);
    const baseLoan = l.price - downPayment;
    const loanAmount = baseLoan * (1 + FHA_UFMIP_PCT / 100);
    const principalInterest = principalAndInterest(loanAmount, fhaRatePct);
    const mipPct = baseLoan > FHA_HIGH_BALANCE ? FHA_ANNUAL_MIP_HIGH_PCT : FHA_ANNUAL_MIP_PCT;
    const mortgageInsurance = (baseLoan * mipPct) / 100 / 12;
    return {
      id: "fha",
      name: "FHA",
      detail: "3.5% down",
      downPct,
      downPayment,
      loanAmount,
      ratePct: fhaRatePct,
      aprPct: f?.fhaAprPct,
      principalInterest,
      taxes,
      insurance,
      mortgageInsurance,
      miLabel: "MIP",
      hoa,
      total: principalInterest + taxes + insurance + mortgageInsurance + hoa,
    };
  };

  const scenarios = [conventional("conv-low", 5), conventional("conv-20", 20), fha()];
  const taxesEstimated = f?.annualTaxes == null;
  const insuranceEstimated = f?.annualInsurance == null;

  const rateText = scenarios
    .map((s) => `${s.name} ${s.detail}: ${s.ratePct}% rate${s.aprPct ? ` (${s.aprPct}% APR)` : ""}, ${formatPrice(s.downPayment)} down, ${formatPrice(s.loanAmount)} loan`)
    .join("; ");
  const disclaimer = [
    `Payments are estimates for illustration only, based on a ${formatPrice(l.price)} purchase price and ${TERM_YEARS}-year fixed terms. ${rateText}.`,
    `Payments include principal, interest, ${taxesEstimated ? "estimated " : ""}property taxes of ${formatPrice(annualTaxes)}/yr, ${insuranceEstimated ? "estimated " : ""}homeowners insurance of ${formatPrice(annualInsurance)}/yr${hoa ? `, HOA dues of ${formatPrice(hoa)}/mo` : ""} and mortgage insurance where applicable.`,
    `FHA includes a ${FHA_UFMIP_PCT}% upfront MIP financed into the loan and annual MIP; FHA loans are subject to county loan limits.`,
    `Actual rates, payments and mortgage insurance vary based on credit, loan amount, occupancy and other factors. Rates subject to change without notice. Not a commitment to lend. Subject to credit approval.`,
  ].join(" ");

  return { scenarios, annualTaxes, annualInsurance, taxesEstimated, insuranceEstimated, disclaimer };
}
