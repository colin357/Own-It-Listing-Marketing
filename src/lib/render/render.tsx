import "server-only";
import { ImageResponse } from "next/og";
import type { Listing, LoanOfficer } from "../types";
import { brandColors } from "../format";
import { inlineImage, loadFonts, qrDataUrl } from "./resources";
import { ASSETS, type AssetName, type RenderData } from "./templates";

async function buildRenderData(listing: Listing, lo: LoanOfficer): Promise<RenderData> {
  const colors = brandColors(lo);
  const [photos, loHeadshot, agentHeadshot, logo, applyQr, listingQr] = await Promise.all([
    // Fetch a couple of spares so a broken URL doesn't leave a slot empty.
    Promise.all(listing.photos.slice(0, 6).map((url) => inlineImage(url))),
    inlineImage(lo.headshotUrl, 400),
    inlineImage(listing.agent.headshotUrl, 400),
    inlineImage(lo.logoUrl, 600),
    lo.applyUrl ? qrDataUrl(lo.applyUrl) : null,
    listing.listingUrl ? qrDataUrl(listing.listingUrl) : null,
  ]);
  const usable = photos.filter((p): p is string => !!p).slice(0, 4);
  return {
    listing,
    lo,
    photos: usable.length ? usable : [null],
    loHeadshot,
    agentHeadshot,
    logo,
    applyQr,
    listingQr,
    ...colors,
  };
}

/** Render several assets for one listing, sharing fetched photos/fonts. */
export async function renderAssets(
  listing: Listing,
  lo: LoanOfficer,
  names: AssetName[],
  headers?: Record<string, string>,
): Promise<ImageResponse[]> {
  const [data, fonts] = await Promise.all([buildRenderData(listing, lo), loadFonts()]);
  return names.map((name) => {
    const a = ASSETS[name];
    return new ImageResponse(a.render(data), { width: a.width, height: a.height, fonts, headers });
  });
}

export function assetFilename(listing: Listing, name: AssetName): string {
  return `${listing.slug}-${name}.png`;
}
