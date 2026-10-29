import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { listings } from "@/lib/store";

/**
 * Upload tokens for the agent's own photos, for kits created without any
 * (e.g. detected listings whose photos couldn't be found). Only open while
 * the listing has no photos, so a shared link can't be used to swap them later.
 */
export async function POST(req: Request, ctx: RouteContext<"/l/[slug]/photos">) {
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return Response.json({ error: "Photo uploads aren't set up yet." }, { status: 501 });
  const { slug } = await ctx.params;
  const listing = await listings.get(slug);
  if (!listing) return Response.json({ error: "Not found" }, { status: 404 });
  if (listing.photos.length) return Response.json({ error: "This listing already has photos." }, { status: 409 });
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(`listings/${slug}/`)) throw new Error("Invalid upload path");
        return {
          allowedContentTypes: ["image/jpeg", "image/png"],
          maximumSizeInBytes: 15 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
