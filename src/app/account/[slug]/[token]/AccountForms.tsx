"use client";

import { useActionState } from "react";
import { saveProfileAction, type AccountFormState } from "./actions";

function Issues({ state }: { state: AccountFormState }) {
  if (state.issues?.length)
    return (
      <div className="site-alert" role="alert">
        {state.issues.map((i) => (
          <p key={i}>{i}</p>
        ))}
      </div>
    );
  return null;
}

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

export function ProfileForm({ slug, token, initial }: { slug: string; token: string; initial: Record<string, string> }) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(saveProfileAction.bind(null, slug, token), {});
  const v = state.values ?? initial;
  return (
    <form action={action} className="site-form" key={state.values ? JSON.stringify(state.values) : "initial"}>
      <Issues state={state} />
      <div className="site-grid">
        <Input label="Full name" name="name" values={v} required autoComplete="name" />
        <Input label="Title" name="title" values={v} placeholder="Senior Loan Officer" />
        <Input label="Your NMLS #" name="nmls" values={v} required inputMode="numeric" />
        <Input label="Company" name="company" values={v} required />
        <Input label="Company NMLS #" name="companyNmls" values={v} inputMode="numeric" />
        <Input label="Mobile phone" name="phone" values={v} type="tel" autoComplete="tel" />
        <Input label="Email" name="email" values={v} type="email" required hint="Where we send your new kits." />
        <Input
          label="Pre-approval link"
          name="applyUrl"
          values={v}
          type="url"
          placeholder="https://"
          hint="The flyer's QR code opens this."
        />
      </div>
      <div className="site-form-actions">
        <button className="pill" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </button>
        {state.saved ? <span className="small">Saved.</span> : null}
      </div>
    </form>
  );
}
