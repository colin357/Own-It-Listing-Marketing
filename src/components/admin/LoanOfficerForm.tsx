"use client";

import { useActionState } from "react";
import { saveLoanOfficerAction, type FormState } from "@/app/admin/actions";
import { Field, FormErrors, TextInput } from "./Field";

export function LoanOfficerForm({ slug, initial }: { slug: string | null; initial: Record<string, string> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveLoanOfficerAction.bind(null, slug), {});
  const v = state.values ?? initial;

  return (
    <form action={action} className="form" key={state.values ? JSON.stringify(state.values) : "initial"}>
      <FormErrors issues={state.issues} />
      <fieldset>
        <legend>Loan officer</legend>
        <div className="grid">
          <TextInput label="Full name" name="name" values={v} required />
          <TextInput label="Title" name="title" values={v} placeholder="Senior Loan Officer" />
          <TextInput label="NMLS #" name="nmls" values={v} required />
          <TextInput label="Company" name="company" values={v} required />
          <TextInput label="Company NMLS #" name="companyNmls" values={v} />
          <TextInput label="Phone" name="phone" values={v} type="tel" />
          <TextInput label="Email" name="email" values={v} type="email" />
          <TextInput label="Apply / pre-approval URL" name="applyUrl" values={v} type="url" hint="Used for the flyer QR code." />
          <TextInput label="Headshot URL" name="headshotUrl" values={v} type="url" />
          <TextInput label="Logo URL" name="logoUrl" values={v} type="url" hint="PNG or JPG. Shown on the flyer and kit page." />
        </div>
      </fieldset>
      <fieldset>
        <legend>Branding</legend>
        <div className="grid">
          <TextInput label="Brand color" name="brandColor" values={v} placeholder="#0a0a0a" hint="Optional hex. Defaults to black." />
          <TextInput
            label="Accent color"
            name="accentColor"
            values={v}
            placeholder="#d9d2c5"
            hint="Optional hex. Graphics default to a neutral stone."
          />
        </div>
      </fieldset>
      <fieldset>
        <legend>Default rate (optional)</legend>
        <p className="muted small">
          Used when a listing comes in without its own rate. Leave blank to only show payments on listings that include one.
        </p>
        <div className="grid">
          <TextInput label="Rate %" name="paymentRatePct" values={v} inputMode="decimal" placeholder="6.5" />
          <TextInput label="Down payment %" name="paymentDownPct" values={v} inputMode="decimal" placeholder="20" />
          <TextInput label="Term (years)" name="paymentTermYears" values={v} inputMode="numeric" placeholder="30" />
        </div>
      </fieldset>
      <fieldset>
        <legend>Compliance</legend>
        <Field label="Additional disclaimer" hint="Appended to every graphic and the kit page (e.g. state licensing)." wide>
          <textarea name="disclaimer" rows={3} defaultValue={v.disclaimer} />
        </Field>
      </fieldset>
      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : slug ? "Save changes" : "Add loan officer"}
        </button>
      </div>
    </form>
  );
}
