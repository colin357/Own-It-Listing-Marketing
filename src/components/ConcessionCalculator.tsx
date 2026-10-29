"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveConcessionAction } from "@/app/l/[slug]/actions";
import {
  BUYDOWNS,
  CLOSING_COST_PCT,
  concessionEffect,
  isTemporary,
  LIMIT_RULES,
  limitAmount,
  MAX_CONCESSION_PCT,
  temporaryBuydownCost,
  type ScenarioBase,
} from "@/lib/concessions";
import { BUYDOWN_TYPES, type BuydownType, type Concession } from "@/lib/types";

export type CalculatorScenario = ScenarioBase & { id: string; name: string; detail: string };

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round(n));
const QUICK_PCTS = [1, 2, 3, 6];

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
  const [amount, setAmount] = useState(initial?.amount ?? 0);
  const [type, setType] = useState<BuydownType>(initial?.type ?? "2-1");
  const [saved, setSaved] = useState<Concession | null>(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const max = Math.floor((price * MAX_CONCESSION_PCT) / 100);
  const pct = price ? (amount / price) * 100 : 0;
  const effects = useMemo(
    () => scenarios.map((s) => ({ s, e: concessionEffect(s, price, { amount, type }) })),
    [scenarios, price, amount, type],
  );
  // What each temporary buydown costs across the loans shown.
  const costs = useMemo(() => {
    const out = {} as Record<BuydownType, number[]>;
    for (const t of BUYDOWN_TYPES) out[t] = isTemporary(t) ? scenarios.map((s) => temporaryBuydownCost(s, t)) : [];
    return out;
  }, [scenarios]);

  const capped = effects.filter(({ e }) => e.capped);
  const unfunded = amount > 0 && isTemporary(type) ? effects.filter(({ e }) => !e.funded) : [];
  const unused = effects.filter(({ e }) => e.unused > 0);
  const dirty = (saved?.amount ?? 0) !== amount || (amount > 0 && saved?.type !== type);

  const setClamped = (n: number) => {
    setAmount(Math.max(0, Math.min(max, Math.round(n))));
    setStatus(null);
  };

  const pickType = (t: BuydownType) => {
    setType(t);
    setStatus(null);
    // Make a temporary buydown work on every loan shown, unless the agent already offers more.
    const need = Math.max(...costs[t], 0);
    if (need && amount < need) setClamped(Math.ceil(need / 100) * 100);
  };

  const save = (value: number) =>
    startTransition(async () => {
      const res = await saveConcessionAction(slug, value, type);
      if (res.error) {
        setStatus(res.error);
        return;
      }
      setSaved(value > 0 ? { amount: value, type } : null);
      if (!value) setAmount(0);
      setStatus(value > 0 ? "Done. Your graphics, flyers, captions and emails now show the seller credit." : "Seller credit removed from your marketing.");
      router.refresh();
    });

  return (
    <div className="calc">
      <div className="calc-step">
        <p className="field-label">1. Seller credit</p>
        <div className="calc-money">
          <span>$</span>
          <input
            inputMode="numeric"
            aria-label="Seller credit in dollars"
            value={amount ? amount.toLocaleString("en-US") : ""}
            placeholder="0"
            onChange={(e) => setClamped(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
          />
        </div>
        <input
          type="range"
          className="calc-range"
          min={0}
          max={max}
          step={250}
          value={amount}
          aria-label="Seller credit"
          onChange={(e) => setClamped(Number(e.target.value))}
        />
        <div className="calc-row">
          <p className="muted small">
            {pct.toFixed(pct && pct < 1 ? 2 : 1)}% of the {money(price)} price
          </p>
          <div className="calc-quick">
            {QUICK_PCTS.map((p) => (
              <button key={p} type="button" className="calc-chip" onClick={() => setClamped((price * p) / 100)}>
                {p}%
              </button>
            ))}
          </div>
        </div>
        {amount >= max ? <p className="calc-note calc-warn">{MAX_CONCESSION_PCT}% is the most any loan type allows.</p> : null}
      </div>

      <div className="calc-step">
        <p className="field-label">2. How buyers can use it</p>
        <div className="calc-types" role="radiogroup">
          {BUYDOWN_TYPES.map((t) => {
            const c = costs[t];
            const lo = c.length ? Math.min(...c) : 0;
            const hi = c.length ? Math.max(...c) : 0;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                className={`calc-type${type === t ? " is-on" : ""}`}
                onClick={() => pickType(t)}
              >
                <strong>{BUYDOWNS[t].label}</strong>
                <span>{BUYDOWNS[t].blurb}</span>
                {hi ? <em>Costs {Math.round(lo / 100) === Math.round(hi / 100) ? money(hi) : `${money(lo)}–${money(hi)}`}</em> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="calc-step">
        <p className="field-label">3. What buyers see</p>
        <ul className="calc-results">
          {effects.map(({ s, e }) => {
            let main = "";
            let sub = "";
            if (!amount) {
              main = `${money(s.total)}/mo`;
              sub = `${s.ratePct}% rate · ${money(s.cashToClose)} to close`;
            } else if (e.schedule.length) {
              main = `${money(e.schedule[0].total)}/mo in year 1`;
              sub = `${e.schedule[0].ratePct}% rate, then ${money(e.total)}/mo at ${s.ratePct}%`;
            } else if (e.rateCut) {
              main = `${money(e.total)}/mo at ${e.ratePct}%`;
              sub = `Saves ${money(e.monthlySavings)}/mo for the life of the loan`;
            } else {
              main = `${money(e.cashToClose)} to close`;
              sub = `Was ${money(e.before.cashToClose)}${isTemporary(type) ? ` · buydown needs ${money(e.buydownCost)}` : ""}`;
            }
            const over = e.capped;
            return (
              <li key={s.id}>
                <span className="calc-loan">
                  <strong>{s.name}</strong> {s.detail}
                </span>
                <span className="calc-pay">
                  <strong>{main}</strong>
                  <small>{sub}</small>
                </span>
                <span className={`calc-limit${over ? " calc-warn" : ""}`}>
                  {over ? `Capped at ${money(e.limit)}` : `Limit ${e.rule.pct}%${e.rule.of === "loan" ? " + closing" : ""}`}
                </span>
              </li>
            );
          })}
        </ul>
        {capped.length ? (
          <p className="calc-note calc-warn">
            Over the limit for {capped.map(({ s, e }) => `${s.name} ${s.detail} (${e.rule.pct}%${e.rule.of === "loan" ? " of the loan" : ""})`).join(", ")}. Those
            buyers can only use up to the limit, so your marketing shows the capped amount.
          </p>
        ) : null}
        {unfunded.length ? (
          <p className="calc-note calc-warn">
            Not enough for the {type} buydown on {unfunded.map(({ s }) => `${s.name} ${s.detail}`).join(", ")}. It goes to their closing costs
            instead.
          </p>
        ) : null}
        {unused.length ? (
          <p className="calc-note">
            Some of the credit can&apos;t be used by {unused.map(({ s }) => `${s.name} ${s.detail}`).join(", ")}: a credit can&apos;t be
            more than the buydown plus closing costs.
          </p>
        ) : null}
      </div>

      <details className="calc-limits">
        <summary>Seller concession limits by loan type</summary>
        <table>
          <tbody>
            {LIMIT_RULES.map((r) => {
              const lim = limitAmount(r, price);
              const ok = amount <= lim + 0.5 || (r.of === "loan" && amount <= lim + (price * CLOSING_COST_PCT) / 100);
              return (
                <tr key={r.id}>
                  <td>
                    <strong>{r.loan}</strong> {r.when}
                  </td>
                  <td>
                    {r.pct}%{r.of === "loan" ? " of loan" : ""}
                  </td>
                  <td>{money(lim)}</td>
                  <td className={ok ? "calc-ok" : "calc-warn"}>{amount ? (ok ? "OK" : "Over") : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted small">
          Percentages are of the price (or appraised value, if lower). VA&apos;s 4% doesn&apos;t include the buyer&apos;s normal closing
          costs, which the seller can pay on top. Credits can&apos;t be more than the buyer&apos;s actual costs.
        </p>
      </details>

      <div className="calc-actions">
        <button type="button" className="pill pill-lg" disabled={pending || !dirty || !amount} onClick={() => save(amount)}>
          {pending ? "Updating…" : saved ? "Update my marketing" : "Add to my marketing"}
        </button>
        {saved ? (
          <button type="button" className="textlink" disabled={pending} onClick={() => save(0)}>
            Remove credit
          </button>
        ) : null}
        {status ? <p className="small calc-status">{status}</p> : null}
      </div>
    </div>
  );
}
