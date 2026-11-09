import { blobMode, handleBrowserUpload } from "@/lib/blob";
import { validAccountToken } from "@/lib/loLinks";

/** Upload tokens for a loan officer's headshot and logo, into lo/<slug>/. */
export async function POST(req: Request, ctx: RouteContext<"/account/[slug]/[token]/upload">) {
  if (!blobMode()) return Response.json({ error: "Uploads aren't set up yet." }, { status: 501 });
  const { slug, token } = await ctx.params;
  if (!validAccountToken(slug, token)) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    return Response.json(
      await handleBrowserUpload(req, (pathname) => {
        if (!pathname.startsWith(`lo/${slug}/`)) throw new Error("Invalid upload path");
      }),
    );
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
