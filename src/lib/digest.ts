import "server-only";
import { isActive } from "./plan";
import { detections, listings, loanOfficers } from "./store";
import { firstName, formatPrice, statsLine, streetLine } from "./format";
import { programOptions } from "./mortgage";
import { buyerPagePath } from "./site";
import { mailConfigured, sendMail, type Mail } from "./mail";
import type { Detection } from "./detect/types";
import { sameHome } from "./detect/dedupe";
import type { Listing, LoanOfficer } from "./types";

/**
 * After each detection run, every loan officer gets one email listing the new
 * kits for their agents, with links and a message to forward to each agent.
 * A kit is emailed once (Detection.emailedAt), and a home is emailed to a
 * loan officer once even if it has two kits (see detect/dedupe.ts). A kit
 * with no listing photos isn't emailed: it waits, unsent, and goes out in the
 * first email after its photos arrive (from Zillow or the agent's upload).
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface Digest {
  lo: LoanOfficer;
  kits: { det: Detection; listing: Listing }[];
  subject: string;
  html: string;
}

function agentMessage(l: Listing, kitUrl: string): string {
  const who = firstName(l.agent.name);
  return `Hi${who ? ` ${who}` : ""}, congrats on ${streetLine(l)}! I put together a free marketing kit for it: social posts, flyers, captions and emails, all ready to download. ${kitUrl}`;
}

const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

/**
 * Plain-text body of the kit email to the listing agent. A mailto: draft can't
 * carry HTML, so it's laid out with short CAPS headings, numbered steps and
 * links on their own lines (mail apps turn those into tappable links). It tells
 * the agent what each part of the kit is for and how to use it.
 */
export function agentEmailBody(l: Listing, lo: LoanOfficer | null, origin: string): string {
  const kitUrl = `${origin}/l/${l.slug}`;
  const who = firstName(l.agent.name);
  const forSale = l.status !== "just-sold" && l.status !== "under-contract";
  // The seller credit section only shows on kits that show payments.
  const sellerCredit = forSale && !!lo && !!programOptions({ ...l, concession: undefined }, lo);
  const steps = [
    `Social posts: Save a post or story and share it on Instagram, Facebook or LinkedIn. Captions are written for you, just tap Copy.`,
    `Flyers: Print the flyer for showings and open houses. The QR code takes buyers to the home's page.`,
    `Buyer page: Text or post this link. Buyers see photos, details${lo?.showPayments === false ? "" : " and payments"}, and can call you for a tour in one tap:\n${origin}${buyerPagePath(l.slug)}`,
    ...(sellerCredit
      ? [`Seller credit: If your seller will help with buyer costs, pick an option and every graphic and flyer updates to show the lower payment.`]
      : []),
    `Emails: Ready-to-send emails for your sphere and buyers are at the bottom of the kit.`,
  ];
  return [
    `Hi${who ? ` ${who}` : ""},`,
    l.status === "just-listed"
      ? `Congrats on your new listing at ${streetLine(l)}! I put together a free marketing kit for it, made for this home and ready to post, print or send.`
      : `I put together a free marketing kit for your listing at ${streetLine(l)}, made for this home and ready to post, print or send.`,
    `YOUR KIT\n${kitUrl}`,
    ...(l.photos.length
      ? []
      : [`We couldn't find your listing photos yet. Add them at the top of the kit and every graphic updates.`]),
    `HOW TO USE IT\n\n${steps.map((t, i) => `${i + 1}. ${t}`).join("\n\n")}`,
    `Download everything at once:\n${kitUrl}/download`,
    `Let me know if you'd like anything changed. And send any buyers with financing questions my way!`,
  ].join("\n\n");
}

/**
 * Plain-text body of one email to an agent with several new listings in the
 * same batch: every kit's links first, then one how-to-use guide that covers
 * them all. If the draft would get too long for a mailto: link (lots of
 * listings), the guide is cut down to one line so every kit link still fits.
 */
export function agentGroupEmailBody(ls: Listing[], lo: LoanOfficer | null, origin: string): string {
  if (ls.length === 1) return agentEmailBody(ls[0], lo, origin);
  const who = firstName(ls[0].agent.name);
  const anyNew = ls.some((l) => l.status === "just-listed");
  const sellerCredit =
    !!lo &&
    ls.some(
      (l) =>
        l.status !== "just-sold" && l.status !== "under-contract" && !!programOptions({ ...l, concession: undefined }, lo),
    );
  const kits = (buyerLinks: boolean) =>
    ls
      .map(
        (l, i) =>
          `${i + 1}. ${streetLine(l)}\nKit: ${origin}/l/${l.slug}` +
          (buyerLinks ? `\nBuyer page: ${origin}${buyerPagePath(l.slug)}` : ""),
      )
      .join("\n\n");
  const missingPhotos = ls.filter((l) => !l.photos.length);
  const steps = [
    `Social posts: Save a post or story and share it on Instagram, Facebook or LinkedIn. Captions are written for you, just tap Copy.`,
    `Flyers: Print the flyer for showings and open houses. The QR code takes buyers to the home's page.`,
    `Buyer pages: Text or post the buyer page link for each home. Buyers see photos, details${lo?.showPayments === false ? "" : " and payments"}, and can call you for a tour in one tap.`,
    ...(sellerCredit
      ? [`Seller credit: If a seller will help with buyer costs, pick an option on that kit and every graphic and flyer updates to show the lower payment.`]
      : []),
    `Emails: Ready-to-send emails for your sphere and buyers are at the bottom of each kit.`,
    `Download: Each kit has a Download all button to save everything at once.`,
  ];
  const build = (guide: string, buyerLinks = true) =>
    [
      `Hi${who ? ` ${who}` : ""},`,
      anyNew
        ? `Congrats on your new listings! I put together a free marketing kit for each of your ${ls.length} homes, made for that home and ready to post, print or send.`
        : `I put together a free marketing kit for each of your ${ls.length} listings, made for that home and ready to post, print or send.`,
      `YOUR KITS\n\n${kits(buyerLinks)}`,
      ...(missingPhotos.length
        ? [`We couldn't find listing photos for ${missingPhotos.map(streetLine).join(", ")} yet. Add them at the top of that kit and every graphic updates.`]
        : []),
      guide,
      `Let me know if you'd like anything changed. And send any buyers with financing questions my way!`,
    ].join("\n\n");
  const short = `Each kit has social posts with captions, a printable flyer, a buyer page to text or post, and ready-to-send emails, plus a Download all button.`;
  const tries = [
    build(`HOW TO USE THEM\n\n${steps.map((t, i) => `${i + 1}. ${t}`).join("\n\n")}`),
    build(short),
    build(short, false),
  ];
  return tries.find((b) => encodedBodyLength(b) <= GROUP_BODY_MAX) ?? tries[tries.length - 1];
}

const encodedBodyLength = (body: string) => encodeURIComponent(body.replace(/\n/g, "\r\n")).length;

/**
 * Longest encoded multi-listing body before it's cut down. Some mail apps
 * (Outlook for Windows) drop mailto: links much over 2,000 characters, and the
 * address and subject take up to ~150 more.
 */
const GROUP_BODY_MAX = 1850;

function mailtoHref(email: string, subject: string, body: string): { href: string; hasEmail: boolean } {
  const hasEmail = EMAIL_RE.test(email);
  // encodeURIComponent (not URLSearchParams) so spaces become %20, which every mail app reads.
  const to = hasEmail ? encodeURIComponent(email).replace(/%40/g, "@") : "";
  const href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, "\r\n"))}`;
  return { href, hasEmail };
}

/** The agent email address we'd send to: the first usable one across their listings. */
function agentEmail(ls: Listing[]): string {
  return ls.map((l) => l.agent.email?.trim() ?? "").find((e) => EMAIL_RE.test(e)) ?? "";
}

/**
 * A mailto: link that opens a ready-to-send email to the listing agent in the
 * loan officer's own mail app, so the agent sees it come from the loan officer.
 * When we don't have a usable agent email, the draft opens with an empty To line.
 */
export function agentMailto(l: Listing, lo: LoanOfficer | null, origin: string): { href: string; hasEmail: boolean } {
  return mailtoHref(l.agent.email?.trim() ?? "", `Your marketing kit for ${streetLine(l)}`, agentEmailBody(l, lo, origin));
}

/** One mailto: draft to an agent covering all of their listings in this email. */
export function agentGroupMailto(ls: Listing[], lo: LoanOfficer | null, origin: string): { href: string; hasEmail: boolean } {
  if (ls.length === 1) return agentMailto(ls[0], lo, origin);
  return mailtoHref(agentEmail(ls), `Marketing kits for your ${ls.length} listings`, agentGroupEmailBody(ls, lo, origin));
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

/**
 * "Bulletproof" button: a plain table cell carries the colour and border, and
 * the link inside carries the padding. No inline-block div wrappers or conditional
 * comments, which Outlook on the web and Outlook for Windows mangle.
 */
function button(href: string, label: string, primary: boolean): string {
  const bg = primary ? "#0a0a0a" : "#ffffff";
  const fg = primary ? "#ffffff" : "#0a0a0a";
  // mailto: links open the mail app; target="_blank" makes some webmail open an empty tab too.
  const target = href.startsWith("mailto:") ? "" : ' target="_blank"';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate"><tr>
      <td align="center" bgcolor="${bg}" style="background-color:${bg};border:2px solid #0a0a0a;border-radius:6px;mso-padding-alt:11px 20px">
        <a href="${esc(href)}"${target} style="display:inline-block;padding:11px 20px;color:${fg};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;font-weight:700;text-decoration:none">${label}</a>
      </td></tr></table>`;
}

/**
 * The main "Email kit" button and its note, then the two smaller buttons
 * side by side in a two-cell table, which fits a phone without wrapping.
 */
function buttonRows(primary: string, note: string, secondary: string[]): string {
  const cells = secondary
    .map((b, i) => `<td valign="top" style="padding:0 ${i < secondary.length - 1 ? 8 : 0}px 0 0">${b}</td>`)
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 8px">
      <tr><td style="padding:0 0 6px">${primary}</td></tr>
      <tr><td style="padding:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;color:#5b5b5b">${note}</td></tr>
      <tr><td><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table></td></tr>
    </table>`;
}

function kitCard(l: Listing, lo: LoanOfficer, origin: string): string {
  const kitUrl = `${origin}/l/${l.slug}`;
  const agentFirst = firstName(l.agent.name);
  const mail = agentMailto(l, lo, origin);
  const mailLabel = `Email kit to ${esc(agentFirst ?? "the agent")}`;
  const mailNote = mail.hasEmail
    ? `Opens an email to ${esc(l.agent.email!.trim())} in your mail app with the kit link. Just hit send.`
    : `Opens an email with the kit link in your mail app. We don't have ${esc(agentFirst ?? "the agent")}'s email address, so add it in the To line.`;
  const facts = [formatPrice(l.price), statsLine(l)].filter(Boolean).join(" · ");
  const agent = [l.agent.name, l.agent.brokerage].filter(Boolean).join(", ");
  const photo = l.photos[0]
    ? `<img src="${esc(l.photos[0])}" width="536" alt="" style="display:block;width:100%;max-width:536px;height:auto;border:0" />`
    : "";
  const noPhotos = l.photos.length
    ? ""
    : `<p style="margin:8px 0 0;font-size:13px;color:#8a5a00">No listing photos found yet. The agent can add them on the kit page, or they'll be added automatically when they appear online.</p>`;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e3e0;margin:0 0 20px">
  <tr><td>${photo}</td></tr>
  <tr><td style="padding:18px 20px">
    <p style="margin:0;font-size:18px;font-weight:700;color:#0a0a0a">${esc(streetLine(l))}, ${esc(l.city)}</p>
    <p style="margin:4px 0 0;font-size:14px;color:#5b5b5b">${esc(facts)}</p>
    <p style="margin:10px 0 0;font-size:14px;color:#0a0a0a">Listed by <strong>${esc(agent)}</strong>${l.agent.phone ? ` · ${esc(l.agent.phone)}` : ""}${l.agent.email ? ` · ${esc(l.agent.email)}` : ""}</p>
    ${noPhotos}
    ${buttonRows(button(mail.href, mailLabel, true), mailNote, [
      button(kitUrl, "Open kit", false),
      button(`${kitUrl}/download`, "Download all", false),
    ])}
    <p style="margin:16px 0 4px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#5b5b5b">Or copy and text to ${esc(agentFirst ?? "the agent")}</p>
    <p style="margin:0;padding:12px 14px;background:#f4f3f1;font-size:14px;line-height:1.5;color:#0a0a0a">${esc(agentMessage(l, kitUrl))}</p>
  </td></tr>
</table>`;
}

function groupAgentMessage(ls: Listing[], origin: string): string {
  const who = firstName(ls[0].agent.name);
  return `Hi${who ? ` ${who}` : ""}, congrats on your new listings! I put together a free marketing kit for each one: social posts, flyers, captions and emails, all ready to download.\n${ls
    .map((l) => `${streetLine(l)}: ${origin}/l/${l.slug}`)
    .join("\n")}`;
}

/** A listing inside an agent's group: photo, details and kit links, with no email button of its own. */
function groupKitRow(l: Listing, origin: string, last: boolean): string {
  const kitUrl = `${origin}/l/${l.slug}`;
  const facts = [formatPrice(l.price), statsLine(l)].filter(Boolean).join(" · ");
  const photo = l.photos[0]
    ? `<img src="${esc(l.photos[0])}" width="496" alt="" style="display:block;width:100%;max-width:496px;height:auto;border:0" />`
    : "";
  return `<tr><td style="padding:0 20px ${last ? 20 : 18}px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e3e0">
      <tr><td>${photo}</td></tr>
      <tr><td style="padding:14px 16px">
        <p style="margin:0;font-size:17px;font-weight:700;color:#0a0a0a">${esc(streetLine(l))}, ${esc(l.city)}</p>
        <p style="margin:4px 0 12px;font-size:14px;color:#5b5b5b">${esc(facts)}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="top" style="padding:0 8px 0 0">${button(kitUrl, "Open kit", false)}</td>
          <td valign="top">${button(`${kitUrl}/download`, "Download all", false)}</td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>`;
}

/**
 * An agent with two or more listings in this email: one card with one
 * "Email all kits" button whose draft has every kit, then each home below it.
 */
function agentGroupCard(ls: Listing[], lo: LoanOfficer, origin: string): string {
  const a = ls[0].agent;
  const agentFirst = firstName(a.name);
  const name = esc(agentFirst ?? "the agent");
  const email = agentEmail(ls);
  const mail = agentGroupMailto(ls, lo, origin);
  const count = ls.length === 2 ? "both kits" : `all ${ls.length} kits`;
  const mailNote = mail.hasEmail
    ? `Opens one email to ${esc(email)} in your mail app with links to ${count}. Just hit send.`
    : `Opens one email in your mail app with links to ${count}. We don't have ${name}'s email address, so add it in the To line.`;
  const agent = [a.name, a.brokerage].filter(Boolean).join(", ");
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e3e0;margin:0 0 20px">
  <tr><td style="padding:18px 20px 16px">
    <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#5b5b5b">${ls.length} new listings</p>
    <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0a0a0a">${esc(agent)}</p>
    ${a.phone || email ? `<p style="margin:4px 0 0;font-size:14px;color:#5b5b5b">${[a.phone, email].filter(Boolean).map((x) => esc(x!)).join(" · ")}</p>` : ""}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 0">
      <tr><td style="padding:0 0 6px">${button(mail.href, `Email ${count} to ${name}`, true)}</td></tr>
      <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;color:#5b5b5b">${mailNote}</td></tr>
    </table>
    <p style="margin:16px 0 4px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#5b5b5b">Or copy and text to ${name}</p>
    <p style="margin:0;padding:12px 14px;background:#f4f3f1;font-size:14px;line-height:1.5;color:#0a0a0a">${esc(groupAgentMessage(ls, origin)).replace(/\n/g, "<br>")}</p>
  </td></tr>
  ${ls.map((l, i) => groupKitRow(l, origin, i === ls.length - 1)).join("")}
</table>`;
}

/**
 * Own It Social wordmark for the top of every email: live text in Arial Black,
 * not an image, so it shows even when the mail app blocks images.
 */
export function emailLogo(): string {
  return `<p style="margin:0;text-align:center;font-family:'Arial Black',Arial,Helvetica,sans-serif;font-size:26px;line-height:1.05;font-weight:900;letter-spacing:0.5px;color:#0a0a0a">OWN IT<br>SOCIAL</p>`;
}

export function renderDigest(lo: LoanOfficer, kits: Listing[], origin: string): { subject: string; html: string } {
  const n = kits.length;
  const subject = n === 1 ? `New listing kit: ${streetLine(kits[0])}` : `${n} new listing kits for your agents`;
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f3f1">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f1"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;font-family:Arial,Helvetica,sans-serif">
  <tr><td style="padding:28px 32px 8px">
    ${emailLogo()}
    <p style="margin:12px 0 0;text-align:center;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#5b5b5b">Listing kits</p>
    <h1 style="margin:10px 0 0;font-size:26px;line-height:1.15;color:#0a0a0a">${n === 1 ? "A new listing kit is ready" : `${n} new listing kits are ready`}</h1>
    <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#0a0a0a">Hi ${esc(firstName(lo.name) ?? lo.name)}, ${n === 1 ? "one of your agents just listed a home" : `${n} of your agents' new listings came in`}. Each kit has social posts, flyers, captions and emails, ready to go. Tap <strong>Email kit</strong> to send it to the agent from your own email, or copy the message to text it.${groupByAgent(kits).some((g) => g.length > 1) ? " An agent with more than one new listing has their homes together, and one email sends them all." : ""}</p>
  </td></tr>
  <tr><td style="padding:20px 32px 8px">${groupByAgent(kits)
    .map((g) => (g.length > 1 ? agentGroupCard(g, lo, origin) : kitCard(g[0], lo, origin)))
    .join("")}</td></tr>
  <tr><td style="padding:0 32px 28px">
    <p style="margin:0;font-size:12px;line-height:1.5;color:#5b5b5b">Payment estimates on the kits use the rates and disclosures set up for you. Reply to this email with any changes.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  return { subject, html };
}

/** A kit left out of the email because the loan officer already has (or is getting) the same home. */
export interface RepeatKit {
  det: Detection;
  listing: Listing;
  /** Detection slug of the kit that was (or will be) emailed instead. */
  duplicateOf: string;
}

/** A kit held back from the email because it has no listing photos yet. */
export interface WaitingKit {
  det: Detection;
  listing: Listing;
  loName: string;
}

/**
 * Kits not emailed yet, grouped by loan officer, with repeats of the same home
 * left out. Kits without photos are returned as `noPhotos` and left unsent, so
 * a later run emails them once their photos are in.
 */
export async function pendingDigests(
  origin: string,
): Promise<{ digests: Digest[]; skipped: string[]; repeats: RepeatKit[]; noPhotos: WaitingKit[] }> {
  const [all, los] = await Promise.all([detections.list(), loanOfficers.list()]);
  const byLo = new Map<string, { det: Detection; listing: Listing }[]>();
  for (const det of all) {
    if (det.status !== "created" || !det.listingSlug || det.emailedAt) continue;
    const listing = await listings.get(det.listingSlug);
    if (!listing) continue;
    const key = listing.loanOfficerSlug;
    byLo.set(key, [...(byLo.get(key) ?? []), { det, listing }]);
  }
  const digests: Digest[] = [];
  const skipped: string[] = [];
  const repeats: RepeatKit[] = [];
  const noPhotos: WaitingKit[] = [];
  for (const [slug, pending] of byLo) {
    const lo = los.find((x) => x.slug === slug);
    // A self-signup loan officer whose subscription lapsed isn't emailed.
    if (!lo || !isActive(lo)) continue;
    // Homes this loan officer was already emailed.
    const sent = all.filter((d) => d.emailedAt && !d.duplicateOf && d.loanOfficerSlug === slug);
    // Within this batch, keep the kit that has photos (then the older one).
    pending.sort(
      (a, b) =>
        Number(!a.listing.photos.length) - Number(!b.listing.photos.length) ||
        a.det.createdAt.localeCompare(b.det.createdAt),
    );
    const kits: { det: Detection; listing: Listing }[] = [];
    for (const k of pending) {
      // Only kits with photos go into `kits`, so a photo-less kit is never
      // marked as a repeat of another photo-less kit that is still waiting.
      const same =
        sent.find((d) => sameHome(d.listing, k.det.listing)) ??
        kits.find((x) => sameHome(x.det.listing, k.det.listing))?.det;
      if (same) repeats.push({ ...k, duplicateOf: same.slug });
      else if (!k.listing.photos.length) noPhotos.push({ ...k, loName: lo.name });
      else kits.push(k);
    }
    if (!kits.length) continue;
    if (!lo.email) {
      skipped.push(`${lo.name} has no email address, so ${kits.length} kit(s) weren't emailed.`);
      continue;
    }
    // Same order as the email: by agent, then address.
    const order = groupByAgent(kits.map((k) => k.listing)).flat();
    kits.sort((a, b) => order.indexOf(a.listing) - order.indexOf(b.listing));
    digests.push({ lo, kits, ...renderDigest(lo, kits.map((k) => k.listing), origin) });
  }
  digests.sort((a, b) => a.lo.name.localeCompare(b.lo.name));
  noPhotos.sort((a, b) => a.loName.localeCompare(b.loName) || a.listing.address.localeCompare(b.listing.address));
  return { digests, skipped, repeats, noPhotos };
}

/**
 * An email for "Send test": the first pending digest, or, when nothing is
 * waiting (every kit already emailed, or the loan officer has no email
 * address), one built from the newest kits so a test can always be sent.
 */
export async function testDigest(origin: string): Promise<{ loName: string; subject: string; html: string } | null> {
  const { digests } = await pendingDigests(origin);
  if (digests[0]) return { loName: digests[0].lo.name, subject: digests[0].subject, html: digests[0].html };
  const [all, los] = await Promise.all([listings.list(), loanOfficers.list()]);
  const newest = all.filter((l) => l.photos.length).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const lo = los.find((x) => x.slug === newest[0]?.loanOfficerSlug);
  if (!lo) return null;
  const kits = newest.filter((l) => l.loanOfficerSlug === lo.slug && l.photos.length).slice(0, 3);
  if (!kits.length) return null;
  return { loName: lo.name, ...renderDigest(lo, kits, origin) };
}

/** Emails every loan officer their new kits and marks them sent. Returns errors. */
export async function sendDigests(origin: string): Promise<{ sent: number; errors: string[] }> {
  if (!mailConfigured()) return { sent: 0, errors: [] };
  const { digests, skipped, repeats } = await pendingDigests(origin);
  const errors = [...skipped];
  // Repeats never go out; mark them handled so they don't wait in the queue forever.
  for (const r of repeats) {
    const now = new Date().toISOString();
    await detections.save({ ...r.det, emailedAt: now, duplicateOf: r.duplicateOf, updatedAt: now });
  }
  let sent = 0;
  for (const d of digests) {
    const mail: Mail = { to: [d.lo.email!], subject: d.subject, html: d.html };
    const failed = await sendMail([mail]);
    // A timeout usually means Microsoft took the message but answered slowly, so
    // count it as sent rather than risk a duplicate on the next run.
    const timedOut = failed.length > 0 && failed.every((e) => /timeout|aborted/i.test(e));
    if (failed.length) {
      errors.push(...failed.map((e) => (timedOut ? `${e} (counted as sent; check Sent Items)` : e)));
      if (!timedOut) continue;
    }
    sent++;
    const now = new Date().toISOString();
    for (const k of d.kits) await detections.save({ ...k.det, emailedAt: now, updatedAt: now });
  }
  return { sent, errors };
}
