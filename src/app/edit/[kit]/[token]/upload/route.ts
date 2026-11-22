import { blobMode, handleBrowserUpload } from "@/lib/blob";
import { validKitEditToken } from "@/lib/loLinks";
import { listings } from "@/lib/store";

/** Upload tokens for photos the loan officer adds on their private edit page. */
export async function POST(req: Request, ctx: RouteContext<"/edit/[kit]/[token]/upload">) {
  const { kit, token } = await ctx.params;
  if (!validKitEditToken(kit, token) || !(await listings.get(kit)))
    return Response.json({ error: "Not found" }, { status: 404 });
  if (!blobMode()) return Response.json({ error: "Photo uploads aren't set up yet." }, { status: 501 });
  try {
    return Response.json(
      await handleBrowserUpload(req, (pathname) => {
        if (!pathname.startsWith(`listings/${kit}/`)) throw new Error("Invalid upload path");
      }),
    );
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
