"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LISTING_STATUSES } from "@/lib/types";
import { PhotoField } from "@/components/admin/PhotoField";
import { saveKitEditAction, type EditKitState } from "./actions";

function Input({
  label,
  name,
  values,
  hint,
  ...rest
}: { label: string; name: string; values: Record<string, string>; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="site-field">
      <span>{label}</span>
      <input name={name} defaultValue={values[name] ?? ""} {...rest} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function EditKitForm({
  kit,
  token,
  initial,
  uploadMode,
  defaultRate,
  isBuilder,
}: {
  kit: string;
  token: string;
  initial: Record<string, string>;
  uploadMode: "token" | "presigned" | null;
  defaultRate?: number;
  /** New construction: the builder stands in for the listing agent. */
  isBuilder?: boolean;
}) {
  const [state, action, pending] = useActionState<EditKitState, FormData>(saveKitEditAction.bind(null, kit, token), {});
  const v = state.values ?? initial;
  const rateHint = defaultRate
    ? `Leave blank to use your default rate (${defaultRate}%).`
    : "Leave blank to use today's average rate.";

  return (
    <form action={action} className="site-form edit-kit" key={state.values ? JSON.stringify(state) : "initial"}>
      {state.issues?.length ? (
        <div className="site-alert" role="alert">
          {state.issues.map((i) => (
            <p key={i}>{i}</p>
          ))}
        </div>
      ) : null}

      <section className="acct-section">
        <h2 className="site-h2">The home</h2>
        <div className="site-grid">
          <label className="site-field">
            <span>Status</span>
            <select name="status" defaultValue={v.status}>
              {Object.entries(LISTING_STATUSES).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <small>Shows on the graphics, like &ldquo;Just Listed&rdquo; or &ldquo;Price Improved&rdquo;.</small>
          </label>
          <Input label="List price" name="price" values={v} required inputMode="numeric" placeholder="450000" />
          <Input label="Beds" name="beds" values={v} inputMode="decimal" />
          <Input label="Baths" name="baths" values={v} inputMode="decimal" />
          <Input label="Square feet" name="sqft" values={v} inputMode="numeric" />
          <Input label="Lot size" name="lotSize" values={v} placeholder="0.25 acres" />
          <Input label="Year built" name="yearBuilt" values={v} inputMode="numeric" />
        </div>
        <div className="site-form edit-kit-text">
          <label className="site-field">
            <span>Description</span>
            <textarea name="description" rows={5} defaultValue={v.description} />
          </label>
          <label className="site-field">
            <span>Highlights</span>
            <textarea name="highlights" rows={4} defaultValue={v.highlights} placeholder={"Renovated kitchen\nBig backyard"} />
            <small>One per line. Up to 6 show on the graphics.</small>
          </label>
        </div>
      </section>

      <section className="acct-section">
        <h2 className="site-h2">{isBuilder ? "Builder" : "Listing agent"}</h2>
        <p className="muted acct-intro">
          {isBuilder
            ? "Shows on the graphics and the buyer page in place of a listing agent."
            : "Shows on the graphics and the buyer page. The email isn't shown on any graphic. It fills the To line of your Email kit draft."}
        </p>
        <div className="site-grid">
          {isBuilder ? (
            <>
              <Input label="Builder" name="builder" values={v} required />
              <Input label="Sales contact" name="agentName" values={v} hint="Optional. Leave blank to show the builder's name." />
            </>
          ) : (
            <>
              <Input label="Agent name" name="agentName" values={v} required autoComplete="off" />
              <Input label="Brokerage" name="agentBrokerage" values={v} />
            </>
          )}
          <Input label="Phone" name="agentPhone" values={v} type="tel" hint={isBuilder ? undefined : "Also used for your Text kit button."} />
          <Input label="Email" name="agentEmail" values={v} type="email" />
          {isBuilder ? null : <Input label="License #" name="agentLicense" values={v} />}
        </div>
      </section>

      <section className="acct-section">
        <h2 className="site-h2">Photos</h2>
        <p className="muted acct-intro">The first photo is the cover. The next three fill the collages.</p>
        <PhotoField
          name="photos"
          initial={(v.photos ?? "").split("\n").filter(Boolean)}
          uploadMode={uploadMode}
          folder={`listings/${kit}`}
          uploadUrl={`/edit/${kit}/${token}/upload`}
          allowUrls={false}
        />
      </section>

      <section className="acct-section">
        <h2 className="site-h2">Open house</h2>
        <p className="muted acct-intro">Optional. Set the status to Open House to feature it on the graphics.</p>
        <div className="site-grid edit-kit-3">
          <Input label="Date" name="openHouseDate" values={v} type="date" />
          <Input label="Start" name="openHouseStart" values={v} placeholder="1:00 PM" />
          <Input label="End" name="openHouseEnd" values={v} placeholder="4:00 PM" />
        </div>
      </section>

      <section className="acct-section">
        <h2 className="site-h2">Payments</h2>
        <label className="edit-kit-check">
          <input type="checkbox" name="showPayment" defaultChecked={v.showPayment !== "false"} />
          Show payment estimates on this kit
        </label>
        <div className="site-grid">
          <Input label="Rate %" name="rate" values={v} inputMode="decimal" placeholder="6.375" hint={rateHint} />
          <Input label="APR %" name="apr" values={v} inputMode="decimal" placeholder="6.512" hint="Needed with any rate." />
          <Input label="FHA rate %" name="fhaRate" values={v} inputMode="decimal" placeholder="Same as rate" />
          <Input label="FHA APR %" name="fhaApr" values={v} inputMode="decimal" />
          <Input label="Property taxes / year" name="annualTaxes" values={v} inputMode="numeric" placeholder="Estimated" />
          <Input label="Insurance / year" name="annualInsurance" values={v} inputMode="numeric" placeholder="Estimated" />
          <Input label="HOA / month" name="hoaMonthly" values={v} inputMode="numeric" />
        </div>
      </section>

      <div className="site-form-actions edit-kit-actions">
        <button className="pill" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        {state.saved ? (
          <span className="small">
            Saved. <Link href={`/l/${kit}`} target="_blank">See the updated kit ↗</Link>
          </span>
        ) : null}
      </div>
    </form>
  );
}
