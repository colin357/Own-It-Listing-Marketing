import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";
import { cropRect, isDefaultCrop } from "../headshotCrop";
import type { HeadshotCrop } from "../types";

type Font = { name: string; data: Buffer; weight: 400 | 500 | 600 | 700 | 800 | 900; style: "normal" };

let fontsPromise: Promise<Font[]> | null = null;

export function loadFonts(): Promise<Font[]> {
  fontsPromise ??= (async () => {
    const dir = path.join(process.cwd(), "assets", "fonts");
    const read = (f: string) => fs.readFile(path.join(dir, f));
    const [regular, medium, semibold, extrabold, archivo700, archivo900] = await Promise.all([
      read("Montserrat-Regular.ttf"),
      read("Montserrat-Medium.ttf"),
      read("Montserrat-SemiBold.ttf"),
      read("Montserrat-Bold.ttf"),
      read("Archivo-700.ttf"),
      read("Archivo-900.ttf"),
    ]);
    return [
      { name: "Montserrat", data: regular, weight: 400, style: "normal" },
      { name: "Montserrat", data: medium, weight: 500, style: "normal" },
      { name: "Montserrat", data: semibold, weight: 600, style: "normal" },
      { name: "Montserrat", data: extrabold, weight: 800, style: "normal" },
      { name: "Archivo", data: archivo700, weight: 700, style: "normal" },
      { name: "Archivo", data: archivo900, weight: 900, style: "normal" },
    ];
  })();
  return fontsPromise;
}

/**
 * Fetch a remote image and inline it as a data URI. Every image goes through
 * sharp: Satori only decodes PNG/JPEG (WebP silently renders blank), and
 * full-size MLS photos make renders slow, so we normalize to ≤1600px.
 * Satori aborts the whole render if a single <img> fails, so any failure
 * degrades to `null` and the template draws a fallback instead.
 */
export async function inlineImage(url: string | undefined, maxSize = 1600): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const img = sharp(Buffer.from(await res.arrayBuffer()), { failOn: "none" })
      .rotate()
      .resize({ width: maxSize, height: maxSize, fit: "inside", withoutEnlargement: true });
    const { hasAlpha } = await img.metadata();
    // Keep transparency for logos; everything else becomes a compact JPEG.
    const out = hasAlpha ? await img.png().toBuffer() : await img.jpeg({ quality: 84, mozjpeg: true }).toBuffer();
    return `data:image/${hasAlpha ? "png" : "jpeg"};base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function qrDataUrl(text: string, color = "#111111"): Promise<string> {
  return QRCode.toDataURL(text, { margin: 1, width: 360, color: { dark: color, light: "#ffffff" } });
}

/**
 * A headshot cut to the square chosen in admin, as a JPEG. `null` when the
 * image can't be fetched or read.
 */
export async function croppedHeadshot(url: string, crop: HeadshotCrop, size = 400): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    // Apply EXIF rotation first so the crop matches what the admin preview showed.
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()), { failOn: "none" })
      .rotate()
      .toBuffer({ resolveWithObject: true });
    const r = cropRect(info.width, info.height, crop);
    const box = {
      left: Math.round(r.left),
      top: Math.round(r.top),
      width: Math.max(1, Math.min(Math.round(r.size), info.width - Math.round(r.left))),
      height: Math.max(1, Math.min(Math.round(r.size), info.height - Math.round(r.top))),
    };
    return await sharp(data)
      .extract(box)
      .resize({ width: size, height: size, fit: "cover" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

/** The loan officer's headshot for graphics: cropped when a crop was saved, else as uploaded. */
export async function inlineHeadshot(url: string | undefined, crop: HeadshotCrop | undefined): Promise<string | null> {
  if (!url) return null;
  if (isDefaultCrop(crop)) return inlineImage(url, 400);
  const out = await croppedHeadshot(url, crop!);
  return out ? `data:image/jpeg;base64,${out.toString("base64")}` : inlineImage(url, 400);
}
