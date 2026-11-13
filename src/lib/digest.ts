import "server-only";
import { isActive } from "./plan";
import { detections, listings, loanOfficers } from "./store";
import { firstName, formatPrice, statsLine, streetLine } from "./format";
import { agentEmailAddress, agentEmailBody, agentEmailSubject, groupByAgent, mailtoHref } from "./agentEmail";
import { textPageHref } from "./textLink";
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

/** Kits from the 90-days-on-market pull: a fresh push for a home that's been for sale a while, not a new listing. */
export function isNinetyDayKit(l: Listing): boolean {
  return l.source?.pull === "90-days";
}

/** Small label over a 90-day kit in the email, so the LO knows it isn't a new listing. */
function ninetyDayTag(l: Listing): string {
  return isNinetyDayKit(l)
    ? `<p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#8a5a00">90 days on market</p>`
    : "";
}

function agentMessage(l: Listing, kitUrl: string): string {
  const who = firstName(l.agent.name);
  if (isNinetyDayKit(l))
    return `Hi${who ? ` ${who}` : ""}, I put together a free marketing kit to give ${streetLine(l)} a fresh push: social posts, flyers, captions and emails, all ready to download. ${kitUrl}`;
  return `Hi${who ? ` ${who}` : ""}, congrats on ${streetLine(l)}! I put together a free marketing kit for it: social posts, flyers, captions and emails, all ready to download. ${kitUrl}`;
}

/**
 * "Bulletproof" button: a plain table cell carries the colour and border, and
 * the link inside carries the padding. No inline-block div wrappers or conditional
 * comments, which Outlook on the web and Outlook for Windows mangle.
 */
function button(href: string, label: string, primary: boolean): string {
  const bg = primary ? "#0a0a0a" : "#ffffff";
  const fg = primary ? "#ffffff" : "#0a0a0a";
  // mailto:/sms: links open an app; target="_blank" makes some webmail open an empty tab too.
  const target = /^(mailto|sms):/.test(href) ? "" : ' target="_blank"';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate"><tr>
      <td align="center" bgcolor="${bg}" style="background-color:${bg};border:2px solid #0a0a0a;border-radius:6px;mso-padding-alt:11px 20px">
        <a href="${esc(href)}"${target} style="display:inline-block;padding:11px 20px;color:${fg};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;font-weight:700;text-decoration:none;white-space:nowrap">${label}</a>
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

/**
 * The "Email kit" button: a one-tap mailto: draft in the loan officer's own
 * mail app (Colin's choice, 2026-11-10: one tap beats guaranteed links). Its
 * body is plain text, so links are clickable only where the agent's mail app
 * turns them into links (most phones; desktop Outlook often doesn't). Colin
 * chose this over a copy-and-paste formatted version (no backup link).
 */
function emailButton(ls: Listing[], lo: LoanOfficer, origin: string, label: string): string {
  return button(mailtoHref(agentEmailAddress(ls), agentEmailSubject(ls), agentEmailBody(ls, lo, origin)), label, true);
}

/**
 * US phone as an sms: number (+1XXXXXXXXXX), or "" when we can't read it,
 * so the text draft opens with an empty To line.
 */
function smsNumber(phone: string | undefined): string {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return "";
}

/**
 * The "Text kit" button: opens a text draft with the message filled in, on the
 * loan officer's phone or computer (Messages on a Mac, Phone Link on Windows).
 * It links to our /text page rather than straight to sms:, because Outlook on
 * iPhone does nothing when an sms: link in an email is tapped (2026-11-12).
 */
function textButton(phone: string | undefined, message: string, label: string, origin: string): string {
  return button(textPageHref(origin, smsNumber(phone), message), label, true);
}

/**
 * The Email and Text buttons side by side (Colin: same line), short labels
 * so the pair fits a phone, then one note saying where each one goes.
 */
function sendButtons(email: string, text: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td valign="top" style="padding:0 8px 0 0">${email}</td>
      <td valign="top">${text}</td>
    </tr></table>`;
}

function sendNote(ls: Listing[], what: string): string {
  const email = agentEmailAddress(ls);
  const phone = smsNumber(ls[0].agent.phone) ? ls[0].agent.phone!.trim() : "";
  const who = esc(firstName(ls[0].agent.name) ?? "the agent");
  const missing = [!email && "email address", !phone && "cell number"].filter(Boolean).join(" or ");
  return `Opens an email${email ? ` to ${esc(email)}` : ""} or a text${phone ? ` to ${esc(phone)}` : ""} with ${what}, from your own email or phone. Just hit send.${
    missing ? ` We don't have ${who}'s ${missing}, so add it in the To line.` : ""
  }`;
}

export function kitCard(l: Listing, lo: LoanOfficer, origin: string): string {
  const kitUrl = `${origin}/l/${l.slug}`;
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
    ${ninetyDayTag(l)}<p style="margin:0;font-size:18px;font-weight:700;color:#0a0a0a">${esc(streetLine(l))}, ${esc(l.city)}</p>
    <p style="margin:4px 0 0;font-size:14px;color:#5b5b5b">${esc(facts)}</p>
    <p style="margin:10px 0 0;font-size:14px;color:#0a0a0a">Listed by <strong>${esc(agent)}</strong>${l.agent.phone ? ` · ${esc(l.agent.phone)}` : ""}${l.agent.email ? ` · ${esc(l.agent.email)}` : ""}</p>
    ${noPhotos}
    ${buttonRows(sendButtons(emailButton([l], lo, origin, "Email kit"), textButton(l.agent.phone, agentMessage(l, kitUrl), "Text kit", origin)), sendNote([l], "the kit link"), [
      button(kitUrl, "Open kit", false),
      button(`${kitUrl}/download`, "Download all", false),
    ])}
  </td></tr>
</table>`;
}

function groupAgentMessage(ls: Listing[], origin: string): string {
  const who = firstName(ls[0].agent.name);
  const opener = ls.some(isNinetyDayKit) ? "" : " congrats on your new listings!";
  return `Hi${who ? ` ${who}` : ""},${opener} I put together a free marketing kit for each one: social posts, flyers, captions and emails, all ready to download.\n${ls
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
        ${ninetyDayTag(l)}<p style="margin:0;font-size:17px;font-weight:700;color:#0a0a0a">${esc(streetLine(l))}, ${esc(l.city)}</p>
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
  const email = agentEmailAddress(ls);
  const count = ls.length === 2 ? "both kits" : `all ${ls.length} kits`;
  const agent = [a.name, a.brokerage].filter(Boolean).join(", ");
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e3e0;margin:0 0 20px">
  <tr><td style="padding:18px 20px 16px">
    <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#5b5b5b">${ls.length} ${ls.some(isNinetyDayKit) ? "listings" : "new listings"}</p>
    <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0a0a0a">${esc(agent)}</p>
    ${a.phone || email ? `<p style="margin:4px 0 0;font-size:14px;color:#5b5b5b">${[a.phone, email].filter(Boolean).map((x) => esc(x!)).join(" · ")}</p>` : ""}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 0">
      <tr><td style="padding:0 0 6px">${sendButtons(emailButton(ls, lo, origin, "Email kits"), textButton(a.phone, groupAgentMessage(ls, origin), "Text kits", origin))}</td></tr>
      <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;color:#5b5b5b">${sendNote(ls, `links to ${count}`)}</td></tr>
    </table>
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
  // "New" only when every kit is a new listing; 90-day kits are for homes that have been for sale a while.
  const aged = kits.filter(isNinetyDayKit).length;
  const neu = aged ? "" : "new ";
  const subject =
    n === 1
      ? `${aged ? "Just passed 90 days on market" : "New listing kit"}: ${streetLine(kits[0])}`
      : aged === n
        ? `${n} listings just passed 90 days on market`
        : `${n} ${neu}listing kits for your agents`;
  const intro =
    aged === 0
      ? n === 1
        ? "one of your agents just listed a home"
        : `${n} of your agents' new listings came in`
      : aged === n
        ? n === 1
          ? "one of your agents has a home that just passed 90 days on market, a good time for a fresh push"
          : `${n} of your agents' homes just passed 90 days on market, a good time for a fresh push`
        : `${n - aged} new ${n - aged === 1 ? "listing" : "listings"} came in, and ${aged} ${aged === 1 ? "home" : "homes"} just passed 90 days on market (marked below), a good time for a fresh push`;
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f3f1">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f1"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;font-family:Arial,Helvetica,sans-serif">
  <tr><td style="padding:28px 32px 8px">
    ${emailLogo()}
    <p style="margin:12px 0 0;text-align:center;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#5b5b5b">Listing kits</p>
    <h1 style="margin:10px 0 0;font-size:26px;line-height:1.15;color:#0a0a0a">${n === 1 ? `A ${neu}listing kit is ready` : `${n} ${neu}listing kits are ready`}</h1>
    <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#0a0a0a">Hi ${esc(firstName(lo.name) ?? lo.name)}, ${intro}. Each kit has social posts, flyers, captions and emails, ready to go. Tap <strong>Email kit</strong> or <strong>Text kit</strong> to send it to the agent from your own email or phone.${groupByAgent(kits).some((g) => g.length > 1) ? " When an agent has more than one home here, they're grouped together, and one email or text sends them all." : ""}</p>
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
    // New listings and 90-days-on-market homes go out as two separate emails.
    for (const part of [kits.filter((k) => !isNinetyDayKit(k.listing)), kits.filter((k) => isNinetyDayKit(k.listing))]) {
      if (!part.length) continue;
      const order = groupByAgent(part.map((k) => k.listing)).flat();
      part.sort((a, b) => order.indexOf(a.listing) - order.indexOf(b.listing));
      digests.push({ lo, kits: part, ...renderDigest(lo, part.map((k) => k.listing), origin) });
    }
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
    const mail: Mail = { to: [d.lo.email!], cc: d.lo.ccEmails, subject: d.subject, html: d.html };
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
