import type { Metro, RosterAgent } from "./types";

function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** The saved roster as a CSV in the same columns the upload accepts. */
export function rosterCsv(agents: RosterAgent[]): string {
  return toCsv(
    ["full_name", "loan_officer", "brokerage", "city", "state", "zip_code", "phone", "email", "headshot_url", "notes"],
    agents.map((a) => [a.name, a.loanOfficer, a.brokerage, a.city, a.state, a.zip, a.phone, a.email, a.headshotUrl, a.notes]),
  );
}

/** The saved metros as a CSV, one row per search area, in the columns the upload accepts. */
export function metrosCsv(metros: Metro[]): string {
  return toCsv(
    ["name", "city", "state", "zip", "latitude", "longitude", "radius_miles"],
    metros.map((m) => [m.name, m.city, m.state, m.zip, m.latitude, m.longitude, m.radiusMiles]),
  );
}
