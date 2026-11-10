/**
 * A minimal .eml file that opens as an unsent draft ("X-Unsent: 1") in Outlook
 * for Windows: To and Subject filled in, HTML body with real links, ready to
 * send from the user's own mailbox. Carries a plain-text part for other apps.
 */
const CRLF = "\r\n";

function b64Lines(s: string): string {
  return (Buffer.from(s, "utf8").toString("base64").match(/.{1,76}/g) ?? []).join(CRLF);
}

/** RFC 2047 encoded-word, so non-ASCII subjects (accents, "·") survive. */
function header(s: string): string {
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
}

export function draftEml(opts: { to?: string | null; subject: string; text: string; html: string }): string {
  const boundary = `kit-${Math.random().toString(36).slice(2)}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>${opts.html}</body></html>`;
  return [
    ...(opts.to ? [`To: ${opts.to}`] : []),
    `Subject: ${header(opts.subject)}`,
    "X-Unsent: 1",
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64Lines(opts.text.replace(/\r?\n/g, CRLF)),
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64Lines(html),
    `--${boundary}--`,
    "",
  ].join(CRLF);
}
