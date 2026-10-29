"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upload, uploadPresigned } from "@vercel/blob/client";
import { addAgentPhotosAction } from "@/app/l/[slug]/actions";

/** Resize to ≤2000px JPEG in the browser (also converts HEIC/WebP where the browser can decode it). */
async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), "image/jpeg", 0.86),
  );
}

export function AgentPhotoUpload({ slug, mode }: { slug: string; mode: "token" | "presigned" }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 30);
    const urls: string[] = [];
    try {
      for (const [i, file] of list.entries()) {
        setStatus(`Uploading ${i + 1} of ${list.length}…`);
        const blob = await (mode === "token" ? upload : uploadPresigned)(`listings/${slug}/photo-${i + 1}.jpg`, await toJpeg(file), {
          access: "public",
          handleUploadUrl: `/l/${slug}/photos`,
          contentType: "image/jpeg",
        });
        urls.push(blob.url);
      }
      setStatus("Building your graphics…");
      const res = await addAgentPhotosAction(slug, urls);
      if (res.error) throw new Error(res.error);
      router.refresh();
      setStatus(null);
    } catch (err) {
      setStatus(`Upload failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="photo-intake">
      <label className="pill pill-lg">
        Add listing photos
        <input type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </label>
      <p className="muted small">Choose your best shot first; it becomes the cover. Up to 30 photos.</p>
      {status ? <p className="small">{status}</p> : null}
    </div>
  );
}
