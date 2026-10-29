import "server-only";
import { detections, listings, loanOfficers } from "./store";
import { firstName, formatPrice, statsLine, streetLine } from "./format";
import { mailConfigured, sendMail, type Mail } from "./mail";
import type { Detection } from "./detect/types";
import type { Listing, LoanOfficer } from "./types";

/**
 * After each detection run, every loan officer gets one email listing the new
 * kits for their agents, with links and a message to forward to each agent.
 * A kit is emailed once (Detection.emailedAt).
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

function kitCard(l: Listing, origin: string): string {
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
    <p style="margin:0;font-size:18px;font-weight:700;color:#0a0a0a">${esc(streetLine(l))}, ${esc(l.city)}</p>
    <p style="margin:4px 0 0;font-size:14px;color:#5b5b5b">${esc(facts)}</p>
    <p style="margin:10px 0 0;font-size:14px;color:#0a0a0a">Listed by <strong>${esc(agent)}</strong>${l.agent.phone ? ` · ${esc(l.agent.phone)}` : ""}${l.agent.email ? ` · ${esc(l.agent.email)}` : ""}</p>
    ${noPhotos}
    <p style="margin:16px 0 0">
      <a href="${esc(kitUrl)}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:11px 20px;border-radius:999px">Open kit</a>
      &nbsp;
      <a href="${esc(`${kitUrl}/download`)}" style="display:inline-block;color:#0a0a0a;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:11px 8px">Download all</a>
    </p>
    <p style="margin:16px 0 4px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#5b5b5b">Text or email to ${esc(firstName(l.agent.name) ?? "the agent")}</p>
    <p style="margin:0;padding:12px 14px;background:#f4f3f1;font-size:14px;line-height:1.5;color:#0a0a0a">${esc(agentMessage(l, kitUrl))}</p>
  </td></tr>
</table>`;
}

export function renderDigest(lo: LoanOfficer, kits: Listing[], origin: string): { subject: string; html: string } {
  const n = kits.length;
  const subject = n === 1 ? `New listing kit: ${streetLine(kits[0])}` : `${n} new listing kits for your agents`;
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f3f1">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f1"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;font-family:Arial,Helvetica,sans-serif">
  <tr><td style="padding:28px 32px 8px">
    <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#5b5b5b">Own It Social · Listing kits</p>
    <h1 style="margin:10px 0 0;font-size:26px;line-height:1.15;color:#0a0a0a">${n === 1 ? "A new listing kit is ready" : `${n} new listing kits are ready`}</h1>
    <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#0a0a0a">Hi ${esc(firstName(lo.name) ?? lo.name)}, ${n === 1 ? "one of your agents just listed a home" : `${n} of your agents' new listings came in`}. Each kit has social posts, flyers, captions and emails, ready to go. Send the link to the agent with the message under each listing, or download everything yourself.</p>
  </td></tr>
  <tr><td style="padding:20px 32px 8px">${kits.map((l) => kitCard(l, origin)).join("")}</td></tr>
  <tr><td style="padding:0 32px 28px">
    <p style="margin:0;font-size:12px;line-height:1.5;color:#5b5b5b">Payment estimates on the kits use the rates and disclosures set up for you. Reply to this email with any changes.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  return { subject, html };
}

/** Kits not emailed yet, grouped by loan officer. */
export async function pendingDigests(origin: string): Promise<{ digests: Digest[]; skipped: string[] }> {
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
  for (const [slug, kits] of byLo) {
    const lo = los.find((x) => x.slug === slug);
    if (!lo) continue;
    if (!lo.email) {
      skipped.push(`${lo.name} has no email address, so ${kits.length} kit(s) weren't emailed.`);
      continue;
    }
    kits.sort((a, b) => a.listing.address.localeCompare(b.listing.address));
    digests.push({ lo, kits, ...renderDigest(lo, kits.map((k) => k.listing), origin) });
  }
  digests.sort((a, b) => a.lo.name.localeCompare(b.lo.name));
  return { digests, skipped };
}

/** Emails every loan officer their new kits and marks them sent. Returns errors. */
export async function sendDigests(origin: string): Promise<{ sent: number; errors: string[] }> {
  if (!mailConfigured()) return { sent: 0, errors: [] };
  const { digests, skipped } = await pendingDigests(origin);
  const errors = [...skipped];
  let sent = 0;
  for (const d of digests) {
    const mail: Mail = { to: [d.lo.email!], subject: d.subject, html: d.html };
    const failed = await sendMail([mail]);
    if (failed.length) {
      errors.push(...failed);
      continue;
    }
    sent++;
    const now = new Date().toISOString();
    for (const k of d.kits) await detections.save({ ...k.det, emailedAt: now, updatedAt: now });
  }
  return { sent, errors };
}
