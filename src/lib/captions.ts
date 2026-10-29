import type { Listing, LoanOfficer } from "./types";
import {
  cityLine,
  formatOpenHouse,
  formatPrice,
  fullAddress,
  paymentInfo,
  statsLine,
  streetLine,
} from "./format";
import { activeConcession, concessionSentence } from "./concessions";

export interface Caption {
  id: string;
  label: string;
  text: string;
}

const HEADLINES: Record<Listing["status"], string> = {
  "coming-soon": "🔜 COMING SOON",
  "just-listed": "🏡 JUST LISTED",
  "open-house": "🚪 OPEN HOUSE",
  "price-improved": "📉 PRICE IMPROVED",
  "under-contract": "✍️ UNDER CONTRACT",
  "just-sold": "🎉 JUST SOLD",
};

const STATUS_TAGS: Record<Listing["status"], string> = {
  "coming-soon": "#ComingSoon",
  "just-listed": "#JustListed",
  "open-house": "#OpenHouse",
  "price-improved": "#PriceImprovement",
  "under-contract": "#UnderContract",
  "just-sold": "#JustSold",
};

function hashtags(l: Listing): string {
  const city = l.city.replace(/[^a-zA-Z]/g, "");
  const tags = [
    `#${city}RealEstate`,
    `#${city}Homes`,
    STATUS_TAGS[l.status],
    "#HomeForSale",
    "#RealEstate",
    "#NewListing",
    "#Homebuying",
    "#DreamHome",
  ];
  if (l.status === "just-sold") tags.splice(3, 3, "#Sold", "#ClosingDay");
  return [...new Set(tags)].join(" ");
}

function callToAction(l: Listing): string {
  const agentContact = [l.agent.phone, l.agent.email].filter(Boolean).join(" | ");
  switch (l.status) {
    case "just-sold":
      return `Thinking about buying or selling? Let's talk! ${agentContact}`.trim();
    case "under-contract":
      return `More homes like this are coming — reach out to get ahead of the next one. ${agentContact}`.trim();
    default:
      return `📲 DM me or call ${l.agent.phone ?? "me"} to schedule a private showing.`;
  }
}

function financingLine(l: Listing, lo: LoanOfficer): string | null {
  if (l.status === "just-sold") return null;
  const pay = paymentInfo(l, lo);
  const who = `${lo.name}${lo.company ? ` with ${lo.company}` : ""}`;
  return pay
    ? `💰 Estimated payment: ${pay.label} — financing questions? ${who} (NMLS #${lo.nmls}) can get you pre-approved fast.`
    : `💰 Financing questions? ${who} (NMLS #${lo.nmls}) can get you pre-approved fast.`;
}

/** "🎁 The seller is offering $10,000 toward a 2-1 rate buydown…" */
function creditLine(l: Listing): string | null {
  const c = activeConcession(l);
  return c ? `🎁 ${concessionSentence(c)} Ask me how it works!` : null;
}

export function buildCaptions(l: Listing, lo: LoanOfficer): Caption[] {
  const headline = HEADLINES[l.status];
  const stats = statsLine(l, " | ");
  const oh = formatOpenHouse(l);
  const fin = financingLine(l, lo);
  const highlights = l.highlights.slice(0, 4).map((h) => `✔️ ${h}`).join("\n");
  const pay = paymentInfo(l, lo);
  const credit = creditLine(l);
  const c = activeConcession(l);

  const instagram = [
    `${headline} 📍 ${streetLine(l)}, ${l.city}`,
    "",
    `${formatPrice(l.price)}${stats ? ` | ${stats}` : ""}`,
    oh ? `\n🗓️ ${oh}` : null,
    highlights ? `\n${highlights}` : null,
    credit ? `\n${credit}` : null,
    "",
    callToAction(l),
    fin ? `\n${fin}` : null,
    pay ? `\n${pay.disclaimer}` : null,
    "",
    hashtags(l),
  ]
    .filter((x) => x != null)
    .join("\n");

  const facebook = [
    `${headline}: ${fullAddress(l)}`,
    "",
    l.description ?? `Don't miss this ${stats.toLowerCase() || "home"} in ${l.city}, offered at ${formatPrice(l.price)}.`,
    oh ? `\nJoin us for an open house ${oh}.` : null,
    highlights ? `\n${highlights}` : null,
    credit ? `\n${credit}` : null,
    l.listingUrl ? `\nFull details & photos: ${l.listingUrl}` : null,
    "",
    callToAction(l),
    fin ? `\n${fin}` : null,
    pay ? `\n${pay.disclaimer}` : null,
  ]
    .filter((x) => x != null)
    .join("\n");

  const linkedin = [
    `${HEADLINES[l.status].replace(/^\S+\s/, "")} in ${l.city}: ${streetLine(l)}`,
    "",
    `${formatPrice(l.price)}${stats ? ` · ${stats}` : ""}`,
    "",
    l.status === "just-sold"
      ? `Proud to have helped make this one happen in partnership with ${lo.name} of ${lo.company}. If you or someone you know is thinking about a move, I'd love to help.`
      : `Proud to partner with ${lo.name} of ${lo.company} on financing for this listing. If you know someone looking in ${l.city}, I'd appreciate the introduction.`,
    l.listingUrl ? `\n${l.listingUrl}` : null,
  ]
    .filter((x) => x != null)
    .join("\n");

  const text = [
    `${headline.replace(/^\S+\s/, "")}: ${streetLine(l)}, ${cityLine(l)} — ${formatPrice(l.price)}${stats ? ` (${stats})` : ""}.`,
    oh ? `Open house ${oh}.` : null,
    c ? concessionSentence(c) : null,
    l.listingUrl ? `Details: ${l.listingUrl}` : null,
    l.status !== "just-sold" ? `Want to see it? Reply and I'll set up a showing!` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    { id: "instagram", label: "Instagram", text: instagram },
    { id: "facebook", label: "Facebook", text: facebook },
    { id: "linkedin", label: "LinkedIn", text: linkedin },
    { id: "text", label: "Text message", text },
  ].map((c) => ({ ...c, text: c.text.replace(/\n{3,}/g, "\n\n").trim() }));
}
