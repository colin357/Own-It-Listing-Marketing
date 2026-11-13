/** sms: link with the message filled in. "?&body=" is the form both iPhone and Android read. */
export function smsHref(number: string, body: string): string {
  return `sms:${number}?&body=${encodeURIComponent(body)}`;
}

/**
 * The https link the email's "Text kit" button uses. Outlook on iPhone won't
 * open sms: links from an email, so the button goes to our /text page, which
 * opens Messages (and shows the message to copy if it can't).
 */
export function textPageHref(origin: string, number: string, body: string): string {
  const q = new URLSearchParams();
  if (number) q.set("to", number);
  q.set("body", body);
  return `${origin}/text?${q.toString()}`;
}
