"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";

/** Resize to ≤2000px JPEG in the browser: smaller uploads, and converts WebP/HEIC-on-Safari to JPEG. */
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

export function PhotoField({
  name,
  initial,
  uploadsEnabled,
  folder,
}: {
  name: string;
  initial: string[];
  uploadsEnabled: boolean;
  folder: string;
}) {
  const [photos, setPhotos] = useState<string[]>(initial);
  const [pasted, setPasted] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const addUrls = () => {
    const urls = pasted.split(/[\s,]+/).map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s));
    setPhotos((p) => [...p, ...urls]);
    setPasted("");
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    try {
      for (const [i, file] of list.entries()) {
        setStatus(`Uploading ${i + 1} of ${list.length}…`);
        const jpeg = await toJpeg(file);
        const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-]+/gi, "-").toLowerCase() || "photo";
        const blob = await upload(`${folder}/${base}.jpg`, jpeg, {
          access: "public",
          handleUploadUrl: "/admin/upload",
          contentType: "image/jpeg",
        });
        setPhotos((p) => [...p, blob.url]);
      }
      setStatus(null);
    } catch (err) {
      setStatus(`Upload failed: ${(err as Error).message}`);
    }
  };

  const move = (i: number, to: number) =>
    setPhotos((p) => {
      const next = [...p];
      const [item] = next.splice(i, 1);
      next.splice(to, 0, item);
      return next;
    });

  return (
    <div className="photo-field">
      <input type="hidden" name={name} value={photos.join("\n")} />
      {photos.length ? (
        <ul className="photo-list">
          {photos.map((src, i) => (
            <li key={`${src}-${i}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
              <div className="photo-tools">
                {i === 0 ? <span className="tag">Cover</span> : (
                  <button type="button" onClick={() => move(i, 0)}>Make cover</button>
                )}
                <button type="button" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">No photos yet. The first photo is the cover; the next three fill the collages.</p>
      )}
      <div className="photo-add">
        <textarea
          rows={2}
          placeholder="Paste photo URLs (one per line)"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
        />
        <button type="button" className="btn btn-small" onClick={addUrls} disabled={!pasted.trim()}>
          Add URLs
        </button>
      </div>
      {uploadsEnabled ? (
        <label className="upload">
          <span className="btn btn-small btn-ghost">Upload photos…</span>
          <input type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        </label>
      ) : (
        <p className="muted small">Connect a Vercel Blob store to enable photo uploads.</p>
      )}
      {status ? <p className="small">{status}</p> : null}
    </div>
  );
}
