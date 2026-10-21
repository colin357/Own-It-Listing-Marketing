import "server-only";
import type { Listing } from "./types";
import { ValidationError } from "./validate";
import { originFromRequest } from "./site";
import { loanOfficers } from "./store";
import { ASSETS, assetsFor, isPrintAsset } from "./render/templates";

/** Public representation returned by the API: the record plus share links. */
export async function withLinks(req: Request, l: Listing) {
  const origin = originFromRequest(req);
  const v = encodeURIComponent(l.updatedAt);
  const lo = await loanOfficers.get(l.loanOfficerSlug);
  const names = lo ? assetsFor(l, lo) : (Object.keys(ASSETS) as (keyof typeof ASSETS)[]);
  const base = `${origin}/l/${l.slug}/assets`;
  return {
    ...l,
    url: `${origin}/l/${l.slug}`,
    downloadUrl: `${origin}/l/${l.slug}/download`,
    assets: Object.fromEntries(names.map((name) => [name, `${base}/${name}.png?v=${v}`])),
    pdfs: Object.fromEntries(names.filter(isPrintAsset).map((name) => [name, `${base}/${name}.pdf?v=${v}`])),
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
