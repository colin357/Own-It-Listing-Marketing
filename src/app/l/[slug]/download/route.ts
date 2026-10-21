import { zipSync, strToU8 } from "fflate";
import { getKit } from "@/lib/listings";
import { buildCaptions } from "@/lib/captions";
import { assetFilename, renderAssets } from "@/lib/render/render";
import { pngToLetterPdf } from "@/lib/render/pdf";
import { ASSETS, type AssetName } from "@/lib/render/templates";

export const maxDuration = 60;

/** Everything in one ZIP: all PNGs, the flyer PDF and a captions.txt. */
export async function GET(_req: Request, ctx: RouteContext<"/l/[slug]/download">) {
  const { slug } = await ctx.params;
  const kit = await getKit(slug);
  if (!kit) return new Response("Not found", { status: 404 });
  const { listing, lo } = kit;

  const names = Object.keys(ASSETS) as AssetName[];
  const images = await renderAssets(listing, lo, names);
  const files: Record<string, Uint8Array> = {};
  for (const [i, res] of images.entries()) {
    const buf = new Uint8Array(await res.arrayBuffer());
    files[assetFilename(listing, names[i])] = buf;
    if (names[i] === "flyer") {
      files[`${listing.slug}-flyer.pdf`] = await pngToLetterPdf(buf, `Flyer – ${listing.address}`);
    }
  }
  const captions = buildCaptions(listing, lo)
    .map((c) => `===== ${c.label.toUpperCase()} =====\n\n${c.text}\n`)
    .join("\n");
  files["captions.txt"] = strToU8(captions);

  // PNG/PDF are already compressed; store them as-is for speed.
  const zip = zipSync(files, { level: 0 });
  return new Response(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${listing.slug}-marketing-kit.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
