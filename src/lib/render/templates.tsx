/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */
import type { CSSProperties, ReactNode } from "react";
import type { Listing, LoanOfficer } from "../types";
import {
  cityLine,
  complianceLine,
  formatNumber,
  formatOpenHouse,
  formatPrice,
  INK,
  LINE,
  PAPER,
  paymentInfo,
  statusLabel,
  streetLine,
} from "../format";

/**
 * Satori templates (rendered to PNG by next/og). Satori supports a subset of
 * CSS: flexbox only, and every element with more than one child needs an
 * explicit `display: flex`.
 *
 * Visual language follows ownitsocial.com: Archivo Black uppercase
 * headlines with tight tracking, letter-spaced Archivo labels, Montserrat
 * body copy, square cards with hairline borders and a single accent color.
 */

export interface RenderData {
  listing: Listing;
  lo: LoanOfficer;
  photos: (string | null)[];
  loHeadshot: string | null;
  agentHeadshot: string | null;
  logo: string | null;
  applyQr: string | null;
  listingQr: string | null;
  brand: string;
  accent: string;
  onBrand: string;
  onAccent: string;
}

const MUTED = "#5b5b5b";
const fill: CSSProperties = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 };

/* ---------------------------- type helpers ----------------------------- */

function head(size: number, color: string): CSSProperties {
  return {
    fontFamily: "Archivo",
    fontWeight: 900,
    fontSize: size,
    lineHeight: 0.92,
    letterSpacing: -size * 0.02,
    textTransform: "uppercase",
    color,
  };
}

function label(size: number, color: string, weight: 700 | 900 = 700): CSSProperties {
  return {
    fontFamily: "Archivo",
    fontWeight: weight,
    fontSize: size,
    letterSpacing: size * 0.12,
    textTransform: "uppercase",
    color,
  };
}

function body(size: number, color: string, weight = 400): CSSProperties {
  return { fontFamily: "Montserrat", fontWeight: weight, fontSize: size, color, lineHeight: 1.35 };
}

/** Largest font size (≤ max) at which `text` fits in `width` px of Archivo Black caps. */
function fit(text: string, width: number, max: number): number {
  const em = [...text].reduce((w, ch) => w + (ch === " " ? 0.26 : /[.,']/.test(ch) ? 0.3 : /[MW]/.test(ch) ? 0.95 : 0.72), 0);
  return Math.floor(Math.min(max, width / em));
}

/** "Just Listed" → ["JUST", "LISTED."] */
function headlineLines(l: Listing): string[] {
  const words = statusLabel(l).toUpperCase().split(" ");
  words[words.length - 1] += ".";
  return words;
}

function Headline({ l, width, max, color }: { l: Listing; width: number; max: number; color: string }) {
  const lines = headlineLines(l);
  const size = Math.min(...lines.map((t) => fit(t, width, max)));
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {lines.map((t) => (
        <div key={t} style={{ display: "flex", ...head(size, color) }}>
          {t}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- components ------------------------------ */

function Photo({ src, style }: { src: string | null; style?: CSSProperties }) {
  if (src) return <img src={src} style={{ objectFit: "cover", ...style }} />;
  return <div style={{ display: "flex", background: "#2a2a2a", ...style }} />;
}

function Avatar({ src, name, size, ring }: { src: string | null; name: string; size: number; ring: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const box: CSSProperties = { width: size, height: size, borderRadius: size, border: `3px solid ${ring}` };
  if (src) return <img src={src} style={{ ...box, objectFit: "cover" }} />;
  return (
    <div style={{ ...box, display: "flex", alignItems: "center", justifyContent: "center", background: PAPER }}>
      <div style={{ display: "flex", ...head(size * 0.36, INK) }}>{initials}</div>
    </div>
  );
}

function Pill({ text, bg, color, size }: { text: string; bg: string; color: string; size: number }) {
  return (
    <div
      style={{
        display: "flex",
        background: bg,
        borderRadius: 999,
        padding: `${size * 0.7}px ${size * 1.4}px`,
        ...label(size, color),
      }}
    >
      {text}
    </div>
  );
}

function Person({
  photo,
  name,
  sub,
  size,
  color,
  subColor,
  ring,
  align = "left",
}: {
  photo: string | null;
  name: string;
  sub: (string | undefined)[];
  size: number;
  color: string;
  subColor: string;
  ring: string;
  align?: "left" | "right";
}) {
  const right = align === "right";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.22, flexDirection: right ? "row-reverse" : "row" }}>
      <Avatar src={photo} name={name} size={size} ring={ring} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: right ? "flex-end" : "flex-start", gap: 2 }}>
        <div style={{ display: "flex", ...label(size * 0.22, color, 900) }}>{name}</div>
        {sub.filter(Boolean).map((t, i) => (
          <div key={i} style={{ display: "flex", ...body(size * 0.19, subColor) }}>
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

function agentPerson(d: RenderData, size: number, color: string, subColor: string, ring: string) {
  const a = d.listing.agent;
  return <Person photo={d.agentHeadshot} name={a.name} sub={[a.brokerage, a.phone]} size={size} color={color} subColor={subColor} ring={ring} />;
}

function loPerson(d: RenderData, size: number, color: string, subColor: string, ring: string) {
  return (
    <Person
      photo={d.loHeadshot}
      name={d.lo.name}
      sub={[`NMLS #${d.lo.nmls}`, d.lo.phone]}
      size={size}
      color={color}
      subColor={subColor}
      ring={ring}
      align="right"
    />
  );
}

function Compliance({ d, size, color }: { d: RenderData; size: number; color: string }) {
  const pay = paymentInfo(d.listing, d.lo);
  const text = [complianceLine(d.lo), pay?.disclaimer, d.lo.disclaimer].filter(Boolean).join("  ");
  return <div style={{ display: "flex", ...body(size, color), lineHeight: 1.3 }}>{text}</div>;
}

function statItems(l: Listing): [string, string][] {
  const items: [string, string][] = [];
  if (l.beds != null) items.push([String(l.beds), "Beds"]);
  if (l.baths != null) items.push([String(l.baths), "Baths"]);
  if (l.sqft != null) items.push([formatNumber(l.sqft), "Sq Ft"]);
  return items;
}

/** Inline "4 BEDS  /  3 BATHS  /  2,450 SQ FT" */
function StatsInline({ l, size, color, dim }: { l: Listing; size: number; color: string; dim: string }) {
  const items = statItems(l);
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: size * 0.9 }}>
      {items.map(([v, k]) => (
        <div key={k} style={{ display: "flex", alignItems: "baseline", gap: size * 0.3 }}>
          <div style={{ display: "flex", ...head(size, color), lineHeight: 1 }}>{v}</div>
          <div style={{ display: "flex", ...label(size * 0.5, dim) }}>{k}</div>
        </div>
      ))}
    </div>
  );
}

/** Square stat boxes with hairline borders (website "card" style). */
function StatBoxes({ l, size, width }: { l: Listing; size: number; width: number }) {
  const items = statItems(l);
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", border: `2px solid ${LINE}`, background: "#fff" }}>
      {items.map(([v, k], i) => (
        <div
          key={k}
          style={{
            display: "flex",
            flexDirection: "column",
            width: width / items.length,
            padding: `${size * 0.45}px ${size * 0.55}px`,
            borderLeft: i ? `2px solid ${LINE}` : "none",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", ...head(size, INK), lineHeight: 1 }}>{v}</div>
          <div style={{ display: "flex", ...label(size * 0.36, MUTED) }}>{k}</div>
        </div>
      ))}
    </div>
  );
}

function openHousePill(d: RenderData, size: number) {
  const oh = formatOpenHouse(d.listing);
  return oh ? <Pill text={`Open House · ${oh}`} bg={d.accent} color={d.onAccent} size={size} /> : null;
}

function payLabel(d: RenderData) {
  const pay = paymentInfo(d.listing, d.lo);
  return pay ? `Est. ${pay.label}` : null;
}

/* ------------------------------ templates ------------------------------ */

/** 1080×1080 — Instagram / Facebook feed post. */
export function SquarePost(d: RenderData) {
  const l = d.listing;
  const pay = payLabel(d);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#fff" }}>
      <div style={{ display: "flex", position: "relative", flexGrow: 1 }}>
        <Photo src={d.photos[0]} style={{ ...fill, width: "100%", height: "100%" }} />
        <div
          style={{
            ...fill,
            display: "flex",
            backgroundImage:
              "linear-gradient(180deg, rgba(10,10,10,0.72) 0%, rgba(10,10,10,0) 38%, rgba(10,10,10,0) 50%, rgba(10,10,10,0.85) 100%)",
          }}
        />
        <div style={{ position: "absolute", top: 52, left: 56, right: 56, display: "flex", flexDirection: "column", gap: 22 }}>
          <Headline l={l} width={760} max={150} color="#fff" />
          <div style={{ display: "flex" }}>{openHousePill(d, 20)}</div>
        </div>
        <div style={{ position: "absolute", left: 56, right: 56, bottom: 44, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <div style={{ display: "flex", ...head(88, "#fff") }}>{formatPrice(l.price)}</div>
            {pay ? <div style={{ display: "flex", ...label(20, "rgba(255,255,255,0.85)") }}>{pay}</div> : null}
          </div>
          <div style={{ display: "flex", ...label(26, "#fff", 900) }}>{`${streetLine(l)} · ${cityLine(l)}`}</div>
          <StatsInline l={l} size={34} color="#fff" dim="rgba(255,255,255,0.75)" />
        </div>
      </div>
      <div style={{ display: "flex", height: 12, background: d.accent }} />
      <div style={{ display: "flex", flexDirection: "column", padding: "26px 56px 22px", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {agentPerson(d, 92, INK, MUTED, LINE)}
          {loPerson(d, 92, INK, MUTED, LINE)}
        </div>
        <Compliance d={d} size={13} color={MUTED} />
      </div>
    </div>
  );
}

/** 1080×1920 — Instagram / Facebook story & Reels cover. */
export function StoryPost(d: RenderData) {
  const l = d.listing;
  const pay = payLabel(d);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: INK }}>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 84, background: d.accent }}>
        <div style={{ display: "flex", ...label(24, d.onAccent) }}>{`New in ${l.city}, ${l.state}`}</div>
      </div>
      <div style={{ display: "flex", position: "relative", height: 960 }}>
        <Photo src={d.photos[0]} style={{ ...fill, width: "100%", height: "100%" }} />
        <div
          style={{ ...fill, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(10,10,10,0) 45%, rgba(10,10,10,0.92) 100%)" }}
        />
        <div style={{ position: "absolute", left: 64, right: 64, bottom: 40, display: "flex" }}>
          <Headline l={l} width={900} max={200} color="#fff" />
        </div>
      </div>
      <div style={{ display: "flex", height: 280, gap: 8, paddingTop: 8 }}>
        <Photo src={d.photos[1] ?? d.photos[0]} style={{ width: 536, height: "100%" }} />
        <Photo src={d.photos[2] ?? d.photos[0]} style={{ width: 536, height: "100%" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: "44px 64px 34px", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 22 }}>
          <div style={{ display: "flex", ...head(100, "#fff") }}>{formatPrice(l.price)}</div>
          {pay ? <div style={{ display: "flex", ...label(22, "rgba(255,255,255,0.7)") }}>{pay}</div> : null}
        </div>
        <div style={{ display: "flex", ...label(28, "#fff", 900) }}>{`${streetLine(l)} · ${cityLine(l)}`}</div>
        <StatsInline l={l} size={38} color="#fff" dim="rgba(255,255,255,0.6)" />
        <div style={{ display: "flex" }}>{openHousePill(d, 22)}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: "auto" }}>
          <div style={{ display: "flex", height: 1, background: "rgba(255,255,255,0.2)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {agentPerson(d, 100, "#fff", "rgba(255,255,255,0.65)", "rgba(255,255,255,0.3)")}
            {loPerson(d, 100, "#fff", "rgba(255,255,255,0.65)", "rgba(255,255,255,0.3)")}
          </div>
          <Compliance d={d} size={14} color="rgba(255,255,255,0.5)" />
        </div>
      </div>
    </div>
  );
}

/** 1200×630 — Facebook / LinkedIn / X link post. Also the page's OG image. */
export function LandscapePost(d: RenderData) {
  const l = d.listing;
  const pay = payLabel(d);
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: INK }}>
      <div style={{ display: "flex", flexDirection: "column", width: 540, padding: "44px 44px 26px", gap: 14 }}>
        <Headline l={l} width={452} max={96} color="#fff" />
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 10 }}>
          <div style={{ display: "flex", ...head(54, "#fff") }}>{formatPrice(l.price)}</div>
          {pay ? <div style={{ display: "flex", ...label(14, "rgba(255,255,255,0.7)") }}>{pay}</div> : null}
        </div>
        <div style={{ display: "flex", ...label(17, "#fff", 900) }}>{streetLine(l)}</div>
        <div style={{ display: "flex", ...label(14, "rgba(255,255,255,0.65)") }}>{cityLine(l)}</div>
        <StatsInline l={l} size={26} color="#fff" dim="rgba(255,255,255,0.6)" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
          <div style={{ display: "flex", gap: 22 }}>
            <Person
              photo={d.agentHeadshot}
              name={l.agent.name}
              sub={[l.agent.brokerage]}
              size={58}
              color="#fff"
              subColor="rgba(255,255,255,0.65)"
              ring="rgba(255,255,255,0.3)"
            />
            <Person
              photo={d.loHeadshot}
              name={d.lo.name}
              sub={[`NMLS #${d.lo.nmls}`]}
              size={58}
              color="#fff"
              subColor="rgba(255,255,255,0.65)"
              ring="rgba(255,255,255,0.3)"
            />
          </div>
          <Compliance d={d} size={9} color="rgba(255,255,255,0.5)" />
        </div>
      </div>
      <div style={{ display: "flex", width: 10, background: d.accent }} />
      <div style={{ display: "flex", position: "relative", width: 650 }}>
        <Photo src={d.photos[0]} style={{ ...fill, width: "100%", height: "100%" }} />
        {formatOpenHouse(l) ? (
          <div style={{ position: "absolute", left: 24, bottom: 24, display: "flex" }}>{openHousePill(d, 14)}</div>
        ) : null}
      </div>
    </div>
  );
}

/** 1080×1350 — 4:5 portrait "feature" post with a photo grid and highlights. */
export function DetailsPost(d: RenderData) {
  const l = d.listing;
  const p = d.photos;
  const pay = payLabel(d);
  const highlights = l.highlights.slice(0, 4);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: PAPER }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "48px 56px 28px" }}>
        <Headline l={l} width={600} max={110} color={INK} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <div style={{ display: "flex", ...head(64, INK) }}>{formatPrice(l.price)}</div>
          {pay ? <div style={{ display: "flex", ...label(17, d.accent) }}>{pay}</div> : null}
        </div>
      </div>
      <div style={{ display: "flex", height: 560, gap: 8, padding: "0 56px" }}>
        <Photo src={p[0]} style={{ width: 640, height: "100%" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flexGrow: 1 }}>
          <Photo src={p[1] ?? p[0]} style={{ width: "100%", height: 276 }} />
          <Photo src={p[2] ?? p[0]} style={{ width: "100%", height: 276 }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", padding: "28px 56px 0", gap: 18, flexGrow: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", ...label(26, INK, 900) }}>{streetLine(l)}</div>
            <div style={{ display: "flex", ...label(18, MUTED) }}>{cityLine(l)}</div>
          </div>
          {openHousePill(d, 16)}
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          <StatBoxes l={l} size={36} width={450} />
          <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
            {highlights.map((h, i) => (
              <div
                key={h}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "7px 0",
                  borderTop: i ? `2px solid ${LINE}` : "none",
                  ...body(19, INK, 500),
                }}
              >
                <div style={{ display: "flex", width: 8, height: 8, borderRadius: 8, background: d.accent }} />
                {h}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", background: "#fff", borderTop: `2px solid ${LINE}`, padding: "22px 56px 18px", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {agentPerson(d, 80, INK, MUTED, LINE)}
          {loPerson(d, 80, INK, MUTED, LINE)}
        </div>
        <Compliance d={d} size={12} color={MUTED} />
      </div>
    </div>
  );
}

/** 1275×1650 — US Letter flyer at 150 dpi (print-ready PNG). */
export function Flyer(d: RenderData) {
  const l = d.listing;
  const p = d.photos;
  const pay = payLabel(d);
  const qrs: { src: string; label: string }[] = [];
  if (d.listingQr) qrs.push({ src: d.listingQr, label: "View listing" });
  if (d.applyQr && l.status !== "just-sold") qrs.push({ src: d.applyQr, label: "Get pre-approved" });
  const qrSize = qrs.length > 1 ? 130 : 160;

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", background: INK, padding: "44px 60px 36px" }}>
        <Headline l={l} width={720} max={130} color="#fff" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          <div style={{ display: "flex", ...label(20, "rgba(255,255,255,0.65)") }}>{`${l.city}, ${l.state}`}</div>
          {d.logo ? <img src={d.logo} style={{ height: 56, objectFit: "contain" }} /> : null}
        </div>
      </div>
      <div style={{ display: "flex", height: 10, background: d.accent }} />
      <div style={{ display: "flex", position: "relative", height: 530 }}>
        <Photo src={p[0]} style={{ ...fill, width: "100%", height: "100%" }} />
        {formatOpenHouse(l) ? <div style={{ position: "absolute", left: 60, bottom: 30, display: "flex" }}>{openHousePill(d, 20)}</div> : null}
      </div>
      <div style={{ display: "flex", height: 190, gap: 8, paddingTop: 8 }}>
        {[1, 2, 3].map((i) => (
          <Photo key={i} src={p[i] ?? p[0]} style={{ width: 420, height: "100%" }} />
        ))}
      </div>
      <div style={{ display: "flex", padding: "30px 60px 30px", gap: 36, flexGrow: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", width: 740, gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", ...head(52, INK), lineHeight: 1 }}>{streetLine(l)}</div>
            <div style={{ display: "flex", ...label(18, MUTED) }}>{cityLine(l)}</div>
          </div>
          <StatBoxes l={l} size={38} width={740} />
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {l.highlights.slice(0, 4).map((h) => (
              <div key={h} style={{ display: "flex", alignItems: "center", gap: 10, width: 370, padding: "5px 0", ...body(18, INK, 500) }}>
                <div style={{ display: "flex", width: 8, height: 8, borderRadius: 8, background: d.accent }} />
                {h}
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: 380,
            height: 360,
            background: d.accent,
            padding: "26px 20px",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", ...label(16, d.onAccent) }}>Offered at</div>
          <div style={{ display: "flex", ...head(58, d.onAccent) }}>{formatPrice(l.price)}</div>
          {pay ? <div style={{ display: "flex", ...label(15, d.onAccent) }}>{pay}</div> : null}
          <div style={{ display: "flex", gap: 16, marginTop: "auto" }}>
            {qrs.map((q) => (
              <div key={q.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", background: "#fff", padding: 8 }}>
                  <img src={q.src} style={{ width: qrSize, height: qrSize }} />
                </div>
                <div style={{ display: "flex", ...label(12, d.onAccent) }}>{q.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", background: PAPER, borderTop: `2px solid ${LINE}`, padding: "24px 60px 20px", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Person
            photo={d.agentHeadshot}
            name={l.agent.name}
            sub={[l.agent.brokerage, [l.agent.phone, l.agent.email].filter(Boolean).join(" · ")]}
            size={104}
            color={INK}
            subColor={MUTED}
            ring={LINE}
          />
          <Person
            photo={d.loHeadshot}
            name={d.lo.name}
            sub={[
              [d.lo.title, `NMLS #${d.lo.nmls}`].filter(Boolean).join(" · "),
              d.lo.company,
              [d.lo.phone, d.lo.email].filter(Boolean).join(" · "),
            ]}
            size={104}
            color={INK}
            subColor={MUTED}
            ring={LINE}
            align="right"
          />
        </div>
        <Compliance d={d} size={13} color={MUTED} />
      </div>
    </div>
  );
}

export const ASSETS = {
  square: { label: "Feed post", use: "Instagram · Facebook", size: "1080 × 1080", width: 1080, height: 1080, render: SquarePost },
  details: { label: "Feature post", use: "Instagram 4:5", size: "1080 × 1350", width: 1080, height: 1350, render: DetailsPost },
  story: { label: "Story", use: "Stories · Reels cover", size: "1080 × 1920", width: 1080, height: 1920, render: StoryPost },
  landscape: { label: "Link post", use: "Facebook · LinkedIn", size: "1200 × 630", width: 1200, height: 630, render: LandscapePost },
  flyer: { label: "Flyer", use: "Print · 8.5 × 11", size: "1275 × 1650", width: 1275, height: 1650, render: Flyer },
} satisfies Record<
  string,
  { label: string; use: string; size: string; width: number; height: number; render: (d: RenderData) => ReactNode }
>;

export type AssetName = keyof typeof ASSETS;

export function isAssetName(s: string): s is AssetName {
  return s in ASSETS;
}
