const TERM_YEARS = 30;

/** Monthly principal and interest on a fully amortizing fixed loan. */
export function principalAndInterest(loan: number, ratePct: number, years = TERM_YEARS): number {
  const r = ratePct / 100 / 12;
  const n = years * 12;
  return r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
}
