"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveConcessionAction } from "@/app/l/[slug]/actions";
import { BUYDOWNS, closingCostCredit, concessionEffect, type ScenarioBase } from "@/lib/concessions";
import { BUYDOWN_TYPES, type BuydownType, type Concession } from "@/lib/types";

export type CalculatorScenario = ScenarioBase & { id: string; name: string; detail: string };

type Choice = BuydownType | "none";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round(n));

/**
 * One tap: the agent picks a seller incentive and it's saved. Each option has
 * a fixed cost per loan, so there is no amount to enter, and loan limits are
 * applied quietly (an option that's over a loan's limit is left off that loan).
 */
export function ConcessionCalculator({
  slug,
  price,
  scenarios,
  initial,
}: {
  slug: string;
  price: number;
  scenarios: CalculatorScenario[];
  initial: Concession | null;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice>(initial?.type ?? "none");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const effectsFor = (t: BuydownType) =>
    scenarios.map((s) => ({ s, e: concessionEffect(s, price, { amount: t === "closing-costs" ? closingCostCredit(price) : 0, type: t }) }));

  // A one-line teaser per option, from the best loan it's available on.
  const teasers = useMemo(() => {
    const out = {} as Record<BuydownType, { cost: string; saves: string }>;
    for (const t of BUYDOWN_TYPES) {
      const ok = effectsFor(t).filter(({ e }) => e.available);
      if (!ok.length) {
        out[t] = { cost: "", saves: "" };
        continue;
      }
      // What it costs the seller, as a range across the loans it's offered on.
      const credits = ok.map(({ e }) => e.credit);
      const lo = Math.min(...credits);
      const hi = Math.max(...credits);
      const cost = `Costs ${Math.round(lo / 100) === Math.round(hi / 100) ? money(hi) : `${money(lo)}–${money(hi)}`}`;
      const best = money(Math.max(...ok.map(({ e }) => e.monthlySavings)));
      const saves =
        t === "closing-costs" ? "Less cash needed to close" : t === "permanent" ? `Saves up to ${best}/mo` : `Saves up to ${best}/mo in year 1`;
      out[t] = { cost, saves };
    }
    return out;
  }, [scenarios, price]); // effectsFor only reads these

  const pick = (next: Choice) => {
    if (pending || next === choice) return;
    const prev = choice;
    setChoice(next);
    setStatus(null);
    startTransition(async () => {
      const res = await saveConcessionAction(slug, next);
      if (res.error) {
        setChoice(prev);
        setStatus(res.error);
        return;
      }
      setStatus(next === "none" ? "Removed. Your marketing is back to normal." : "Saved. Your graphics, flyers, captions and emails are updated.");
      router.refresh();
    });
  };

  const results = choice === "none" ? [] : effectsFor(choice);

  return (
    <div className="calc">
      <div className="calc-step">
        <p className="field-label">Pick one</p>
        <div className="calc-types" role="radiogroup" aria-label="Seller incentive">
          {BUYDOWN_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={choice === t}
              className={`calc-type${choice === t ? " is-on" : ""}`}
              disabled={pending}
              onClick={() => pick(t)}
            >
              <strong>{BUYDOWNS[t].label}</strong>
              <span>{BUYDOWNS[t].blurb}</span>
              {teasers[t].cost ? <em>{teasers[t].cost}</em> : null}
              {teasers[t].saves ? <small>{teasers[t].saves}</small> : null}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={choice === "none"}
            className={`calc-type calc-none${choice === "none" ? " is-on" : ""}`}
            disabled={pending}
            onClick={() => pick("none")}
          >
            <strong>No incentive</strong>
            <span>Leave financing extras off the marketing</span>
          </button>
        </div>
        <p className={`small calc-status${status ? "" : " muted"}`} aria-live="polite">
          {pending ? "Updating your marketing…" : status ?? "Tap an option and your marketing updates automatically."}
        </p>
      </div>

      {results.length ? (
        <div className="calc-step">
          <p className="field-label">What buyers see</p>
          <ul className="calc-results">
            {results.map(({ s, e }) => {
              let main = "";
              let sub = "";
              if (!e.available) {
                main = "Not offered on this loan";
                sub = "It's over this loan's seller credit limit";
              } else if (e.schedule.length) {
                main = `${money(e.schedule[0].total)}/mo in year 1`;
                sub = `Then ${money(e.total)}/mo`;
              } else if (e.rateCut) {
                main = `${money(e.total)}/mo`;
                sub = `Saves ${money(e.monthlySavings)}/mo`;
              } else {
                main = `${money(e.cashToClose)} to close`;
                sub = `Saves ${money(e.toClosing)}`;
              }
              return (
                <li key={s.id} className={e.available ? "" : "is-off"}>
                  <span className="calc-loan">
                    <strong>{s.name}</strong> {s.detail}
                  </span>
                  <span className="calc-pay">
                    <strong>{main}</strong>
                    <small>{sub}</small>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="muted small calc-foot">Loan limits are checked for you. Your lender confirms the final numbers.</p>
        </div>
      ) : null}
    </div>
  );
}
