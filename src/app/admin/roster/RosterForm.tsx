"use client";

import { useActionState } from "react";
import { uploadRosterAction, type RosterState } from "../detections/actions";

export function RosterForm() {
  const [state, action, pending] = useActionState<RosterState, FormData>(uploadRosterAction, {});
  return (
    <form action={action} className="form">
      {state.ok ? <div className="alert alert-success">{state.ok}</div> : null}
      {state.issues?.length ? (
        <div className="alert alert-error">
          <ul>
            {state.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <label className="field">
        <span className="field-label">Agent roster CSV</span>
        <input type="file" name="agents" accept=".csv,text/csv" />
        <span className="field-hint">
          Columns: full_name, brokerage, city, state, zip_code, phone, email, notes. The loan officer comes from a
          loan_officer column or &quot;LO: Name&quot; in notes. Replaces the current roster.
        </span>
      </label>
      <label className="field">
        <span className="field-label">Metros CSV</span>
        <input type="file" name="metros" accept=".csv,text/csv" />
        <span className="field-hint">
          Columns: name (loan officer, or &quot;A / B&quot; for a team), city, state, zip, latitude, longitude,
          radius_miles (max 100). Replaces the current metros.
        </span>
      </label>
      <div className="form-actions">
        <button className="btn" disabled={pending}>
          {pending ? "Saving…" : "Upload"}
        </button>
      </div>
    </form>
  );
}
