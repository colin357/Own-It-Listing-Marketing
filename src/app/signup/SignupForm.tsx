"use client";

import { useActionState } from "react";
import { signupAction, type SignupState } from "./actions";

export function SignupForm({ trialDays, price }: { trialDays: number; price: number }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(signupAction, {});
  const v = state.values ?? {};
  const input = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="site-field">
      <span>{label}</span>
      <input name={name} defaultValue={v[name] ?? ""} {...props} />
    </label>
  );
  return (
    <form action={action} className="site-form" key={state.values ? JSON.stringify(state.values) : "initial"}>
      {state.issues?.length ? (
        <div className="site-alert" role="alert">
          {state.issues.map((i) => (
            <p key={i}>{i}</p>
          ))}
        </div>
      ) : null}
      {state.notice ? <div className="site-note">{state.notice}</div> : null}
      <div className="site-grid">
        {input("name", "Full name", { required: true, autoComplete: "name" })}
        {input("email", "Email", { required: true, type: "email", autoComplete: "email" })}
        {input("phone", "Mobile phone", { type: "tel", autoComplete: "tel" })}
        {input("title", "Title", { placeholder: "Senior Loan Officer" })}
        {input("company", "Company", { required: true, autoComplete: "organization" })}
        {input("nmls", "Your NMLS #", { required: true, inputMode: "numeric" })}
        {input("companyNmls", "Company NMLS #", { inputMode: "numeric" })}
      </div>
      <div className="site-form-actions">
        <button className="pill pill-lg" type="submit" disabled={pending}>
          {pending ? "Opening checkout…" : "Continue to payment"}
        </button>
      </div>
      <p className="small muted">
        Next you add a card on Stripe&apos;s secure checkout. You won&apos;t be charged for {trialDays} days. After that it&apos;s $
        {price}/month until you cancel, which you can do any time from your account.
      </p>
    </form>
  );
}
