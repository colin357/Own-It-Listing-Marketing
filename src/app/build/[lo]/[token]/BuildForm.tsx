"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AddressInput } from "./AddressInput";
import { buildKitAction, findListingAction, type BuildState, type FindState } from "./actions";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function BuildForm({ slug, token, photos }: { slug: string; token: string; photos: boolean }) {
  const [state, find, finding] = useActionState<FindState, FormData>(findListingAction.bind(null, slug, token), {});
  const [built, build, building] = useActionState<BuildState, FormData>(buildKitAction.bind(null, slug, token), {});
  const f = state.found;

  return (
    <div className="build">
      <form action={find} className="build-search">
        <label className="field">
          <span className="field-label">Property address</span>
          <AddressInput key={`addr-${state.address ?? ""}`} slug={slug} token={token} defaultValue={state.address} />
          <span className="field-hint">Pick the address from the list, or type it with the city, state and ZIP.</span>
        </label>
        <div>
          <button className="pill pill-lg" disabled={finding || building}>
            {finding ? "Looking it up…" : "Find listing"}
          </button>
        </div>
        {state.error ? <p className="build-note build-error">{state.error}</p> : null}
      </form>

      {f ? (
        <section className="build-result" aria-live="polite">
          <p className="label muted">{f.mlsNumber ? `MLS #${f.mlsNumber}` : "Listing found"}</p>
          <h2 className="build-address">{f.address}</h2>
          <p className="muted">{f.cityLine}</p>
          <p className="build-facts">
            <strong>{money(f.price)}</strong>
            {f.beds != null ? <span>{f.beds} bd</span> : null}
            {f.baths != null ? <span>{f.baths} ba</span> : null}
            {f.sqft ? <span>{f.sqft.toLocaleString("en-US")} sq ft</span> : null}
          </p>
          <p className="small">
            Listed by <strong>{f.agent}</strong>
            {f.office ? `, ${f.office}` : ""}
          </p>

          {f.existingSlug ? (
            <div className="build-actions">
              <p className="small muted">You already have a kit for this listing.</p>
              <Link className="pill" href={`/l/${f.existingSlug}`}>
                Open the kit
              </Link>
            </div>
          ) : (
            <form action={build} className="build-actions">
              <input type="hidden" name="key" value={f.key} />
              <button className="pill" disabled={building}>
                {building ? "Building your kit…" : "Build the kit"}
              </button>
              {building ? (
                <p className="small muted">
                  {photos ? "Pulling the listing photos. This can take up to a minute." : "Almost done."}
                </p>
              ) : (
                <p className="small muted">Not the right home? Check the address and search again.</p>
              )}
              {built.error ? <p className="build-note build-error">{built.error}</p> : null}
            </form>
          )}
        </section>
      ) : null}
    </div>
  );
}
