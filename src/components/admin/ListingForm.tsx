"use client";

import { useActionState } from "react";
import { saveListingAction, type FormState } from "@/app/admin/actions";
import { LISTING_STATUSES } from "@/lib/types";
import { BUYDOWNS } from "@/lib/concessions";
import { Field, FormErrors, TextInput } from "./Field";
import { PhotoField } from "./PhotoField";

export function ListingForm({
  slug,
  initial,
  loanOfficers,
  uploadMode,
}: {
  slug: string | null;
  initial: Record<string, string>;
  loanOfficers: { slug: string; name: string }[];
  uploadMode: "token" | "presigned" | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveListingAction.bind(null, slug), {});
  const v = state.values ?? initial;

  return (
    <form action={action} className="form" key={state.values ? JSON.stringify(state.values) : "initial"}>
      <FormErrors issues={state.issues} />

      <fieldset>
        <legend>Listing</legend>
        <div className="grid">
          <Field label="Loan officer">
            <select name="loanOfficerSlug" defaultValue={v.loanOfficerSlug ?? loanOfficers[0]?.slug} required>
              {loanOfficers.map((lo) => (
                <option key={lo.slug} value={lo.slug}>
                  {lo.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={v.status ?? "just-listed"}>
              {Object.entries(LISTING_STATUSES).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <TextInput label="Street address" name="address" values={v} required wide />
          <TextInput label="Unit" name="unit" values={v} placeholder="Apt 4B" />
          <TextInput label="City" name="city" values={v} required />
          <TextInput label="State" name="state" values={v} required maxLength={2} placeholder="TX" />
          <TextInput label="ZIP" name="zip" values={v} />
          <TextInput label="List price" name="price" values={v} required inputMode="numeric" placeholder="450000" />
          <TextInput label="Beds" name="beds" values={v} inputMode="decimal" />
          <TextInput label="Baths" name="baths" values={v} inputMode="decimal" />
          <TextInput label="Square feet" name="sqft" values={v} inputMode="numeric" />
          <TextInput label="Lot size" name="lotSize" values={v} placeholder="0.25 acres" />
          <TextInput label="Year built" name="yearBuilt" values={v} inputMode="numeric" />
          <TextInput label="Listing URL (MLS / Zillow / agent site)" name="listingUrl" values={v} type="url" wide />
          <Field label="Description" wide>
            <textarea name="description" rows={4} defaultValue={v.description} />
          </Field>
          <Field label="Highlights" hint="One per line — e.g. “Renovated kitchen”. Up to 6 show on graphics." wide>
            <textarea name="highlights" rows={4} defaultValue={v.highlights} />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend>Photos</legend>
        <PhotoField
          name="photos"
          initial={(v.photos ?? "").split("\n").filter(Boolean)}
          uploadMode={uploadMode}
          folder={`listings/${slug ?? "new"}`}
        />
      </fieldset>

      <fieldset>
        <legend>Open house (optional)</legend>
        <div className="grid">
          <TextInput label="Date" name="openHouseDate" values={v} type="date" />
          <TextInput label="Start" name="openHouseStart" values={v} placeholder="1:00 PM" />
          <TextInput label="End" name="openHouseEnd" values={v} placeholder="4:00 PM" />
        </div>
      </fieldset>

      <fieldset>
        <legend>Listing agent (referral partner)</legend>
        <div className="grid">
          <TextInput label="Name" name="agentName" values={v} required />
          <TextInput label="Brokerage" name="agentBrokerage" values={v} />
          <TextInput label="Phone" name="agentPhone" values={v} type="tel" />
          <TextInput label="Email" name="agentEmail" values={v} type="email" />
          <TextInput label="License #" name="agentLicense" values={v} />
          <TextInput label="Headshot URL" name="agentHeadshotUrl" values={v} type="url" />
        </div>
      </fieldset>

      <fieldset>
        <legend>Financing</legend>
        <p className="field-hint">
          The rate powers the payment-options flyer (Conventional 5% down, Conventional 20% down, FHA 3.5% down). Leave
          taxes and insurance blank to estimate them from state averages.
        </p>
        <div className="grid">
          <TextInput label="Rate %" name="rate" values={v} inputMode="decimal" placeholder="6.375" />
          <TextInput label="APR %" name="apr" values={v} inputMode="decimal" placeholder="6.512" />
          <TextInput label="FHA rate %" name="fhaRate" values={v} inputMode="decimal" placeholder="Same as rate" />
          <TextInput label="FHA APR %" name="fhaApr" values={v} inputMode="decimal" />
          <TextInput label="Annual property taxes" name="annualTaxes" values={v} inputMode="numeric" placeholder="Estimate" />
          <TextInput label="Annual insurance" name="annualInsurance" values={v} inputMode="numeric" placeholder="Estimate" />
          <TextInput label="HOA / month" name="hoaMonthly" values={v} inputMode="numeric" />
          <TextInput label="Seller credit $" name="sellerCredit" values={v} inputMode="numeric" placeholder="None" />
          <Field label="Seller credit use">
            <select name="buydown" defaultValue={v.buydown || "2-1"}>
              {Object.entries(BUYDOWNS).map(([k, b]) => (
                <option key={k} value={k}>
                  {b.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend>Options</legend>
        <input type="hidden" name="showPayment__present" value="1" />
        <label className="check">
          <input type="checkbox" name="showPayment" defaultChecked={v.showPayment !== "false"} />
          Show payment estimates (on the graphics and the payment-options flyer)
        </label>
      </fieldset>

      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : slug ? "Save changes" : "Create listing kit"}
        </button>
      </div>
    </form>
  );
}
