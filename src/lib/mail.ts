import "server-only";

/**
 * Sends email from a Microsoft 365 mailbox (e.g. team@ownitsocial.com) with
 * Microsoft Graph, using an Entra ID app registration with the Mail.Send
 * application permission. Sent mail lands in that mailbox's Sent Items and
 * replies come back to it.
 *
 * Env: MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MAIL_FROM, optional MAIL_BCC.
 */

export function mailConfigured(): boolean {
  return !!(process.env.MS_TENANT_ID && process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET && process.env.MAIL_FROM);
}

async function graphToken(): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID!,
      client_secret: process.env.MS_CLIENT_SECRET!,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Microsoft sign-in failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export interface Mail {
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
}

/** Sends each message; returns one error string per failure. */
export async function sendMail(messages: Mail[]): Promise<string[]> {
  if (!messages.length) return [];
  if (!mailConfigured()) return ["Email isn't set up (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MAIL_FROM)."];
  const token = await graphToken();
  const from = process.env.MAIL_FROM!;
  const bcc = (process.env.MAIL_BCC ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const errors: string[] = [];
  for (const m of messages) {
    const addr = (a: string) => ({ emailAddress: { address: a } });
    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: m.subject,
          body: { contentType: "HTML", content: m.html },
          toRecipients: m.to.map(addr),
          bccRecipients: bcc.map(addr),
          replyTo: m.replyTo ? [addr(m.replyTo)] : undefined,
        },
        saveToSentItems: true,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) errors.push(`Email to ${m.to.join(", ")} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  return errors;
}
