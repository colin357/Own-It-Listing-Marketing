import "server-only";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Bearer-token check for the automation API (Zapier, Make, CRM webhooks). */
export function isAuthorizedApiRequest(req: Request): boolean {
  const key = process.env.API_KEY;
  if (!key) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : (req.headers.get("x-api-key") ?? "");
  return safeEqual(token, key);
}

export function unauthorized() {
  return Response.json(
    { error: "Unauthorized. Send 'Authorization: Bearer <API_KEY>'." },
    { status: 401 },
  );
}
