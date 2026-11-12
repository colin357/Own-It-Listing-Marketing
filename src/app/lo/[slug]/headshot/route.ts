import { loanOfficers } from "@/lib/store";
import { croppedHeadshot } from "@/lib/render/resources";
import { isDefaultCrop } from "@/lib/headshotCrop";

// URLs carry ?v=<hash of url + crop>, so a re-crop is a new URL and this can cache for long.
const CACHE = "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400";

/** The loan officer's headshot cut to the crop saved in admin, for the kit and buyer pages. */
export async function GET(_req: Request, ctx: RouteContext<"/lo/[slug]/headshot">) {
  const { slug } = await ctx.params;
  const lo = await loanOfficers.get(slug);
  if (!lo?.headshotUrl) return new Response("Not found", { status: 404 });
  if (isDefaultCrop(lo.headshotCrop)) return Response.redirect(lo.headshotUrl, 302);
  const out = await croppedHeadshot(lo.headshotUrl, lo.headshotCrop!, 600);
  if (!out) return Response.redirect(lo.headshotUrl, 302);
  return new Response(new Uint8Array(out), { headers: { "Content-Type": "image/jpeg", "Cache-Control": CACHE } });
}
