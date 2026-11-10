import "server-only";
import { createHash } from "node:crypto";

/** Browser details captured at signup so Meta can tie the trial back to the ad click. */
export interface MetaClick {
  fbp?: string;
  fbc?: string;
  ip?: string;
  ua?: string;
}

export interface MetaEvent {
  name: "StartTrial" | "Subscribe";
  /** Same id for the same event, so Meta counts it once. */
  id: string;
  email?: string;
  phone?: string;
  fullName?: string;
  value?: number;
  url?: string;
  click?: MetaClick;
}

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

export const metaCapiConfigured = () => Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID && process.env.META_CAPI_TOKEN);

/**
 * Sends a server-side conversion to Meta (Conversions API). Ad blockers and Stripe's
 * checkout page hide the browser pixel at the moment that matters, so trials are
 * reported from the server. Never throws: tracking must not break a signup.
 */
export async function sendMetaEvent(e: MetaEvent): Promise<void> {
  if (!metaCapiConfigured()) return;
  const [first, ...rest] = (e.fullName ?? "").trim().toLowerCase().split(/\s+/);
  const digits = (e.phone ?? "").replace(/\D/g, "");
  const phone = digits.length === 10 ? `1${digits}` : digits;
  const user_data: Record<string, unknown> = {
    ...(e.email ? { em: [sha(e.email.trim().toLowerCase())] } : {}),
    ...(phone ? { ph: [sha(phone)] } : {}),
    ...(first ? { fn: [sha(first)] } : {}),
    ...(rest.length ? { ln: [sha(rest[rest.length - 1])] } : {}),
    ...(e.click?.fbp ? { fbp: e.click.fbp } : {}),
    ...(e.click?.fbc ? { fbc: e.click.fbc } : {}),
    ...(e.click?.ip ? { client_ip_address: e.click.ip } : {}),
    ...(e.click?.ua ? { client_user_agent: e.click.ua } : {}),
  };
  const body = {
    data: [
      {
        event_name: e.name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: e.id,
        action_source: "website",
        ...(e.url ? { event_source_url: e.url } : {}),
        user_data,
        ...(e.value != null ? { custom_data: { value: e.value, currency: "USD" } } : {}),
      },
    ],
    ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
  };
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${process.env.NEXT_PUBLIC_META_PIXEL_ID}/events?access_token=${encodeURIComponent(process.env.META_CAPI_TOKEN!)}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    );
    if (!res.ok) console.error(`Meta ${e.name} failed`, res.status, await res.text());
  } catch (err) {
    console.error(`Meta ${e.name} failed`, err);
  }
}
