import "server-only";
import { documents } from "../store";
import { ValidationError } from "../validate";
import type { Metro, RosterAgent } from "./types";

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

function first(row: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return undefined;
}

/** "Jake Kurtz / Antonio Gonzalez" → ["Jake Kurtz", "Antonio Gonzalez"] */
export function splitNames(name: string): string[] {
  return name
    .split(/\s*(?:\/|&|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Accepts metros.csv rows (name, city, state, zip, latitude, longitude,
 * radius_miles) or the same fields as JSON.
 */
export function parseMetros(rows: Record<string, unknown>[]): Metro[] {
  const issues: string[] = [];
  const metros = rows.map((row, i) => {
    const name = first(row, "name", "loan_officer", "loanOfficer") ?? "";
    const latitude = Number(first(row, "latitude", "lat"));
    const longitude = Number(first(row, "longitude", "lng", "lon"));
    const radiusMiles = Number(first(row, "radius_miles", "radiusMiles", "radius") ?? 50);
    if (!name) issues.push(`row ${i + 2}: name is required`);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
      issues.push(`row ${i + 2}: latitude and longitude are required`);
    return {
      name,
      loanOfficers: splitNames(name),
      city: first(row, "city") ?? "",
      state: (first(row, "state") ?? "").toUpperCase(),
      zip: first(row, "zip", "zip_code", "zipCode"),
      latitude,
      longitude,
      // RentCast's radius search caps at 100 miles.
      radiusMiles: Math.min(100, Math.max(1, Number.isFinite(radiusMiles) ? radiusMiles : 50)),
    };
  });
  if (issues.length) throw new ValidationError(issues.slice(0, 20));
  return metros;
}

/**
 * Accepts roster.csv rows (full_name, city, state, zip_code, brokerage,
 * phone, email, notes). The loan officer comes from a `loan_officer` column,
 * or from "LO: <name>" inside notes.
 */
export function parseRoster(rows: Record<string, unknown>[]): RosterAgent[] {
  const issues: string[] = [];
  const agents = rows.map((row, i) => {
    const notes = first(row, "notes");
    const name = first(row, "full_name", "name", "agent_name", "agentName") ?? "";
    const loanOfficer =
      first(row, "loan_officer", "loanOfficer", "lo") ?? notes?.match(/\bLO:\s*([^;|\n]+)/i)?.[1]?.trim() ?? "";
    if (!name) issues.push(`row ${i + 2}: full_name is required`);
    if (!loanOfficer) issues.push(`row ${i + 2}: no loan officer (add a loan_officer column or "LO: Name" in notes)`);
    return {
      name,
      loanOfficer,
      brokerage: first(row, "brokerage", "office"),
      city: first(row, "city"),
      state: first(row, "state")?.toUpperCase(),
      zip: first(row, "zip_code", "zip", "zipCode"),
      phone: first(row, "phone"),
      email: first(row, "email"),
      notes,
    };
  });
  if (issues.length) throw new ValidationError(issues.slice(0, 20));
  return agents;
}

export async function getRoster(): Promise<RosterAgent[]> {
  return (await documents.get<RosterAgent[]>("roster")) ?? [];
}

export async function getMetros(): Promise<Metro[]> {
  return (await documents.get<Metro[]>("metros")) ?? [];
}

export async function saveRoster(agents: RosterAgent[]) {
  await documents.set("roster", agents);
}

export async function saveMetros(metros: Metro[]) {
  await documents.set("metros", metros);
}
