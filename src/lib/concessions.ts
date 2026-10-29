import type { BuydownType, Concession, Listing } from "./types";
import { principalAndInterest } from "./amortize";

/**
 * Seller concessions: the credit a seller offers toward the buyer's costs,
 * used for a temporary or permanent rate buydown or for closing costs.
 *
 * Pure math with no server imports, so the kit page calculator runs the same
 * code in the browser that the graphics and flyers use on the server.
 */

export type Program = "conventional" | "fha" | "va";

/** Buyer closing costs + prepaids, as % of price, for "cash to close" estimates. */
export const CLOSING_COST_PCT = 3;
/** Rule of thumb: one discount point (1% of the loan) lowers the rate about 0.25%. */
export const RATE_CUT_PER_POINT = 0.25;
/** Most discount points a permanent buydown will buy (the QM points-and-fees cap is 3%). */
export const MAX_POINTS = 3;
/** Rates are priced in eighths. */
const RATE_STEP = 0.125;
/** No loan type allows more than this (Conventional with 25%+ down). */
export const MAX_CONCESSION_PCT = 9;

export const BUYDOWNS: Record<BuydownType, { label: string; steps?: number[]; blurb: string }> = {
  "2-1": { label: "2-1 buydown", steps: [2, 1], blurb: "Rate 2% lower in year 1 and 1% lower in year 2" },
  "1-0": { label: "1-0 buydown", steps: [1], blurb: "Rate 1% lower for the first year" },
  "3-2-1": { label: "3-2-1 buydown", steps: [3, 2, 1], blurb: "Rate 3%, 2% and 1% lower over the first three years" },
  permanent: { label: "Permanent buydown", blurb: "Discount points lower the rate for the life of the loan" },
  "closing-costs": { label: "Closing cost credit", blurb: "Lowers the cash buyers need to close" },
};

export function isTemporary(type: BuydownType): boolean {
  return !!BUYDOWNS[type].steps;
}

/**
 * Seller concession limits by loan type (Fannie Mae / Freddie Mac, FHA, VA,
 * USDA). Percentages are of the price, except VA, which is 4% of the loan and
 * excludes the buyer's normal closing costs.
 */
export interface LimitRule {
  id: string;
  loan: string;
  when: string;
  pct: number;
  of: "price" | "loan";
}

export const LIMIT_RULES: LimitRule[] = [
  { id: "conv-under-10", loan: "Conventional", when: "Under 10% down", pct: 3, of: "price" },
  { id: "conv-10-25", loan: "Conventional", when: "10% to 24.99% down", pct: 6, of: "price" },
  { id: "conv-25", loan: "Conventional", when: "25% or more down", pct: 9, of: "price" },
  { id: "conv-investment", loan: "Conventional", when: "Investment property", pct: 2, of: "price" },
  { id: "fha", loan: "FHA", when: "Any down payment", pct: 6, of: "price" },
  { id: "va", loan: "VA", when: "Plus normal closing costs", pct: 4, of: "loan" },
  { id: "usda", loan: "USDA", when: "Primary residence", pct: 6, of: "price" },
];

const rule = (id: string) => LIMIT_RULES.find((r) => r.id === id)!;

export function limitRule(program: Program, downPct: number): LimitRule {
  if (program === "fha") return rule("fha");
  if (program === "va") return rule("va");
  return rule(downPct < 10 ? "conv-under-10" : downPct < 25 ? "conv-10-25" : "conv-25");
}

/** The rule's limit in dollars, before VA's closing-cost exclusion. */
export function limitAmount(r: LimitRule, price: number, downPct = 0): number {
  const base = r.of === "loan" ? price * (1 - downPct / 100) : price;
  return (base * r.pct) / 100;
}

/** What a scenario needs for the concession math. Matches mortgage.ts Scenario. */
export interface ScenarioBase {
  program: Program;
  downPct: number;
  loanAmount: number;
  ratePct: number;
  aprPct?: number;
  principalInterest: number;
  total: number;
  cashToClose: number;
}

export interface YearPayment {
  label: string;
  ratePct: number;
  total: number;
}

export interface ConcessionEffect extends Concession {
  rule: LimitRule;
  /** Most the seller can contribute on this loan. */
  limit: number;
  /** The amount this buyer can actually receive: the offer, capped at the limit. */
  credit: number;
  capped: boolean;
  /** Temporary buydowns: what the buydown costs on this loan. */
  buydownCost: number;
  /** Temporary buydowns: whether the credit covers the whole buydown. */
  funded: boolean;
  /** Temporary buydowns: payment by year, ending at the note rate. */
  schedule: YearPayment[];
  /** Permanent buydowns: discount points bought, as % of the loan, and the rate reduction. */
  points: number;
  rateCut: number;
  /** After a permanent buydown (otherwise the scenario's own figures). */
  ratePct: number;
  aprPct?: number;
  principalInterest: number;
  total: number;
  /** Credit left after the buydown that goes to closing costs. */
  toClosing: number;
  cashToClose: number;
  /** Credit the buyer can't use: it exceeds the buydown plus closing costs. */
  unused: number;
  /** Year 1 (temporary) or every month (permanent). */
  monthlySavings: number;
  before: { ratePct: number; aprPct?: number; total: number; cashToClose: number };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Cost of a temporary buydown: the payment difference for each discounted year. */
export function temporaryBuydownCost(s: Pick<ScenarioBase, "loanAmount" | "ratePct">, type: BuydownType): number {
  const steps = BUYDOWNS[type].steps ?? [];
  const full = principalAndInterest(s.loanAmount, s.ratePct);
  return steps.reduce((sum, step) => sum + 12 * (full - principalAndInterest(s.loanAmount, Math.max(s.ratePct - step, 0))), 0);
}

export function concessionEffect(s: ScenarioBase, price: number, c: Concession): ConcessionEffect {
  const r = limitRule(s.program, s.downPct);
  const closingCosts = (price * CLOSING_COST_PCT) / 100;
  const programLimit = limitAmount(r, price, s.downPct);
  // VA's 4% excludes normal closing costs, so those can be paid on top.
  const limit = s.program === "va" ? programLimit + closingCosts : programLimit;
  const credit = Math.max(0, Math.min(c.amount, limit));
  // Only the 4% bucket can pay for a VA buydown.
  const buydownBudget = s.program === "va" ? Math.min(credit, programLimit) : credit;
  const before = { ratePct: s.ratePct, aprPct: s.aprPct, total: s.total, cashToClose: s.cashToClose };

  let spent = 0;
  let buydownCost = 0;
  let funded = false;
  let schedule: YearPayment[] = [];
  let points = 0;
  let rateCut = 0;
  let { ratePct, aprPct, principalInterest, total } = s;

  const steps = BUYDOWNS[c.type].steps;
  if (steps) {
    buydownCost = temporaryBuydownCost(s, c.type);
    funded = buydownCost > 0 && buydownBudget >= buydownCost - 0.5;
    if (funded) {
      spent = buydownCost;
      schedule = steps.map((step, i) => {
        const rate = Math.max(s.ratePct - step, 0);
        return { label: `Year ${i + 1}`, ratePct: round3(rate), total: s.total - (s.principalInterest - principalAndInterest(s.loanAmount, rate)) };
      });
      schedule.push({ label: `Years ${steps.length + 1}–30`, ratePct: s.ratePct, total: s.total });
    }
  } else if (c.type === "permanent") {
    const affordable = Math.min((buydownBudget / s.loanAmount) * 100, MAX_POINTS);
    rateCut = Math.floor((affordable * RATE_CUT_PER_POINT) / RATE_STEP + 1e-9) * RATE_STEP;
    if (rateCut > 0) {
      points = rateCut / RATE_CUT_PER_POINT;
      spent = (points / 100) * s.loanAmount;
      ratePct = round3(s.ratePct - rateCut);
      aprPct = s.aprPct != null ? round3(s.aprPct - rateCut) : undefined;
      principalInterest = principalAndInterest(s.loanAmount, ratePct);
      total = s.total - (s.principalInterest - principalInterest);
    }
  }

  const toClosing = Math.min(credit - spent, closingCosts);
  const unused = Math.max(0, credit - spent - toClosing);
  return {
    ...c,
    rule: r,
    limit,
    credit,
    capped: c.amount > limit + 0.5,
    buydownCost,
    funded,
    schedule,
    points,
    rateCut,
    ratePct,
    aprPct,
    principalInterest,
    total,
    toClosing,
    cashToClose: s.cashToClose - toClosing,
    unused: unused < 1 ? 0 : unused,
    monthlySavings: schedule.length ? s.total - schedule[0].total : before.total - total,
    before,
  };
}

/** The listing's concession when it should appear in marketing (not once the home is under contract or sold). */
export function activeConcession(l: Listing): Concession | null {
  const c = l.concession;
  if (!c || !(c.amount > 0)) return null;
  if (l.status === "just-sold" || l.status === "under-contract") return null;
  return c;
}

const dollars = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round(n));

/** Short tag for graphics: "Seller-paid 2-1 buydown", "$10,000 toward closing costs". */
export function concessionTag(c: Concession): string {
  if (c.type === "closing-costs") return `${dollars(c.amount)} toward closing costs`;
  if (c.type === "permanent") return "Seller-paid rate buydown";
  return `Seller-paid ${c.type} buydown`;
}

/** "The seller is offering $10,000 toward a 2-1 rate buydown." */
export function concessionSentence(c: Concession): string {
  const amount = dollars(c.amount);
  if (c.type === "closing-costs") return `The seller is offering ${amount} toward the buyer's closing costs.`;
  if (c.type === "permanent") return `The seller is offering ${amount} toward a permanent rate buydown, lowering the rate for the life of the loan.`;
  const years = BUYDOWNS[c.type].steps!.length;
  return `The seller is offering ${amount} toward a ${c.type} rate buydown, lowering the payment for the first ${years === 1 ? "year" : `${years} years`}.`;
}

/** Disclaimer text for materials that show a concession. */
export function concessionDisclaimer(c: Concession, effects: ConcessionEffect[] = []): string {
  const parts = [`Includes a seller concession of ${dollars(c.amount)}.`];
  const steps = BUYDOWNS[c.type].steps;
  if (steps) {
    parts.push(
      `With the ${c.type} temporary buydown the rate is ${steps.map((s, i) => `${s}% lower in year ${i + 1}`).join(", ")}, then the payment rises to the note-rate payment shown. The buyer must qualify at the note rate.`,
    );
  } else if (c.type === "permanent") {
    parts.push(
      `The permanent buydown assumes seller-paid discount points, each 1% of the loan lowering the rate about ${RATE_CUT_PER_POINT}% (up to ${MAX_POINTS} points); actual pricing varies by lender.`,
    );
  }
  if (effects.some((e) => e.capped))
    parts.push("Where the concession exceeds a loan program's limit, only the allowed amount is shown.");
  parts.push(
    `Seller concessions are limited by loan type: Conventional 3% (under 10% down), 6% (10–24.99% down), 9% (25%+ down) or 2% (investment property); FHA and USDA 6%; VA 4% of the loan plus normal closing costs. Credits cannot exceed the buyer's closing costs and prepaids. Subject to the purchase contract and lender approval.`,
  );
  return parts.join(" ");
}
