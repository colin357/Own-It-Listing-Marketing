import type { Metro, RosterAgent, SourceListing } from "./types";

/**
 * Matching a listing's agent to our roster. The roster only has names and
 * brokerages (no email/phone), so we match on name and use the brokerage and
 * location to decide how confident we are.
 */

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v", "pa", "realtor", "broker", "gri", "crs", "abr", "esq"]);

// Common nicknames, both directions are checked.
const NICKNAMES: Record<string, string[]> = {
  alexander: ["alex", "xander"],
  alexandra: ["alex", "lexi", "sandra"],
  andrew: ["andy", "drew"],
  anthony: ["tony"],
  barbara: ["barb"],
  benjamin: ["ben"],
  catherine: ["cathy", "kate", "katie", "cat"],
  katherine: ["kathy", "kate", "katie", "kat"],
  kathleen: ["kathy", "kate", "katie"],
  charles: ["charlie", "chuck"],
  christina: ["chris", "tina"],
  christine: ["chris", "tina"],
  christopher: ["chris"],
  daniel: ["dan", "danny"],
  david: ["dave"],
  deborah: ["deb", "debbie"],
  donald: ["don"],
  edward: ["ed", "eddie", "ted"],
  elizabeth: ["liz", "beth", "betsy", "lizzie", "eliza"],
  gregory: ["greg"],
  james: ["jim", "jimmy", "jamie"],
  jacob: ["jake"],
  jeffrey: ["jeff"],
  jennifer: ["jen", "jenn", "jenny"],
  jessica: ["jess", "jessie"],
  john: ["jack", "johnny"],
  jonathan: ["jon"],
  joseph: ["joe", "joey"],
  joshua: ["josh"],
  kimberly: ["kim"],
  lawrence: ["larry"],
  margaret: ["maggie", "peggy", "meg"],
  matthew: ["matt"],
  michael: ["mike", "mikey"],
  michelle: ["shelly"],
  nicholas: ["nick"],
  nicolas: ["nick"],
  pamela: ["pam"],
  patricia: ["pat", "patty", "tricia", "trish"],
  patrick: ["pat"],
  rebecca: ["becky", "becca"],
  richard: ["rick", "rich", "dick"],
  robert: ["rob", "bob", "bobby", "robbie"],
  ronald: ["ron"],
  samantha: ["sam"],
  samuel: ["sam"],
  stephanie: ["steph"],
  stephen: ["steve"],
  steven: ["steve"],
  susan: ["sue", "suzy"],
  theodore: ["ted", "teddy"],
  thomas: ["tom", "tommy"],
  timothy: ["tim"],
  victoria: ["vicky", "tori"],
  vincent: ["vince", "vinnie"],
  william: ["will", "bill", "billy", "liam"],
  zachary: ["zach", "zack", "zak"],
};

const NICK_GROUPS = new Map<string, Set<string>>();
for (const [full, nicks] of Object.entries(NICKNAMES)) {
  for (const n of [full, ...nicks]) {
    const set = NICK_GROUPS.get(n) ?? new Set<string>([n]);
    set.add(full);
    for (const m of nicks) set.add(m);
    NICK_GROUPS.set(n, set);
  }
}

function sameFirstName(a: string, b: string): "exact" | "nickname" | null {
  if (a === b) return "exact";
  if (NICK_GROUPS.get(a)?.has(b) || NICK_GROUPS.get(b)?.has(a)) return "nickname";
  return null;
}

export interface NameParts {
  first: string;
  last: string;
  /** Every normalized token, for hyphenated / double last names. */
  tokens: string[];
}

export function nameParts(name: string): NameParts | null {
  let s = name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  s = s.replace(/\([^)]*\)|"[^"]*"/g, " "); // nicknames in parentheses or quotes
  // "Smith, John" → "John Smith" (but not "John Smith, Jr")
  const comma = s.split(",");
  if (comma.length === 2 && !SUFFIXES.has(comma[1].trim().replace(/\./g, ""))) s = `${comma[1]} ${comma[0]}`;
  const tokens = s
    .replace(/[.'’]/g, "")
    .split(/[^a-z]+/)
    .filter((t) => t && !SUFFIXES.has(t));
  if (tokens.length < 2) return null;
  return { first: tokens[0], last: tokens[tokens.length - 1], tokens };
}

const LEGAL = new Set(["the", "of", "and", "llc", "inc", "co", "corp", "company", "ltd", "lp", "pllc", "re"]);
const BROKERAGE_STOPWORDS = new Set([
  ...LEGAL,
  "real", "estate", "realty", "realtors", "realtor", "group", "team", "properties", "property",
  "homes", "home", "brokerage", "brokers", "broker", "services", "international", "partners",
]);

/**
 * The brand part of a brokerage name: its first two significant words.
 * "Compass RE Texas, LLC - Austin" → compass, texas; "Real Broker, LLC" → real, broker.
 * Only the leading words count, so shared city names ("… Austin") don't look like a match.
 */
function brokerageTokens(name?: string): string[] {
  if (!name) return [];
  const words = name
    .toLowerCase()
    .replace(/\bre\s*\/?\s*max\b/g, "remax")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1);
  const significant = words.filter((t) => !BROKERAGE_STOPWORDS.has(t));
  // Names made only of generic words ("Real Broker") are their own brand.
  return (significant.length ? significant : words.filter((t) => !LEGAL.has(t))).slice(0, 2);
}

/** true / false when both brokerages are known, null when either is missing. */
export function sameBrokerage(a?: string, b?: string): boolean | null {
  const ta = brokerageTokens(a);
  const tb = brokerageTokens(b);
  if (!ta.length || !tb.length) return null;
  return ta.some((t) => tb.includes(t));
}

export function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

export interface Match {
  agent: RosterAgent;
  confidence: number;
  reason: string;
}

/** Confidence at or above this creates the kit automatically. */
export const AUTO_CONFIDENCE = 0.9;
/** Between this and AUTO_CONFIDENCE goes to the review queue; below is ignored. */
export const REVIEW_CONFIDENCE = 0.6;

function score(listing: SourceListing, a: NameParts, agent: RosterAgent, r: NameParts): Match | null {
  const lastMatch = a.last === r.last || a.tokens.includes(r.last) || r.tokens.includes(a.last);
  if (!lastMatch) return null;
  const first = sameFirstName(a.first, r.first);
  const initial = !first && a.first[0] === r.first[0];
  if (!first && !initial) return null;

  const office = sameBrokerage(listing.office?.name, agent.brokerage);
  let confidence = first === "exact" ? 0.9 : first === "nickname" ? 0.8 : 0.55;
  const nameWhy = first === "exact" ? "Exact name" : first === "nickname" ? "Nickname match" : "Same last name and initial";
  let officeWhy = "brokerage unknown";
  if (office === true) {
    confidence += 0.1;
    officeWhy = "same brokerage";
  } else if (office === false) {
    // Agents change brokerages, so a mismatch lowers confidence rather than ruling it out.
    confidence -= 0.25;
    officeWhy = `different brokerage (${listing.office?.name} vs ${agent.brokerage})`;
  }
  return { agent, confidence: Math.max(0, Math.min(1, confidence)), reason: `${nameWhy}, ${officeWhy}` };
}

/** Indexes the roster by last name for fast lookups. */
export function buildMatcher(roster: RosterAgent[], metros: Metro[]) {
  const byLast = new Map<string, { agent: RosterAgent; parts: NameParts }[]>();
  for (const agent of roster) {
    const parts = nameParts(agent.name);
    if (!parts) continue;
    for (const key of new Set([parts.last, ...parts.tokens.slice(1).filter((t) => t.length > 1)])) {
      const bucket = byLast.get(key) ?? [];
      bucket.push({ agent, parts });
      byLast.set(key, bucket);
    }
  }

  // Which metros each loan officer works, to keep matches local.
  const metrosByLo = new Map<string, Metro[]>();
  for (const m of metros)
    for (const lo of m.loanOfficers) {
      const key = lo.toLowerCase();
      metrosByLo.set(key, [...(metrosByLo.get(key) ?? []), m]);
    }

  const inMarket = (listing: SourceListing, agent: RosterAgent) => {
    const ms = metrosByLo.get(agent.loanOfficer.toLowerCase());
    if (!ms?.length || listing.latitude == null || listing.longitude == null) return true;
    return ms.some((m) => milesBetween(m.latitude, m.longitude, listing.latitude!, listing.longitude!) <= m.radiusMiles + 5);
  };

  /** Best roster match for a listing's agent, or null. */
  return function match(listing: SourceListing): Match | null {
    const a = nameParts(listing.agent.name);
    if (!a) return null;
    const candidates = new Map<RosterAgent, NameParts>();
    for (const key of new Set([a.last, ...a.tokens.slice(1).filter((t) => t.length > 1)]))
      for (const c of byLast.get(key) ?? []) candidates.set(c.agent, c.parts);

    const scored = [...candidates]
      .filter(([agent]) => inMarket(listing, agent))
      .map(([agent, parts]) => score(listing, a, agent, parts))
      .filter((m): m is Match => !!m && m.confidence >= REVIEW_CONFIDENCE)
      .sort((x, y) => y.confidence - x.confidence);
    if (!scored.length) return null;
    const [best, second] = scored;
    // Two different roster agents scoring the same: let a person decide.
    if (second && second.confidence === best.confidence && second.agent.loanOfficer !== best.agent.loanOfficer)
      return {
        ...best,
        confidence: Math.min(best.confidence, AUTO_CONFIDENCE - 0.01),
        reason: `${best.reason}; also matches ${second.agent.name} (LO ${second.agent.loanOfficer})`,
      };
    return best;
  };
}
