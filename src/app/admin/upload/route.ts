import { blobMode, handleBrowserUpload } from "@/lib/blob";

/**
 * Lets the admin form upload photos straight from the browser to Vercel Blob
 * (bypassing the 4.5 MB serverless body limit). Lives under /admin so it's
 * behind the same basic auth.
 */
export async function POST(req: Request) {
  if (!blobMode())
    return Response.json({ error: "Photo uploads need a Vercel Blob store connected to this project." }, { status: 501 });
  try {
    return Response.json(await handleBrowserUpload(req));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
