import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

/**
 * Issues short-lived tokens so the admin form can upload photos straight from
 * the browser to Vercel Blob (bypassing the 4.5 MB serverless body limit).
 * Lives under /admin so it's behind the same basic auth.
 */
export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return Response.json({ error: "Photo uploads need a Vercel Blob store connected to this project." }, { status: 501 });
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/jpeg", "image/png"],
        maximumSizeInBytes: 15 * 1024 * 1024,
        addRandomSuffix: true,
      }),
    });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
