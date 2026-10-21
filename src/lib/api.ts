import "server-only";
import type { Listing } from "./types";
import { ValidationError } from "./validate";
import { originFromRequest } from "./site";
import { ASSETS } from "./render/templates";

/** Public representation returned by the API: the record plus share links. */
export function withLinks(req: Request, l: Listing) {
  const origin = originFromRequest(req);
  const v = encodeURIComponent(l.updatedAt);
  const assets = Object.fromEntries(
    Object.keys(ASSETS).map((name) => [name, `${origin}/l/${l.slug}/assets/${name}.png?v=${v}`]),
  );
  return {
    ...l,
    url: `${origin}/l/${l.slug}`,
    downloadUrl: `${origin}/l/${l.slug}/download`,
    flyerPdfUrl: `${origin}/l/${l.slug}/assets/flyer.pdf?v=${v}`,
    assets,
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ValidationError(["Request body must be valid JSON"]);
  }
}

export function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ValidationError(["Request body must be a JSON object"]);
  return body as Record<string, unknown>;
}

export function errorResponse(err: unknown) {
  if (err instanceof ValidationError)
    return Response.json({ error: "Validation failed", issues: err.issues }, { status: 400 });
  console.error(err);
  return Response.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
}
