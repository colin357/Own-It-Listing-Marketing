"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button that shows it's working while its form's server action runs.
 * With several buttons in one form, only the one that was pressed (matched by
 * name/value) shows the pending text; the others are just disabled.
 */
export function PendingButton({
  children,
  pendingText,
  note,
  name,
  value,
  className = "btn btn-small",
  disabled,
}: {
  children: React.ReactNode;
  pendingText: string;
  /** Shown under the button while it runs, e.g. how long to expect. */
  note?: string;
  name?: string;
  value?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending, data } = useFormStatus();
  const mine = pending && (!name || data?.get(name) === value);
  return (
    <span className="pending-wrap">
      <button className={className} name={name} value={value} disabled={disabled || pending} aria-busy={mine}>
        {mine ? (
          <>
            <span className="spinner" aria-hidden /> {pendingText}
          </>
        ) : (
          children
        )}
      </button>
      {mine && note ? (
        <span className="pending-note small" role="status">
          {note}
        </span>
      ) : null}
    </span>
  );
}
