import { ImageResponse } from "next/og";
import { PLAN } from "@/lib/plan";
import { renderAssets } from "@/lib/render/render";
import { loadFonts } from "@/lib/render/resources";
import { sampleKit } from "@/lib/sample";

// Made once per deploy at build time, like the /sample graphics.
export const dynamic = "force-static";

const INK = "#0A0A0A";
const PAPER = "#F4F3F1";
const PURPLE = "#8B3DFF";

/** The 1200×630 preview Facebook, iMessage and LinkedIn show when someone shares the landing page. */
export async function GET() {
  const [fonts, sample] = await Promise.all([
    loadFonts(),
    sampleKit()
      .then(({ listing, lo }) => renderAssets(listing, lo, ["square"], "https://kits.ownitsocial.com"))
      .then(async (r) => `data:image/png;base64,${Buffer.from(await r[0].arrayBuffer()).toString("base64")}`)
      .catch(() => null),
  ]);
  const display = { fontFamily: "Archivo", fontWeight: 900, textTransform: "uppercase" as const, letterSpacing: -2 };
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, color: INK, fontFamily: "Montserrat" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 0 60px 72px" }}>
          <div style={{ display: "flex", flexDirection: "column", ...display, fontSize: 30, lineHeight: 0.95, letterSpacing: 0 }}>
            <span>Own It</span>
            <span>Social</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", ...display, fontSize: 76, lineHeight: 0.95 }}>
            <span>Listing marketing</span>
            <span style={{ color: PURPLE }}>for your agents.</span>
          </div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 500, lineHeight: 1.35, maxWidth: 560 }}>
            A finished marketing kit for every new listing, with your name on it. {PLAN.trialDays}-day free trial.
          </div>
        </div>
        {sample ? (
          <div style={{ width: 400, display: "flex", alignItems: "center", paddingRight: 64 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sample} width={336} height={336} style={{ boxShadow: "0 18px 50px rgba(10,10,10,0.18)" }} alt="" />
          </div>
        ) : null}
      </div>
    ),
    { width: 1200, height: 630, fonts, headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } },
  );
}
