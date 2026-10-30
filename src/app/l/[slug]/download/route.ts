import { zipSync, strToU8 } from "fflate";
import { getKit } from "@/lib/listings";
import { buyerPagePath, originFromRequest } from "@/lib/site";
import { buildCaptions } from "@/lib/captions";
import { buildEmails } from "@/lib/emails";
import { assetFilename, renderAssets } from "@/lib/render/render";
import { pngToLetterPdf } from "@/lib/render/pdf";
import { ASSETS, assetsFor, isPrintAsset } from "@/lib/render/templates";

export const maxDuration = 60;

/** Everything in one ZIP: all PNGs, the flyer PDFs, captions.txt and emails.txt. */
export async function GET(req: Request, ctx: RouteContext<"/l/[slug]/download">) {
  const { slug } = await ctx.params;
  const kit = await getKit(slug);
  if (!kit) return new Response("Not found", { status: 404 });
  const { listing, lo } = kit;

  const buyerUrl = originFromRequest(req) + buyerPagePath(listing.slug);
  const names = assetsFor(listing, lo);
  const images = await renderAssets(listing, lo, names, buyerUrl);
  const files: Record<string, Uint8Array> = {};
  for (const [i, res] of images.entries()) {
    const buf = new Uint8Array(await res.arrayBuffer());
    files[assetFilename(listing, names[i])] = buf;
    if (isPrintAsset(names[i])) {
      files[`${listing.slug}-${names[i]}.pdf`] = await pngToLetterPdf(buf, `${ASSETS[names[i]].label} – ${listing.address}`);
    }
  }
  const captions = buildCaptions(listing, lo, buyerUrl)
    .map((c) => `===== ${c.label.toUpperCase()} =====\n\n${c.text}\n`)
    .join("\n");
  files["captions.txt"] = strToU8(captions);
  const emails = buildEmails(listing, lo, buyerUrl)
    .map((e) => `===== ${e.label.toUpperCase()} (${e.audience}) =====\n\nSubject: ${e.subject}\n\n${e.body}\n`)
    .join("\n");
  files["emails.txt"] = strToU8(emails);

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
