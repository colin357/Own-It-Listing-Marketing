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
/** Discount points the seller buys for a permanent buydown (2 points ≈ 0.5% off the rate). */
export const PERMANENT_POINTS = 2;
/** No loan type allows more than this (Conventional with 25%+ down). */
export const MAX_CONCESSION_PCT = 9;

export const BUYDOWNS: Record<BuydownType, { label: string; steps?: number[]; blurb: string }> = {
  "2-1": { label: "2-1 buydown", steps: [2, 1], blurb: "Rate 2% lower in year 1 and 1% lower in year 2" },
  "1-0": { label: "1-0 buydown", steps: [1], blurb: "Rate 1% lower for the first year" },
  "3-2-1": { label: "3-2-1 buydown", steps: [3, 2, 1], blurb: "Rate 3%, 2% and 1% lower over the first three years" },
  permanent: { label: "Permanent buydown", blurb: "Rate about 0.5% lower for the life of the loan" },
  "closing-costs": { label: "Closing costs", blurb: "Seller pays about 3% toward the buyer's closing costs" },
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
  /** False when the option costs more than this loan's seller credit limit; the loan is then shown as usual. */
  available: boolean;
  /** What the option costs the seller on this loan. */
  credit: number;
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
  /** Closing cost credit applied to cash to close. */
  toClosing: number;
  cashToClose: number;
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

/** The closing cost credit offered: estimated closing costs, rounded down to $500. */
export function closingCostCredit(price: number): number {
  return Math.floor((price * CLOSING_COST_PCT) / 100 / 500) * 500;
}

/**
 * What the agent's chosen option does on one loan. Each option has a fixed
 * cost on each loan (the buydown, PERMANENT_POINTS discount points, or the
 * closing cost credit), so the agent never enters an amount. An option that
 * costs more than the loan's seller credit limit is simply left off that loan.
 */
export function concessionEffect(s: ScenarioBase, price: number, c: Concession): ConcessionEffect {
  const r = limitRule(s.program, s.downPct);
  // VA's limit is for buydowns and other extras; normal closing costs don't count against it.
  const limit = limitAmount(r, price, s.downPct);
  const before = { ratePct: s.ratePct, aprPct: s.aprPct, total: s.total, cashToClose: s.cashToClose };
  let credit = 0;
  let schedule: YearPayment[] = [];
  let points = 0;
  let rateCut = 0;
  let toClosing = 0;
  let { ratePct, aprPct, principalInterest, total } = s;

  const steps = BUYDOWNS[c.type].steps;
  if (steps) {
    credit = temporaryBuydownCost(s, c.type);
    if (credit <= limit + 0.5) {
      schedule = steps.map((step, i) => {
        const rate = Math.max(s.ratePct - step, 0);
        return { label: `Year ${i + 1}`, ratePct: round3(rate), total: s.total - (s.principalInterest - principalAndInterest(s.loanAmount, rate)) };
      });
      schedule.push({ label: `Years ${steps.length + 1}–30`, ratePct: s.ratePct, total: s.total });
    }
  } else if (c.type === "permanent") {
    credit = (PERMANENT_POINTS / 100) * s.loanAmount;
    if (credit <= limit + 0.5) {
      points = PERMANENT_POINTS;
      rateCut = PERMANENT_POINTS * RATE_CUT_PER_POINT;
      ratePct = round3(s.ratePct - rateCut);
      aprPct = s.aprPct != null ? round3(s.aprPct - rateCut) : undefined;
      principalInterest = principalAndInterest(s.loanAmount, ratePct);
      total = s.total - (s.principalInterest - principalInterest);
    }
  } else {
    credit = c.amount;
    toClosing = s.program === "va" ? credit : Math.min(credit, limit);
    credit = toClosing;
  }

  const available = !!schedule.length || rateCut > 0 || toClosing > 0;
  return {
    ...c,
    rule: r,
    available,
    credit: available ? credit : 0,
    schedule,
    points,
    rateCut,
    ratePct,
    aprPct,
    principalInterest,
    total,
    toClosing,
    cashToClose: s.cashToClose - toClosing,
    monthlySavings: schedule.length ? s.total - schedule[0].total : before.total - total,
    before,
  };
}

/** The amount to record for an option: the most it costs the seller on any loan it's offered on. */
export function offerAmount(type: BuydownType, scenarios: ScenarioBase[], price: number): number {
  if (type === "closing-costs") return closingCostCredit(price);
  const credits = scenarios.map((s) => concessionEffect(s, price, { amount: 0, type })).filter((e) => e.available).map((e) => e.credit);
  return Math.round(Math.max(0, ...credits));
}

/** The listing's concession when it should appear in marketing (not once the home is under contract or sold). */
export function activeConcession(l: Listing): Concession | null {
  const c = l.concession;
  if (!c?.type) return null;
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

/** "The seller is offering a 2-1 rate buydown, lowering the payment for the first 2 years." */
export function concessionSentence(c: Concession): string {
  if (c.type === "closing-costs") return `The seller is offering ${dollars(c.amount)} toward the buyer's closing costs.`;
  if (c.type === "permanent") return "The seller is offering a rate buydown that lowers the buyer's rate for the life of the loan.";
  const years = BUYDOWNS[c.type].steps!.length;
  return `The seller is offering a ${c.type} rate buydown, lowering the payment for the first ${years === 1 ? "year" : `${years} years`}.`;
}

/** Short disclaimer for materials that show a concession. */
export function concessionDisclaimer(c: Concession): string {
  const steps = BUYDOWNS[c.type].steps;
  const what = steps
    ? `Seller-paid ${c.type} temporary buydown: rate ${steps.map((s, i) => `${s}% lower in year ${i + 1}`).join(", ")}, then the note-rate payment shown; buyer must qualify at the note rate.`
    : c.type === "permanent"
      ? `Seller-paid permanent buydown assumes ${PERMANENT_POINTS} discount points lowering the rate about ${PERMANENT_POINTS * RATE_CUT_PER_POINT}%; pricing varies by lender.`
      : `Seller credit of ${dollars(c.amount)} toward closing costs.`;
  return `${what} Seller concessions are subject to loan program limits, the purchase contract and lender approval.`;
}
