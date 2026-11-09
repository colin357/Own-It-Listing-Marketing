"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upload, uploadPresigned } from "@vercel/blob/client";
import { saveAgentHeadshotAction } from "@/app/l/[slug]/actions";

/**
 * Square 800px JPEG. Portraits are cropped a little above centre so the top
 * of the head survives the round frame on the graphics.
 */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) * 0.2;
  const out = Math.min(800, side);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = out;
  canvas.getContext("2d")!.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read that image"))), "image/jpeg", 0.88),
  );
}

export function AgentHeadshotUpload({
  slug,
  mode,
  current,
  name,
}: {
  slug: string;
  mode: "token" | "presigned";
  current?: string;
  name: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const busy = !!status && !status.startsWith("Upload failed");

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setStatus("Uploading…");
      const blob = await (mode === "token" ? upload : uploadPresigned)(`headshots/${slug}/headshot.jpg`, await toSquareJpeg(file), {
        access: "public",
        handleUploadUrl: `/l/${slug}/headshot`,
        contentType: "image/jpeg",
      });
      setStatus("Updating your graphics…");
      const res = await saveAgentHeadshotAction(slug, blob.url);
      if (res.error) throw new Error(res.error);
      router.refresh();
      setStatus(null);
    } catch (err) {
      setStatus(`Upload failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="headshot-intake">
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current} alt={name} className="headshot-preview" />
      ) : (
        <span className="headshot-preview headshot-empty" aria-hidden="true" />
      )}
      <div className="headshot-copy">
        <p className="label">Your headshot</p>
        <p className="muted">
          {current
            ? "On your graphics and buyer page, and on your future kits too."
            : "Add one and it goes on your graphics and buyer page, and on your future kits too."}
        </p>
        <label className={`pill${busy ? " is-busy" : ""}`}>
          {current ? "Change headshot" : "Add headshot"}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={busy}
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {status ? <p className="small">{status}</p> : null}
      </div>
    </div>
  );
}
