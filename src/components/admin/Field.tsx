import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({
  label,
  hint,
  children,
  wide,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`field${wide ? " field-wide" : ""}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function TextInput({
  label,
  hint,
  wide,
  values,
  name,
  ...rest
}: {
  label: string;
  hint?: ReactNode;
  wide?: boolean;
  values: Record<string, string>;
  name: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} wide={wide}>
      <input name={name} defaultValue={values[name] ?? ""} {...rest} />
    </Field>
  );
}

export function FormErrors({ issues }: { issues?: string[] }) {
  if (!issues?.length) return null;
  return (
    <div className="alert alert-error" role="alert">
      <strong>Please fix the following:</strong>
      <ul>
        {issues.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
