import "server-only";
// @ts-expect-error: zipcodes ships without types.
import zipcodes from "zipcodes";

export interface ZipInfo {
  zip: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
}

/** Centre point, city and state for a US zip code, from a bundled table (no network). */
export function lookupZip(zip: string): ZipInfo | null {
  const z = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(z)) return null;
  const r = zipcodes.lookup(z) as
    | { zip: string; latitude: number; longitude: number; city: string; state: string; country: string }
    | undefined;
  if (!r || r.country !== "US" || !Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) return null;
  return { zip: z, latitude: r.latitude, longitude: r.longitude, city: r.city, state: r.state };
}

/** "75034; 75007 | 78750" or "75034, 75007" → ["75034", "75007", "78750"] */
export function splitZips(value: string | undefined): string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(/[\s,;|/]+/)
        .map((z) => z.trim())
        .filter(Boolean)
        // Spreadsheets drop leading zeros (02108 → 2108).
        .map((z) => (/^\d{3,4}$/.test(z) ? z.padStart(5, "0") : z)),
    ),
  ];
}
