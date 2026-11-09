import { renderAssets } from "@/lib/render/render";
import { isAssetName } from "@/lib/render/templates";
import { sampleKit } from "@/lib/sample";

const SHOWN = ["square", "details", "story", "flyer", "payments", "ways", "qualify", "landscape"];

/** Sample graphics for the landing page, rendered from the bundled demo listing. */
export async function GET(_req: Request, ctx: RouteContext<"/sample/[file]">) {
  const { file } = await ctx.params;
  const name = /^([a-z]+)\.png$/.exec(file)?.[1];
  if (!name || !isAssetName(name) || !SHOWN.includes(name)) return new Response("Not found", { status: 404 });
  const { listing, lo } = await sampleKit();
  const rendered = await renderAssets(listing, lo, [name], "https://kits.ownitsocial.com");
  return new Response(rendered[0].body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": rendered.photosFailed ? "public, max-age=60, s-maxage=60" : "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
}
