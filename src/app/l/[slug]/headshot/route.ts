import { blobMode, handleBrowserUpload } from "@/lib/blob";
import { listings } from "@/lib/store";

/** Upload tokens for the agent's headshot, into this kit's headshots/<slug>/ folder. */
export async function POST(req: Request, ctx: RouteContext<"/l/[slug]/headshot">) {
  if (!blobMode()) return Response.json({ error: "Uploads aren't set up yet." }, { status: 501 });
  const { slug } = await ctx.params;
  if (!(await listings.get(slug))) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    return Response.json(
      await handleBrowserUpload(req, (pathname) => {
        if (!pathname.startsWith(`headshots/${slug}/`)) throw new Error("Invalid upload path");
      }),
    );
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
