import { firstName, streetLine } from "./format";
import { programOptions } from "./mortgage";
import { buyerPagePath } from "./site";
import type { Listing, LoanOfficer } from "./types";

/**
 * The email a loan officer sends a listing agent with their kit (or, for an
 * agent with several new listings, all their kits in one email).
 *
 * The words live in one place (emailParts) and come out two ways:
 * - HTML with real <a> links (agentEmailHtml). This is what loan officers
 *   send, from the "Email kit" page: as an Outlook draft file or copied and
 *   pasted. Real links are clickable in every mail app on every device.
 * - Plain text (agentEmailBody), for the .eml / clipboard text fallback and
 *   the mailto: draft. A plain-text link is only clickable if the agent's mail
 *   app decides to linkify it, which desktop Outlook and others often don't.
 */

const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Step = { label: string; text: string; url?: string };
type Part =
  | { kind: "p"; text: string }
  | { kind: "link"; heading?: string; text?: string; url: string }
  | { kind: "homes"; heading: string; homes: { name: string; links: { label: string; url: string }[] }[] }
  | { kind: "steps"; heading: string; steps: Step[]; short: string };

const forSale = (l: Listing) => l.status !== "just-sold" && l.status !== "under-contract";
// The seller credit section only shows on kits that show payments.
const hasSellerCredit = (l: Listing, lo: LoanOfficer | null) =>
  forSale(l) && !!lo && !!programOptions({ ...l, concession: undefined }, lo);

function emailParts(ls: Listing[], lo: LoanOfficer | null, origin: string): Part[] {
  const who = firstName(ls[0].agent.name);
  const hi: Part = { kind: "p", text: `Hi${who ? ` ${who}` : ""},` };
  const bye: Part = { kind: "p", text: "Let me know if you'd like anything changed. And send any buyers with financing questions my way!" };
  const payments = lo?.showPayments === false ? "" : " and payments";
  const short =
    "Each kit has social posts with captions, a printable flyer, a buyer page to text or post, and ready-to-send emails, plus a Download all button.";

  if (ls.length === 1) {
    const l = ls[0];
    const kitUrl = `${origin}/l/${l.slug}`;
    return [
      hi,
      {
        kind: "p",
        text:
          l.status === "just-listed"
            ? `Congrats on your new listing at ${streetLine(l)}! I put together a free marketing kit for it, made for this home and ready to post, print or send.`
            : `I put together a free marketing kit for your listing at ${streetLine(l)}, made for this home and ready to post, print or send.`,
      },
      { kind: "link", heading: "YOUR KIT", url: kitUrl },
      ...(l.photos.length
        ? []
        : [{ kind: "p" as const, text: "We couldn't find your listing photos yet. Add them at the top of the kit and every graphic updates." }]),
      {
        kind: "steps",
        heading: "HOW TO USE IT",
        short,
        steps: [
          { label: "Social posts", text: "Save a post or story and share it on Instagram, Facebook or LinkedIn. Captions are written for you, just tap Copy." },
          { label: "Flyers", text: "Print the flyer for showings and open houses. The QR code takes buyers to the home's page." },
          {
            label: "Buyer page",
            text: `Text or post this link. Buyers see photos, details${payments}, and can call you for a tour in one tap:`,
            url: `${origin}${buyerPagePath(l.slug)}`,
          },
          ...(hasSellerCredit(l, lo)
            ? [{ label: "Seller credit", text: "If your seller will help with buyer costs, pick an option and every graphic and flyer updates to show the lower payment." }]
            : []),
          { label: "Emails", text: "Ready-to-send emails for your sphere and buyers are at the bottom of the kit." },
        ],
      },
      { kind: "link", text: "Download everything at once:", url: `${kitUrl}/download` },
      bye,
    ];
  }

  const missingPhotos = ls.filter((l) => !l.photos.length);
  return [
    hi,
    {
      kind: "p",
      text: ls.some((l) => l.status === "just-listed")
        ? `Congrats on your new listings! I put together a free marketing kit for each of your ${ls.length} homes, made for that home and ready to post, print or send.`
        : `I put together a free marketing kit for each of your ${ls.length} listings, made for that home and ready to post, print or send.`,
    },
    {
      kind: "homes",
      heading: "YOUR KITS",
      homes: ls.map((l) => ({
        name: streetLine(l),
        links: [
          { label: "Kit", url: `${origin}/l/${l.slug}` },
          { label: "Buyer page", url: `${origin}${buyerPagePath(l.slug)}` },
        ],
      })),
    },
    ...(missingPhotos.length
      ? [{ kind: "p" as const, text: `We couldn't find listing photos for ${missingPhotos.map(streetLine).join(", ")} yet. Add them at the top of that kit and every graphic updates.` }]
      : []),
    {
      kind: "steps",
      heading: "HOW TO USE THEM",
      short,
      steps: [
        { label: "Social posts", text: "Save a post or story and share it on Instagram, Facebook or LinkedIn. Captions are written for you, just tap Copy." },
        { label: "Flyers", text: "Print the flyer for showings and open houses. The QR code takes buyers to the home's page." },
        { label: "Buyer pages", text: `Text or post the buyer page link for each home. Buyers see photos, details${payments}, and can call you for a tour in one tap.` },
        ...(ls.some((l) => hasSellerCredit(l, lo))
          ? [{ label: "Seller credit", text: "If a seller will help with buyer costs, pick an option on that kit and every graphic and flyer updates to show the lower payment." }]
          : []),
        { label: "Emails", text: "Ready-to-send emails for your sphere and buyers are at the bottom of each kit." },
        { label: "Download", text: "Each kit has a Download all button to save everything at once." },
      ],
    },
    bye,
  ];
}

function toText(parts: Part[], opts: { shortGuide?: boolean; buyerLinks?: boolean } = {}): string {
  return parts
    .map((p) => {
      switch (p.kind) {
        case "p":
          return p.text;
        case "link":
          return [p.heading, p.text, p.url].filter(Boolean).join("\n");
        case "homes":
          return `${p.heading}\n\n${p.homes
            .map(
              (h, i) =>
                `${i + 1}. ${h.name}\n` +
                h.links
                  .filter((k) => opts.buyerLinks !== false || k.label === "Kit")
                  .map((k) => `${k.label}: ${k.url}`)
                  .join("\n"),
            )
            .join("\n\n")}`;
        case "steps":
          if (opts.shortGuide) return p.short;
          return `${p.heading}\n\n${p.steps.map((s, i) => `${i + 1}. ${s.label}: ${s.text}${s.url ? `\n${s.url}` : ""}`).join("\n\n")}`;
      }
    })
    .join("\n\n");
}

const encodedBodyLength = (body: string) => encodeURIComponent(body.replace(/\n/g, "\r\n")).length;

/**
 * Longest encoded multi-listing body before it's cut down. Some mail apps
 * (Outlook for Windows) drop mailto: links much over 2,000 characters, and the
 * address and subject take up to ~150 more.
 */
const GROUP_BODY_MAX = 1850;

/**
 * Plain text of the email: short CAPS headings, numbered steps, links on their
 * own lines. For several listings, if it would be too long for a mailto: link,
 * the guide is cut to one line (then buyer page links dropped) so every kit
 * link still fits.
 */
export function agentEmailBody(ls: Listing | Listing[], lo: LoanOfficer | null, origin: string): string {
  const list = Array.isArray(ls) ? ls : [ls];
  const parts = emailParts(list, lo, origin);
  if (list.length === 1) return toText(parts);
  const tries = [toText(parts), toText(parts, { shortGuide: true }), toText(parts, { shortGuide: true, buyerLinks: false })];
  return tries.find((b) => encodedBodyLength(b) <= GROUP_BODY_MAX) ?? tries[tries.length - 1];
}

/**
 * The same email as HTML, with every link a real <a> link (link text is the
 * address itself, so it reads the same as the plain version). Plain inline
 * styles only, so it survives being pasted into a draft or opened from an .eml.
 */
export function agentEmailHtml(ls: Listing | Listing[], lo: LoanOfficer | null, origin: string): string {
  const list = Array.isArray(ls) ? ls : [ls];
  const font = "font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#0a0a0a";
  const p = (inner: string) => `<p style="margin:0 0 14px;${font}">${inner}</p>`;
  const a = (url: string) => `<a href="${esc(url)}" style="color:#0a58ca;text-decoration:underline">${esc(url)}</a>`;
  const li = (inner: string) => `<li style="margin:0 0 10px;${font}">${inner}</li>`;
  const ol = (items: string) => `<ol style="margin:0 0 14px;padding:0 0 0 22px">${items}</ol>`;
  return emailParts(list, lo, origin)
    .map((part) => {
      switch (part.kind) {
        case "p":
          return p(esc(part.text));
        case "link":
          return p(
            [part.heading ? `<strong>${esc(part.heading)}</strong>` : "", part.text ? esc(part.text) : "", a(part.url)]
              .filter(Boolean)
              .join("<br>"),
          );
        case "homes":
          return (
            p(`<strong>${esc(part.heading)}</strong>`) +
            ol(
              part.homes
                .map((h) => li(`<strong>${esc(h.name)}</strong>${h.links.map((k) => `<br>${esc(k.label)}: ${a(k.url)}`).join("")}`))
                .join(""),
            )
          );
        case "steps":
          return (
            p(`<strong>${esc(part.heading)}</strong>`) +
            ol(part.steps.map((s) => li(`<strong>${esc(s.label)}:</strong> ${esc(s.text)}${s.url ? `<br>${a(s.url)}` : ""}`)).join(""))
          );
      }
    })
    .join("\n");
}

export function agentEmailSubject(ls: Listing | Listing[]): string {
  const list = Array.isArray(ls) ? ls : [ls];
  return list.length === 1 ? `Your marketing kit for ${streetLine(list[0])}` : `Marketing kits for your ${list.length} listings`;
}

/** The agent email address we'd send to: the first usable one across their listings. */
export function agentEmailAddress(ls: Listing | Listing[]): string | null {
  const list = Array.isArray(ls) ? ls : [ls];
  return list.map((l) => l.agent.email?.trim() ?? "").find((e) => EMAIL_RE.test(e)) ?? null;
}

/** mailto: link. Leave body out to open an empty draft (To and Subject only) to paste into. */
export function mailtoHref(to: string | null, subject: string, body?: string): string {
  // encodeURIComponent (not URLSearchParams) so spaces become %20, which every mail app reads.
  const addr = to ? encodeURIComponent(to).replace(/%40/g, "@") : "";
  return `mailto:${addr}?subject=${encodeURIComponent(subject)}${
    body === undefined ? "" : `&body=${encodeURIComponent(body.replace(/\n/g, "\r\n"))}`
  }`;
}

/**
 * The "Email kit" page for one listing, or for several of one agent's listings
 * (the first slug in the path, the rest in ?with=). It shows the email with
 * real links and lets the loan officer send it from their own mail app.
 */
export function agentEmailPagePath(ls: Listing | Listing[]): string {
  const list = Array.isArray(ls) ? ls : [ls];
  const rest = list.slice(1).map((l) => l.slug);
  return `/l/${list[0].slug}/email-agent${rest.length ? `?with=${rest.map(encodeURIComponent).join(",")}` : ""}`;
}

/**
 * Listings grouped by listing agent (same name, or same email when there's no
 * name), agents in alphabetical order and each agent's homes by address.
 */
export function groupByAgent(ls: Listing[]): Listing[][] {
  const key = (l: Listing) =>
    l.agent.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() || (l.agent.email ?? "").trim().toLowerCase() || l.slug;
  const groups = new Map<string, Listing[]>();
  for (const l of ls) groups.set(key(l), [...(groups.get(key(l)) ?? []), l]);
  return [...groups.values()]
    .map((g) => g.sort((a, b) => a.address.localeCompare(b.address)))
    .sort((a, b) => a[0].agent.name.localeCompare(b[0].agent.name) || a[0].address.localeCompare(b[0].address));
}
