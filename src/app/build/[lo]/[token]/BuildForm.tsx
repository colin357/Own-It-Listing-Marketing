"use client";

import { useActionState } from "react";
import Link from "next/link";
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
          <span className="field-label">MLS number</span>
          <input
            name="mls"
            defaultValue={state.mls}
            key={`mls-${state.mls ?? ""}`}
            placeholder="e.g. 20845123"
            autoComplete="off"
            inputMode="text"
            autoFocus
          />
        </label>
        {state.askAddress ? (
          <label className="field">
            <span className="field-label">Property address</span>
            <input
              name="address"
              defaultValue={state.address}
              key={`addr-${state.address ?? ""}`}
              placeholder="123 Main St, Austin, TX 78704"
              autoComplete="off"
            />
            <span className="field-hint">
              We look up MLS numbers in the listings we pull twice a week, so very new or older listings may not be
              there yet. The address finds it directly.
            </span>
          </label>
        ) : null}
        <div>
          <button className="pill pill-lg" disabled={finding || building}>
            {finding ? "Looking it up…" : "Find listing"}
          </button>
        </div>
        {state.askAddress && !state.error && !state.address ? (
          <p className="build-note">We don&apos;t have MLS #{state.mls} yet. Add the address and search again.</p>
        ) : null}
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
                <p className="small muted">Not the right home? Check the MLS number and search again.</p>
              )}
              {built.error ? <p className="build-note build-error">{built.error}</p> : null}
            </form>
          )}
        </section>
      ) : null}
    </div>
  );
}
