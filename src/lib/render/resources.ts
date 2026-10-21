import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";

type Font = { name: string; data: Buffer; weight: 400 | 600 | 800 | 700; style: "normal" };

let fontsPromise: Promise<Font[]> | null = null;

export function loadFonts(): Promise<Font[]> {
  fontsPromise ??= (async () => {
    const dir = path.join(process.cwd(), "assets", "fonts");
    const read = (f: string) => fs.readFile(path.join(dir, f));
    const [regular, semibold, bold, serif] = await Promise.all([
      read("Montserrat-Regular.ttf"),
      read("Montserrat-SemiBold.ttf"),
      read("Montserrat-Bold.ttf"),
      read("PlayfairDisplay-Bold.ttf"),
    ]);
    return [
      { name: "Montserrat", data: regular, weight: 400, style: "normal" },
      { name: "Montserrat", data: semibold, weight: 600, style: "normal" },
      { name: "Montserrat", data: bold, weight: 800, style: "normal" },
      { name: "Playfair", data: serif, weight: 700, style: "normal" },
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
