import "server-only";
import { emailLogo, kitCard } from "./digest";
import { firstName, streetLine } from "./format";
import { buildPath } from "./loLinks";
import { mailConfigured, sendMail } from "./mail";
import type { Listing, LoanOfficer } from "./types";

/**
 * When a loan officer builds a kit by hand (src/app/build), they get an email
 * with it right away: the same card as the daily email (photo, Email kit and
 * Text kit buttons, Open kit, Download all), so they have the link in their
 * inbox to send the agent later. It goes from MAIL_FROM like the daily email.
 * The kit's detection is already marked emailed, so the daily email skips it.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderBuiltKitEmail(lo: LoanOfficer, kit: Listing, origin: string): { subject: string; html: string } {
  const street = streetLine(kit);
  const subject = `Your listing kit is ready: ${street}`;
  const build = buildPath(lo.slug);
  const another = build
    ? ` <a href="${esc(`${origin}${build}`)}" target="_blank" style="color:#0a0a0a">Build another kit</a> any time.`
    : "";
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f3f1">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f1"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;font-family:Arial,Helvetica,sans-serif">
  <tr><td style="padding:28px 32px 8px">
    ${emailLogo()}
    <p style="margin:12px 0 0;text-align:center;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#5b5b5b">Listing kits</p>
    <h1 style="margin:10px 0 0;font-size:26px;line-height:1.15;color:#0a0a0a">Your listing kit is ready</h1>
    <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#0a0a0a">Hi ${esc(firstName(lo.name) ?? lo.name)}, here's the kit you built for ${esc(street)}. It has social posts, flyers, captions and emails, ready to go. Tap <strong>Email kit</strong> or <strong>Text kit</strong> to send it to the agent from your own email or phone.</p>
  </td></tr>
  <tr><td style="padding:20px 32px 8px">${kitCard(kit, lo, origin)}</td></tr>
  <tr><td style="padding:0 32px 28px">
    <p style="margin:0;font-size:12px;line-height:1.5;color:#5b5b5b">Payment estimates on the kit use the rates and disclosures set up for you.${another} Reply to this email with any changes.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  return { subject, html };
}

/** Emails the loan officer the kit they just built. Logs and moves on if it can't. */
export async function sendBuiltKitEmail(lo: LoanOfficer, kit: Listing, origin: string): Promise<void> {
  if (!lo.email || !mailConfigured()) return;
  try {
    const errors = await sendMail([{ to: [lo.email], ...renderBuiltKitEmail(lo, kit, origin) }]);
    if (errors.length) console.error("Built-kit email failed", errors);
  } catch (err) {
    console.error("Built-kit email failed", err);
  }
}
