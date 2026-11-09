import "server-only";

/**
 * Address autocomplete for the loan officer "build a kit" page.
 *
 * Uses Google Places (best coverage of new streets and new construction) when
 * GOOGLE_MAPS_API_KEY is set, otherwise Photon (photon.komoot.io), a free
 * OpenStreetMap geocoder that needs no key. Either way a suggestion only fills
 * the address box: the LO can still type any address by hand.
 */

export interface AddressSuggestion {
  /** "5724 Gabe Moultrie Dr, Ravenel, SC 29470" when the ZIP is known. */
  label: string;
  /** Google place id; the ZIP is looked up when the LO picks it. */
  placeId?: string;
}

export interface Bias {
  latitude: number;
  longitude: number;
}

const TIMEOUT = 3000;

const STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT",
  delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT",
  nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  "puerto rico": "PR",
};

const stateCode = (s?: string) => (s ? (STATES[s.toLowerCase()] ?? (s.length === 2 ? s.toUpperCase() : s)) : "");

/** "5724 Gabe Moultrie Dr" + "Ravenel" + "SC" + "29470" → "5724 Gabe Moultrie Dr, Ravenel, SC 29470". */
export function formatAddress(street: string, city?: string, state?: string, zip?: string): string {
  const tail = [stateCode(state), (zip ?? "").slice(0, 5)].filter(Boolean).join(" ");
  return [street, city, tail].filter(Boolean).join(", ");
}

export function suggestProvider(): "google" | "photon" {
  return process.env.GOOGLE_MAPS_API_KEY ? "google" : "photon";
}

export async function suggestAddresses(query: string, bias?: Bias, session?: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const key = process.env.GOOGLE_MAPS_API_KEY;
  return key ? googleSuggest(key, q, bias, session) : photonSuggest(q, bias);
}

// ---------- Google Places (New) ----------

interface GoogleAutocomplete {
  suggestions?: { placePrediction?: { placeId: string; text?: { text: string } } }[];
}

async function googleSuggest(key: string, input: string, bias?: Bias, session?: string): Promise<AddressSuggestion[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
    body: JSON.stringify({
      input,
      includedRegionCodes: ["us"],
      includedPrimaryTypes: ["street_address", "premise", "subpremise"],
      ...(session ? { sessionToken: session } : {}),
      ...(bias
        ? { locationBias: { circle: { center: { latitude: bias.latitude, longitude: bias.longitude }, radius: 50000 } } }
        : {}),
    }),
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google autocomplete ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as GoogleAutocomplete;
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is { placeId: string; text: { text: string } } => !!p?.text?.text)
    .map((p) => ({ label: p.text.text.replace(/, USA$/, ""), placeId: p.placeId }));
}

interface GoogleComponent {
  shortText?: string;
  longText?: string;
  types?: string[];
}

/** The picked Google suggestion as a full address with ZIP (the suggestion text has none). */
export async function resolvePlace(placeId: string, session?: string): Promise<string | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || !/^[\w-]+$/.test(placeId)) return null;
  const qs = session ? `?sessionToken=${encodeURIComponent(session)}` : "";
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}${qs}`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "addressComponents" },
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google place ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const parts = ((await res.json()) as { addressComponents?: GoogleComponent[] }).addressComponents ?? [];
  const get = (type: string, short = true) => {
    const c = parts.find((p) => p.types?.includes(type));
    return (short ? c?.shortText : c?.longText) ?? "";
  };
  const street = [get("street_number"), get("route")].filter(Boolean).join(" ");
  if (!street) return null;
  const unit = get("subpremise");
  const city = get("locality", false) || get("sublocality", false) || get("postal_town", false);
  return formatAddress(unit ? `${street} #${unit}` : street, city, get("administrative_area_level_1"), get("postal_code"));
}

// ---------- Photon (OpenStreetMap) ----------

interface PhotonFeature {
  properties: {
    housenumber?: string;
    street?: string;
    name?: string;
    city?: string;
    town?: string;
    village?: string;
    district?: string;
    state?: string;
    postcode?: string;
    countrycode?: string;
    type?: string;
  };
}

async function photonSuggest(q: string, bias?: Bias): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({ q, limit: "8", lang: "en" });
  params.append("layer", "house");
  if (bias) {
    params.set("lat", String(bias.latitude));
    params.set("lon", String(bias.longitude));
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, {
    headers: { "User-Agent": "listing-kits/1.0 (address autocomplete)" },
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Photon ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { features = [] } = (await res.json()) as { features?: PhotonFeature[] };
  const seen = new Set<string>();
  const out: AddressSuggestion[] = [];
  for (const { properties: p } of features) {
    if (p.countrycode && p.countrycode !== "US") continue;
    if (!p.housenumber || !p.street) continue;
    const label = formatAddress(`${p.housenumber} ${p.street}`, p.city ?? p.town ?? p.village ?? p.district, p.state, p.postcode);
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label });
  }
  return out.slice(0, 5);
}
