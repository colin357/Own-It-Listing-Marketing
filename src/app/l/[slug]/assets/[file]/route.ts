import { getKit } from "@/lib/listings";
import { buyerPagePath, originFromRequest } from "@/lib/site";
import { assetFilename, renderAssets } from "@/lib/render/render";
import { pngToLetterPdf } from "@/lib/render/pdf";
import { ASSETS, assetsFor, isAssetName, isPrintAsset } from "@/lib/render/templates";

// Images are cached at the CDN; the kit page appends ?v=<updatedAt> so edits bust the cache.
const CACHE = "public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400";

export async function GET(req: Request, ctx: RouteContext<"/l/[slug]/assets/[file]">) {
  const { slug, file } = await ctx.params;
  const match = /^([a-z]+)\.(png|pdf)$/.exec(file);
  if (!match || !isAssetName(match[1])) return new Response("Not found", { status: 404 });
  const [, name, ext] = match;
  if (ext === "pdf" && !isPrintAsset(name)) return new Response("Not found", { status: 404 });

  const kit = await getKit(slug);
  if (!kit || !assetsFor(kit.listing, kit.lo).includes(name)) return new Response("Not found", { status: 404 });

  const download = new URL(req.url).searchParams.has("download");
  const filename = assetFilename(kit.listing, name).replace(/\.png$/, `.${ext}`);
  const disposition = `${download ? "attachment" : "inline"}; filename="${filename}"`;

  const [image] = await renderAssets(kit.listing, kit.lo, [name], originFromRequest(req) + buyerPagePath(slug));
  if (ext === "png") {
    return new Response(image.body, {
      headers: { "Content-Type": "image/png", "Cache-Control": CACHE, "Content-Disposition": disposition },
    });
  }
  const pdf = await pngToLetterPdf(await image.arrayBuffer(), `${ASSETS[name].label} – ${kit.listing.address}`);
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Cache-Control": CACHE, "Content-Disposition": disposition },
  });
}
