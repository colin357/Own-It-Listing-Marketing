import type { HeadshotCrop, LoanOfficer } from "./types";

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export const DEFAULT_CROP: HeadshotCrop = { x: 0.5, y: 0.5, zoom: 1 };

/**
 * The square (in pixels) a crop takes from a w×h image. `x`/`y` are the
 * square's centre as a fraction of the image; zoom 1 is the largest square
 * that fits. The square is pushed back inside the image if it would overhang.
 */
export function cropRect(w: number, h: number, crop: HeadshotCrop = DEFAULT_CROP) {
  const zoom = clamp(crop.zoom, MIN_ZOOM, MAX_ZOOM);
  const size = Math.min(w, h) / zoom;
  const left = clamp(crop.x * w - size / 2, 0, w - size);
  const top = clamp(crop.y * h - size / 2, 0, h - size);
  return { left, top, size };
}

/** Same crop with its centre moved so the square stays inside the image. */
export function clampCrop(w: number, h: number, crop: HeadshotCrop): HeadshotCrop {
  const { left, top, size } = cropRect(w, h, crop);
  return { x: round((left + size / 2) / w), y: round((top + size / 2) / h), zoom: round(clamp(crop.zoom, MIN_ZOOM, MAX_ZOOM)) };
}

export function isDefaultCrop(c: HeadshotCrop | undefined): boolean {
  return !c || (c.zoom === 1 && c.x === 0.5 && c.y === 0.5);
}

/** Key that changes whenever the LO's headshot or its crop changes (cache busting). */
export function headshotKey(lo: Pick<LoanOfficer, "headshotUrl" | "headshotCrop">): string {
  if (!lo.headshotUrl) return "0";
  const c = lo.headshotCrop;
  return shortHash(c ? `${lo.headshotUrl}|${c.x}|${c.y}|${c.zoom}` : lo.headshotUrl);
}

/**
 * Where web pages load the LO's headshot from: the original URL, or the
 * cropped square when Own It has adjusted the crop in admin.
 */
export function loHeadshotSrc(lo: LoanOfficer): string | undefined {
  if (!lo.headshotUrl) return undefined;
  if (isDefaultCrop(lo.headshotCrop)) return lo.headshotUrl;
  return `/lo/${lo.slug}/headshot?v=${headshotKey(lo)}`;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function shortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
