"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  if (state.sent)
    return (
      <div className="site-note">
        If {state.email} has an account, your sign-in link is on its way. Check your inbox (and spam) in a minute.
      </div>
    );
  return (
    <form action={action} className="site-form login-form">
      {state.error ? <div className="site-alert">{state.error}</div> : null}
      <label className="site-field">
        <span>Email</span>
        <input name="email" type="email" required autoComplete="email" defaultValue={state.email ?? ""} />
      </label>
      <div className="site-form-actions">
        <button className="pill pill-lg" type="submit" disabled={pending}>
          {pending ? "Sending…" : "Email me a sign-in link"}
        </button>
      </div>
    </form>
  );
}
