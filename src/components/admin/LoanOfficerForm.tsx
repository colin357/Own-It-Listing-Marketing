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
          <Field label="Brand color">
            <input type="color" name="brandColor" defaultValue={v.brandColor || "#0f2a44"} />
          </Field>
          <Field label="Accent color">
            <input type="color" name="accentColor" defaultValue={v.accentColor || "#c8a24a"} />
          </Field>
        </div>
      </fieldset>
      <fieldset>
        <legend>Estimated payment (optional)</legend>
        <p className="muted small">Leave the rate blank to hide payment estimates on this loan officer&apos;s materials.</p>
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
