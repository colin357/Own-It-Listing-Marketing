import "server-only";
import { handleUpload, handleUploadPresigned, type HandleUploadBody } from "@vercel/blob/client";
import { issueSignedToken } from "@vercel/blob";

/**
 * Vercel Blob stores connect in one of two ways: older stores inject
 * BLOB_READ_WRITE_TOKEN; newer ones inject BLOB_STORE_ID and authenticate
 * with the deployment's OIDC token, which only supports presigned uploads.
 */
export type BlobMode = "token" | "presigned";

export function blobMode(): BlobMode | null {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "token";
  if (process.env.BLOB_STORE_ID) return "presigned";
  return null;
}

const ALLOWED = ["image/jpeg", "image/png"];
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Server half of a browser upload. `checkPath` throws to refuse a pathname.
 * The browser must call `upload` in token mode and `uploadPresigned` otherwise.
 */
export async function handleBrowserUpload(req: Request, checkPath: (pathname: string) => void = () => {}) {
  const body = await req.json();
  if (blobMode() === "token")
    return handleUpload({
      body: body as HandleUploadBody,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        checkPath(pathname);
        return { allowedContentTypes: ALLOWED, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true };
      },
    });
  return handleUploadPresigned({
    body,
    request: req,
    getSignedToken: async (pathname) => {
      checkPath(pathname);
      const token = await issueSignedToken({
        pathname,
        operations: ["put"],
        allowedContentTypes: ALLOWED,
        maximumSizeInBytes: MAX_BYTES,
      });
      return {
        token,
        urlOptions: { allowedContentTypes: ALLOWED, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true },
      };
    },
  });
}
