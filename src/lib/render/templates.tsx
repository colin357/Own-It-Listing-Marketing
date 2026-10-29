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
import { paymentOptions, type PaymentOptions, type ProgramOptions } from "../mortgage";
import { activeConcession, concessionSentence, concessionTag } from "../concessions";

/**
 * Satori templates (rendered to PNG by next/og). Satori supports a subset of
 * CSS: flexbox only, and every element with more than one child needs an
 * explicit `display: flex`.
 *
 * Visual language follows ownitsocial.com: Archivo Black uppercase
 * headlines with tight tracking, letter-spaced Archivo labels, Montserrat
 * body copy, square cards with hairline borders and a single accent color.
 *
 * Surfaces stay light (white / paper) so any lender logo reads on them; dark
 * is only used as a shade over photos.
 */

/** Bump when templates change so cached PNGs/PDFs are re-rendered. */
export const TEMPLATE_VERSION = "3";

/** Cache key for a listing's graphics: changes with the templates, the listing and the rates shown. */
export function assetVersion(l: Listing): string {
  const f = l.financing;
  const rates = f && l.showPayment ? [f.ratePct, f.aprPct, f.fhaRatePct, f.vaRatePct].join("_") : "none";
  const credit = l.concession ? `${l.concession.amount}${l.concession.type}` : "0";
  return `${TEMPLATE_VERSION}-${l.updatedAt}-${rates}-${credit}`;
}

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
  payments: PaymentOptions | null;
  programs: ProgramOptions | null;
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
  // Without a photo the name block carries the space on its own, a bit larger.
  const k = photo ? 1 : 1.12;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.22, flexDirection: right ? "row-reverse" : "row" }}>
      {photo ? <Avatar src={photo} name={name} size={size} ring={ring} /> : null}
      <div style={{ display: "flex", flexDirection: "column", alignItems: right ? "flex-end" : "flex-start", gap: 2 }}>
        <div style={{ display: "flex", ...label(size * 0.22 * k, color, 900) }}>{name}</div>
        {sub.filter(Boolean).map((t, i) => (
          <div key={i} style={{ display: "flex", ...body(size * 0.19 * k, subColor) }}>
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The loan officer (name, NMLS, logo, pre-approval QR, lender disclosures)
 * appears only on graphics that mention a payment. Otherwise it's purely the
 * agent's listing post.
 */
function showsLo(d: RenderData): boolean {
  return paymentInfo(d.listing, d.lo) != null || activeConcession(d.listing) != null;
}

/**
 * Headshots for the agent + loan officer pair. Both or neither, so the loan
 * officer never looks like the star of the agent's listing.
 */
function pairPhotos(d: RenderData): { agent: string | null; lo: string | null } {
  if (!showsLo(d)) return { agent: d.agentHeadshot, lo: null };
  return d.agentHeadshot && d.loHeadshot ? { agent: d.agentHeadshot, lo: d.loHeadshot } : { agent: null, lo: null };
}

function agentPerson(d: RenderData, size: number, color: string, subColor: string, ring: string) {
  const a = d.listing.agent;
  return <Person photo={pairPhotos(d).agent} name={a.name} sub={[a.brokerage, a.phone]} size={size} color={color} subColor={subColor} ring={ring} />;
}

function loPerson(d: RenderData, size: number, color: string, subColor: string, ring: string) {
  if (!showsLo(d)) return null;
  return (
    <Person
      photo={pairPhotos(d).lo}
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
  if (!showsLo(d)) return null;
  const pay = paymentInfo(d.listing, d.lo);
  const credit = activeConcession(d.listing)
    ? "Seller concession subject to loan program limits, the purchase contract and lender approval."
    : null;
  const text = [complianceLine(d.lo), pay?.disclaimer, credit, d.lo.disclaimer].filter(Boolean).join("  ");
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

/** "Seller-paid 2-1 buydown" pill, when the agent has added a seller credit. */
function creditPill(d: RenderData, size: number, bg = d.accent, color = d.onAccent) {
  const c = activeConcession(d.listing);
  return c ? <Pill text={concessionTag(c)} bg={bg} color={color} size={size} /> : null;
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {openHousePill(d, 20)}
            {creditPill(d, 20, "#fff", INK)}
          </div>
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
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#fff" }}>
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
          <div style={{ display: "flex", ...head(100, INK) }}>{formatPrice(l.price)}</div>
          {pay ? <div style={{ display: "flex", ...label(22, MUTED) }}>{pay}</div> : null}
        </div>
        <div style={{ display: "flex", ...label(28, INK, 900) }}>{`${streetLine(l)} · ${cityLine(l)}`}</div>
        <StatsInline l={l} size={38} color={INK} dim={MUTED} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {openHousePill(d, 22)}
          {creditPill(d, 22, INK, "#fff")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: "auto" }}>
          <div style={{ display: "flex", height: 2, background: LINE }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {agentPerson(d, 100, INK, MUTED, LINE)}
            {loPerson(d, 100, INK, MUTED, LINE)}
          </div>
          <Compliance d={d} size={14} color={MUTED} />
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
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#fff" }}>
      <div style={{ display: "flex", flexDirection: "column", width: 540, padding: "44px 44px 26px", gap: 14 }}>
        <Headline l={l} width={452} max={96} color={INK} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 10 }}>
          <div style={{ display: "flex", ...head(54, INK) }}>{formatPrice(l.price)}</div>
          {pay ? <div style={{ display: "flex", ...label(14, MUTED) }}>{pay}</div> : null}
        </div>
        <div style={{ display: "flex", ...label(17, INK, 900) }}>{streetLine(l)}</div>
        <div style={{ display: "flex", ...label(14, MUTED) }}>{cityLine(l)}</div>
        <StatsInline l={l} size={26} color={INK} dim={MUTED} />
        {activeConcession(l) ? <div style={{ display: "flex" }}>{creditPill(d, 12, INK, "#fff")}</div> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
          <div style={{ display: "flex", gap: 22 }}>
            <Person
              photo={pairPhotos(d).agent}
              name={l.agent.name}
              sub={[l.agent.brokerage]}
              size={58}
              color={INK}
              subColor={MUTED}
              ring={LINE}
            />
            {showsLo(d) ? (
              <Person photo={pairPhotos(d).lo} name={d.lo.name} sub={[`NMLS #${d.lo.nmls}`]} size={58} color={INK} subColor={MUTED} ring={LINE} />
            ) : null}
          </div>
          <Compliance d={d} size={9} color={MUTED} />
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

/** 1080×1350 — 4:5 editorial "feature" post: hero photo, filmstrip, clean details. */
export function DetailsPost(d: RenderData) {
  const l = d.listing;
  const p = d.photos;
  const pay = payLabel(d);
  const strip = [p[1], p[2], p[3]].map((x) => x ?? p[0]);
  const stats = statItems(l);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#fff" }}>
      <div style={{ display: "flex", position: "relative", height: 730 }}>
        <Photo src={p[0]} style={{ ...fill, width: "100%", height: "100%" }} />
        <div
          style={{ ...fill, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0) 30%)" }}
        />
        <div style={{ position: "absolute", top: 44, left: 56, right: 56, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 12 }}>
            <Pill text={statusLabel(l)} bg="#fff" color={INK} size={20} />
            {creditPill(d, 20)}
          </div>
          <div style={{ display: "flex", ...label(20, "#fff") }}>{`${l.city}, ${l.state}`}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, height: 200, paddingTop: 6 }}>
        {strip.map((src, i) => (
          <Photo key={i} src={src} style={{ width: 356, height: "100%" }} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: "38px 56px 0", gap: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 30 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flexShrink: 1 }}>
            <div style={{ display: "flex", ...head(fit(streetLine(l), 600, 58), INK), lineHeight: 1 }}>{streetLine(l)}</div>
            <div style={{ display: "flex", ...label(18, MUTED) }}>{cityLine(l)}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
            <div style={{ display: "flex", ...head(58, INK), lineHeight: 1 }}>{formatPrice(l.price)}</div>
            {pay ? <div style={{ display: "flex", ...label(15, MUTED) }}>{pay}</div> : null}
          </div>
        </div>
        <div style={{ display: "flex", borderTop: `2px solid ${INK}`, borderBottom: `2px solid ${LINE}` }}>
          {stats.map(([v, k], i) => (
            <div
              key={k}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                flexGrow: 1,
                padding: "16px 0",
                paddingLeft: i ? 24 : 0,
                borderLeft: i ? `2px solid ${LINE}` : "none",
              }}
            >
              <div style={{ display: "flex", ...head(34, INK), lineHeight: 1 }}>{v}</div>
              <div style={{ display: "flex", ...label(14, MUTED) }}>{k}</div>
            </div>
          ))}
          {formatOpenHouse(l) ? (
            <div style={{ display: "flex", alignItems: "center", paddingLeft: 24, borderLeft: `2px solid ${LINE}` }}>
              <div style={{ display: "flex", ...label(13, INK) }}>{`Open ${formatOpenHouse(l)}`}</div>
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", padding: "0 56px 22px", gap: 14 }}>
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
  if (d.applyQr && showsLo(d)) qrs.push({ src: d.applyQr, label: "Get pre-approved" });
  const qrSize = qrs.length > 1 ? 130 : 160;

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", background: "#fff", padding: "44px 60px 36px" }}>
        <Headline l={l} width={720} max={130} color={INK} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          <div style={{ display: "flex", ...label(20, MUTED) }}>{`${l.city}, ${l.state}`}</div>
          {d.logo && showsLo(d) ? <img src={d.logo} style={{ height: 56, objectFit: "contain" }} /> : null}
        </div>
      </div>
      <div style={{ display: "flex", height: 10, background: d.accent }} />
      <div style={{ display: "flex", position: "relative", height: 480 }}>
        <Photo src={p[0]} style={{ ...fill, width: "100%", height: "100%" }} />
        {formatOpenHouse(l) ? <div style={{ position: "absolute", left: 60, bottom: 30, display: "flex" }}>{openHousePill(d, 20)}</div> : null}
      </div>
      <div style={{ display: "flex", height: 180, gap: 8, paddingTop: 8 }}>
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
                <div style={{ display: "flex", width: 8, height: 8, borderRadius: 8, background: d.brand }} />
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
          {activeConcession(l) ? <div style={{ display: "flex", marginTop: 6 }}>{creditPill(d, 12, "#fff", INK)}</div> : null}
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
            photo={pairPhotos(d).agent}
            name={l.agent.name}
            sub={[l.agent.brokerage, [l.agent.phone, l.agent.email].filter(Boolean).join(" · ")]}
            size={104}
            color={INK}
            subColor={MUTED}
            ring={LINE}
          />
          {showsLo(d) ? (
            <Person
              photo={pairPhotos(d).lo}
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
          ) : null}
        </div>
        <Compliance d={d} size={13} color={MUTED} />
      </div>
    </div>
  );
}

/** 1275×1650 — US Letter "payment options" flyer: three PITI scenarios. */
export function PaymentsFlyer(d: RenderData) {
  const l = d.listing;
  const opts = d.payments;
  if (!opts) return <div style={{ display: "flex" }} />;
  const lowest = Math.min(...opts.scenarios.map((s) => s.total));
  const hasHoa = opts.scenarios.some((s) => s.hoa > 0);
  const headSize = fit(`from ${money(lowest)}/mo.*`, 1000, 104);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#fff" }}>
      <div style={{ display: "flex", height: 470, position: "relative" }}>
        <Photo src={d.photos[0]} style={{ ...fill, width: "100%", height: "100%" }} />
        <div
          style={{ ...fill, display: "flex", backgroundImage: "linear-gradient(90deg, rgba(10,10,10,0.88) 0%, rgba(10,10,10,0.55) 55%, rgba(10,10,10,0.1) 100%)" }}
        />
        <div style={{ position: "absolute", left: 60, top: 50, bottom: 44, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", ...label(20, "rgba(255,255,255,0.8)") }}>What it costs to own</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", ...head(headSize, "#fff") }}>Own this home</div>
              <div style={{ display: "flex", ...head(headSize, "#fff") }}>{`from ${money(lowest)}/mo.*`}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", ...label(22, "#fff", 900) }}>{`${streetLine(l)} · ${cityLine(l)}`}</div>
            <div style={{ display: "flex", ...label(17, "rgba(255,255,255,0.75)") }}>
              {[`List price ${formatPrice(l.price)}`, ...statItems(l).map(([v, k]) => `${v} ${k}`)].join("  ·  ")}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", height: 8, background: d.accent }} />

      <div style={{ display: "flex", gap: 22, padding: "38px 60px 0" }}>
        {opts.scenarios.map((s) => {
          const rows: [string, number][] = [
            ["Principal & interest", s.principalInterest],
            [opts.taxesEstimated ? "Property taxes (est.)" : "Property taxes", s.taxes],
            [opts.insuranceEstimated ? "Insurance (est.)" : "Homeowners insurance", s.insurance],
            [`Mortgage insurance (${s.miLabel})`, s.mortgageInsurance],
          ];
          if (hasHoa) rows.push(["HOA", s.hoa]);
          const best = s.total === lowest;
          return (
            <div
              key={s.id}
              style={{
                display: "flex",
                flexDirection: "column",
                width: 368,
                border: `2px solid ${best ? INK : LINE}`,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", background: best ? d.accent : PAPER, padding: "22px 24px 20px", gap: 6 }}>
                <div style={{ display: "flex", ...label(18, best ? d.onAccent : INK, 900) }}>{s.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 28 }}>
                  <div style={{ display: "flex", ...label(15, best ? d.onAccent : MUTED) }}>{s.detail}</div>
                  {best ? <Pill text="Lowest payment" bg="#fff" color={INK} size={11} /> : null}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", padding: "24px 24px 26px", gap: 18, flexGrow: 1 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <div style={{ display: "flex", ...head(64, INK), lineHeight: 1 }}>{money(s.total)}</div>
                    <div style={{ display: "flex", ...label(16, MUTED) }}>/mo</div>
                  </div>
                  <div style={{ display: "flex", ...body(17, INK, 500) }}>{`${money(s.downPayment)} down payment`}</div>
                  {s.concession?.schedule.length ? (
                    <div style={{ display: "flex", ...body(15, INK, 700) }}>{`${money(s.concession.schedule[0].total)}/mo in year 1 with ${s.concession.type} buydown`}</div>
                  ) : s.concession?.rateCut ? (
                    <div style={{ display: "flex", ...body(15, INK, 700) }}>{`Was ${money(s.concession.before.total)}/mo before seller buydown`}</div>
                  ) : null}
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {rows.map(([name, value]) => (
                    <div
                      key={name}
                      style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: `1.5px solid ${LINE}`, ...body(17, INK) }}
                    >
                      <div style={{ display: "flex", color: MUTED }}>{name}</div>
                      <div style={{ display: "flex", fontWeight: 600 }}>{value > 0 ? money(value) : "—"}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: "auto" }}>
                  <div style={{ display: "flex", ...label(13, INK) }}>
                    {`${s.ratePct}% rate${s.aprPct ? ` · ${s.aprPct}% APR` : ""}`}
                  </div>
                  <div style={{ display: "flex", ...body(14, MUTED) }}>{`30-yr fixed · ${money(s.loanAmount)} loan`}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <LoBlock d={d} kicker="Find the right option for you" />
      <ListedByFooter d={d} disclaimer={opts.disclaimer} />
    </div>
  );
}

/* ------------------------- financing flyer parts ------------------------ */

const money = (n: number) => formatPrice(Math.round(n));
/** $83,412 → "$83,400" */
const roughMoney = (n: number, to = 100) => formatPrice(Math.round(n / to) * to);

/** Photo with a dark shade on the left, a kicker, a two-line headline and the address. */
function FinanceHero({ d, kicker, lines, height, max = 110 }: { d: RenderData; kicker: string; lines: string[]; height: number; max?: number }) {
  const l = d.listing;
  const size = Math.min(...lines.map((t) => fit(t, 1000, max)));
  return (
    <div style={{ display: "flex", height, position: "relative" }}>
      <Photo src={d.photos[0]} style={{ ...fill, width: "100%", height: "100%" }} />
      <div
        style={{ ...fill, display: "flex", backgroundImage: "linear-gradient(90deg, rgba(10,10,10,0.88) 0%, rgba(10,10,10,0.55) 55%, rgba(10,10,10,0.1) 100%)" }}
      />
      <div style={{ position: "absolute", left: 60, top: 46, bottom: 40, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", ...label(20, "rgba(255,255,255,0.8)") }}>{kicker}</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {lines.map((t) => (
              <div key={t} style={{ display: "flex", ...head(size, "#fff") }}>
                {t}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", ...label(22, "#fff", 900) }}>{`${streetLine(l)} · ${cityLine(l)}`}</div>
          <div style={{ display: "flex", ...label(17, "rgba(255,255,255,0.75)") }}>
            {[`List price ${formatPrice(l.price)}`, ...statItems(l).map(([v, k]) => `${v} ${k}`)].join("  ·  ")}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Loan officer contact block with logo and pre-approval QR, on white so any logo reads. */
function LoBlock({ d, kicker }: { d: RenderData; kicker: string }) {
  return (
    <div style={{ display: "flex", flexGrow: 1, alignItems: "center", gap: 36, padding: "24px 60px" }}>
      {d.loHeadshot ? <Avatar src={d.loHeadshot} name={d.lo.name} size={150} ring={LINE} /> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexGrow: 1 }}>
        <div style={{ display: "flex", ...label(15, MUTED) }}>{kicker}</div>
        <div style={{ display: "flex", ...head(46, INK), lineHeight: 1 }}>{d.lo.name}</div>
        <div style={{ display: "flex", ...body(19, INK, 500) }}>{[d.lo.title, `NMLS #${d.lo.nmls}`, d.lo.company].filter(Boolean).join(" · ")}</div>
        <div style={{ display: "flex", ...body(19, INK) }}>{[d.lo.phone, d.lo.email].filter(Boolean).join("  ·  ")}</div>
        {d.logo ? <img src={d.logo} style={{ height: 46, marginTop: 8, objectFit: "contain", objectPosition: "left" }} /> : null}
      </div>
      {d.applyQr ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", border: `2px solid ${LINE}`, padding: 8 }}>
            <img src={d.applyQr} style={{ width: 150, height: 150 }} />
          </div>
          <div style={{ display: "flex", ...label(12, INK) }}>Get pre-approved</div>
        </div>
      ) : null}
    </div>
  );
}

/** "Listed by" line for the agent plus the full financing disclaimer. */
function ListedByFooter({ d, disclaimer }: { d: RenderData; disclaimer: string }) {
  const a = d.listing.agent;
  return (
    <div style={{ display: "flex", flexDirection: "column", background: PAPER, borderTop: `2px solid ${LINE}`, padding: "18px 60px 20px", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {d.agentHeadshot ? <Avatar src={d.agentHeadshot} name={a.name} size={56} ring={LINE} /> : null}
        <div style={{ display: "flex", ...label(15, INK, 900) }}>{`Listed by ${a.name}`}</div>
        <div style={{ display: "flex", ...body(16, MUTED) }}>{[a.brokerage, a.phone, a.email].filter(Boolean).join(" · ")}</div>
      </div>
      <div style={{ display: "flex", ...body(11.5, MUTED), lineHeight: 1.35 }}>
        {`*${disclaimer} ${complianceLine(d.lo)}.${d.lo.disclaimer ? ` ${d.lo.disclaimer}` : ""}`}
      </div>
    </div>
  );
}

/** 1275×1650 — "Ways to buy this home": four loan programs side by side. */
export function WaysToBuyFlyer(d: RenderData) {
  const opts = d.programs;
  if (!opts) return <div style={{ display: "flex" }} />;
  const width = (1275 - 120 - 22) / 2;
  // A seller credit adds a row to each card and to the disclaimer, so the hero gives up some room.
  const credit = activeConcession(d.listing) != null;
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#fff" }}>
      <FinanceHero d={d} kicker="Financing options" lines={credit ? [`${opts.scenarios.length} ways to buy this home.`] : [`${opts.scenarios.length} ways to buy`, "this home."]}
        height={credit ? 270 : 400}
      />
      <div style={{ display: "flex", height: 8, background: d.accent }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 22, padding: "34px 60px 0" }}>
        {opts.scenarios.map((s) => {
          const rows: [string, string][] = [
            ["Down payment", s.downPayment > 0 ? money(s.downPayment) : "$0"],
            ["Est. cash to close", money(s.cashToClose)],
            ["Mortgage insurance", s.mortgageInsurance > 0 ? `${money(s.mortgageInsurance)}/mo` : "None"],
            ["Typical min. credit score", `${s.minCredit}+`],
          ];
          if (s.concession?.schedule.length) rows.splice(2, 0, [`Year 1 with ${s.concession.type} buydown`, `${money(s.concession.schedule[0].total)}/mo`]);
          else if (s.concession?.toClosing) rows.splice(2, 0, ["Seller credit to closing", `−${money(s.concession.toClosing)}`]);
          return (
            <div key={s.id} style={{ display: "flex", flexDirection: "column", width, border: `2px solid ${LINE}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: PAPER, padding: "18px 24px" }}>
                <div style={{ display: "flex", ...label(20, INK, 900) }}>{s.name}</div>
                <div style={{ display: "flex", ...label(16, MUTED) }}>{s.detail}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", padding: "18px 24px 20px", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <div style={{ display: "flex", ...head(56, INK), lineHeight: 1 }}>{money(s.total)}</div>
                    <div style={{ display: "flex", ...label(15, MUTED) }}>/mo est.*</div>
                  </div>
                  <div style={{ display: "flex", ...label(12, MUTED) }}>{`${s.ratePct}% rate${s.aprPct ? ` · ${s.aprPct}% APR` : ""} · 30-yr fixed`}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {rows.map(([name, value]) => (
                    <div
                      key={name}
                      style={{ display: "flex", justifyContent: "space-between", padding: credit ? "8px 0" : "10px 0", borderTop: `1.5px solid ${LINE}`, ...body(17, INK) }}
                    >
                      <div style={{ display: "flex", color: MUTED }}>{name}</div>
                      <div style={{ display: "flex", fontWeight: 600 }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, ...body(16, INK, 600) }}>
                  <div style={{ display: "flex", width: 8, height: 8, borderRadius: 8, background: INK }} />
                  {`Best for: ${s.bestFor.toLowerCase()}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <LoBlock d={d} kicker="Not sure which fits? Let's find out" />
      <ListedByFooter d={d} disclaimer={credit ? `${opts.paymentDisclaimer} ${opts.cashNote}` : opts.disclaimer} />
    </div>
  );
}

/** 1275×1650 — "What it takes to qualify": down payment, credit and income by program, plus next steps. */
export function QualifyFlyer(d: RenderData) {
  const l = d.listing;
  const opts = d.programs;
  if (!opts) return <div style={{ display: "flex" }} />;
  const cols = [380, 190, 160, 195, 230];
  const headers = ["Program", "Down payment", "Min. credit", "Est. payment*", "Income needed*"];
  const steps: [string, string][] = [
    ["Get pre-approved", `Know your budget before you tour. Scan the code or call ${d.lo.name.split(" ")[0]}${d.lo.phone ? ` at ${d.lo.phone}` : ""}.`],
    ["Gather your documents", "Two years of W-2s or tax returns, 30 days of pay stubs, two months of bank statements and a photo ID."],
    ["Tour the home", `Schedule a showing with ${l.agent.name}${l.agent.phone ? ` at ${l.agent.phone}` : ""}.`],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#fff" }}>
      <FinanceHero d={d} kicker="Buyer guide" lines={["What it takes", "to buy this home."]} height={activeConcession(l) ? 340 : 400} />
      <div style={{ display: "flex", height: 8, background: d.accent }} />
      <div style={{ display: "flex", flexDirection: "column", padding: "30px 60px 0", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", border: `2px solid ${LINE}` }}>
          <div style={{ display: "flex", background: PAPER, padding: "14px 0" }}>
            {headers.map((h, i) => (
              <div key={h} style={{ display: "flex", width: cols[i], paddingLeft: 22, ...label(13, MUTED) }}>
                {h}
              </div>
            ))}
          </div>
          {opts.scenarios.map((s) => {
            const cells = [
              s.downPayment > 0 ? `${money(s.downPayment)}` : "$0",
              `${s.minCredit}+`,
              `${money(s.total)}/mo`,
              `${roughMoney(s.incomeNeeded, 1000)}/yr`,
            ];
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", borderTop: `1.5px solid ${LINE}`, padding: "20px 0" }}>
                <div style={{ display: "flex", flexDirection: "column", width: cols[0], paddingLeft: 22, gap: 2 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <div style={{ display: "flex", ...label(18, INK, 900) }}>{s.name}</div>
                    <div style={{ display: "flex", ...label(14, MUTED) }}>{s.detail}</div>
                  </div>
                  <div style={{ display: "flex", ...body(14, MUTED) }}>{s.bestFor}</div>
                </div>
                {cells.map((c, i) => (
                  <div key={i} style={{ display: "flex", width: cols[i + 1], paddingLeft: 22, ...body(21, INK, i === 3 ? 700 : 500) }}>
                    {c}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, background: PAPER, padding: "16px 22px" }}>
          <div style={{ display: "flex", ...label(14, INK, 900) }}>Other debts?</div>
          <div style={{ display: "flex", ...body(17, INK) }}>
            {`Every $500/mo in car, credit card or student loan payments adds about ${roughMoney(opts.incomePer500Debt)}/yr to the income needed.`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 22, paddingTop: 8 }}>
          {steps.map(([title, text], i) => (
            <div key={title} style={{ display: "flex", flexDirection: "column", width: (1155 - 44) / 3, gap: 8, borderTop: `3px solid ${INK}`, paddingTop: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <div style={{ display: "flex", ...head(34, INK), lineHeight: 1 }}>{`0${i + 1}`}</div>
                <div style={{ display: "flex", ...label(16, INK, 900) }}>{title}</div>
              </div>
              <div style={{ display: "flex", ...body(16, MUTED) }}>{text}</div>
            </div>
          ))}
        </div>
      </div>
      <LoBlock d={d} kicker="Your lender for this home" />
      <ListedByFooter d={d} disclaimer={opts.disclaimer} />
    </div>
  );
}

/** 1275×1650 — "Seller-paid buydown" flyer: what the seller's credit does on each loan. */
export function BuydownFlyer(d: RenderData) {
  const c = activeConcession(d.listing);
  const opts = d.programs;
  if (!c || !opts) return <div style={{ display: "flex" }} />;
  const width = (1275 - 120 - 22) / 2;
  const lines =
    c.type === "closing-costs" ? [`${money(c.amount)} toward`, "closing costs."] : ["Seller-paid", `${c.type === "permanent" ? "rate" : c.type} buydown.`];
  const best = Math.max(...opts.scenarios.map((s) => s.concession?.monthlySavings ?? 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#fff" }}>
      <FinanceHero d={d} kicker="Seller incentive" lines={lines} height={c.type === "closing-costs" ? 400 : 360} max={96} />
      <div style={{ display: "flex", height: 8, background: d.accent }} />
      <div style={{ display: "flex", alignItems: "center", gap: 40, padding: "30px 60px 0" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
          <div style={{ display: "flex", ...label(14, MUTED) }}>{c.type === "closing-costs" ? "Seller credit" : `Saves up to ${money(best)}/mo`}</div>
          <div style={{ display: "flex", ...head(64, INK), lineHeight: 1 }}>{money(c.amount)}</div>
        </div>
        <div style={{ display: "flex", ...body(20, INK) }}>{`${concessionSentence(c)} Here's what it means on each loan.*`}</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 22, padding: "26px 60px 0" }}>
        {opts.scenarios.map((s) => {
          const e = s.concession;
          if (!e) return null;
          let big: [string, string];
          let rows: [string, string][];
          if (e.schedule.length) {
            big = [money(e.schedule[0].total), "/mo in year 1*"];
            rows = e.schedule.map((y) => [`${y.label} · ${y.ratePct}%`, `${money(y.total)}/mo`]);
          } else if (e.rateCut > 0) {
            big = [money(e.total), "/mo for 30 years*"];
            rows = [
              ["Rate", `${e.before.ratePct}% → ${e.ratePct}%`],
              ["Monthly savings", `${money(e.monthlySavings)}/mo`],
              ["Discount points paid by seller", `${e.points}`],
            ];
          } else {
            big = [money(e.cashToClose), "est. cash to close*"];
            rows = [
              ["Before the credit", money(e.before.cashToClose)],
              ["Seller credit to closing costs", `−${money(e.toClosing)}`],
            ];
          }
          const notes: string[] = [];
          if (e.type !== "closing-costs" && !e.schedule.length && !e.rateCut)
            notes.push(e.buydownCost ? `Covers closing costs instead; the full buydown needs ${money(e.buydownCost)}` : "Covers closing costs instead");
          else if (e.toClosing > 0 && e.type !== "closing-costs") notes.push(`Plus ${money(e.toClosing)} toward closing costs`);
          if (e.capped) notes.push(`${s.name} limit is ${e.rule.pct}%${e.rule.of === "loan" ? " of the loan" : ""}, so the credit is ${money(e.credit)}`);
          return (
            <div key={s.id} style={{ display: "flex", flexDirection: "column", width, border: `2px solid ${LINE}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: PAPER, padding: "16px 24px" }}>
                <div style={{ display: "flex", ...label(20, INK, 900) }}>{s.name}</div>
                <div style={{ display: "flex", ...label(16, MUTED) }}>{s.detail}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", padding: "16px 24px 18px", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <div style={{ display: "flex", ...head(52, INK), lineHeight: 1 }}>{big[0]}</div>
                    <div style={{ display: "flex", ...label(14, MUTED) }}>{big[1]}</div>
                  </div>
                  <div style={{ display: "flex", ...label(12, MUTED) }}>
                    {`Note rate ${e.before.ratePct}%${e.before.aprPct ? ` · ${e.before.aprPct}% APR` : ""}${e.rateCut ? ` · now ${e.ratePct}%${e.aprPct ? ` · ${e.aprPct}% APR` : ""}` : ""}`}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {rows.map(([name, value]) => (
                    <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderTop: `1.5px solid ${LINE}`, ...body(17, INK) }}>
                      <div style={{ display: "flex", color: MUTED }}>{name}</div>
                      <div style={{ display: "flex", fontWeight: 600 }}>{value}</div>
                    </div>
                  ))}
                </div>
                {notes.map((n) => (
                  <div key={n} style={{ display: "flex", alignItems: "center", gap: 10, ...body(14, INK, 600) }}>
                    <div style={{ display: "flex", width: 7, height: 7, borderRadius: 7, background: INK, flexShrink: 0 }} />
                    {n}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <LoBlock d={d} kicker="Ask how the seller credit works for you" />
      <ListedByFooter d={d} disclaimer={opts.paymentDisclaimer} />
    </div>
  );
}

export interface AssetDef {
  label: string;
  use: string;
  size: string;
  width: number;
  height: number;
  render: (d: RenderData) => ReactNode;
  /** Also offered as a letter-size PDF. */
  print?: boolean;
  /** Only available when the listing has a rate (see paymentOptions). */
  needsPayments?: boolean;
  /** Only available when the agent has added a seller credit. */
  needsConcession?: boolean;
}

export const ASSETS = {
  square: { label: "Feed post", use: "Instagram · Facebook", size: "1080 × 1080", width: 1080, height: 1080, render: SquarePost },
  details: { label: "Feature post", use: "Instagram 4:5", size: "1080 × 1350", width: 1080, height: 1350, render: DetailsPost },
  story: { label: "Story", use: "Stories · Reels cover", size: "1080 × 1920", width: 1080, height: 1920, render: StoryPost },
  landscape: { label: "Link post", use: "Facebook · LinkedIn", size: "1200 × 630", width: 1200, height: 630, render: LandscapePost },
  flyer: { label: "Flyer", use: "Print · 8.5 × 11", size: "1275 × 1650", width: 1275, height: 1650, render: Flyer, print: true },
  buydown: {
    label: "Seller credit flyer",
    use: "Print · 8.5 × 11",
    size: "1275 × 1650",
    width: 1275,
    height: 1650,
    render: BuydownFlyer,
    print: true,
    needsPayments: true,
    needsConcession: true,
  },
  payments: {
    label: "Payment options flyer",
    use: "Print · 8.5 × 11",
    size: "1275 × 1650",
    width: 1275,
    height: 1650,
    render: PaymentsFlyer,
    print: true,
    needsPayments: true,
  },
  ways: {
    label: "Ways to buy flyer",
    use: "Print · 8.5 × 11",
    size: "1275 × 1650",
    width: 1275,
    height: 1650,
    render: WaysToBuyFlyer,
    print: true,
    needsPayments: true,
  },
  qualify: {
    label: "What it takes flyer",
    use: "Print · 8.5 × 11",
    size: "1275 × 1650",
    width: 1275,
    height: 1650,
    render: QualifyFlyer,
    print: true,
    needsPayments: true,
  },
} satisfies Record<string, AssetDef>;

export type AssetName = keyof typeof ASSETS;

export function isAssetName(s: string): s is AssetName {
  return s in ASSETS;
}

export function isPrintAsset(name: AssetName): boolean {
  const a: AssetDef = ASSETS[name];
  return !!a.print;
}

/** Assets offered for a listing, in display order. */
export function assetsFor(l: Listing, lo: LoanOfficer): AssetName[] {
  // Financing flyers make no sense once the home has sold.
  const hasPayments = l.status !== "just-sold" && paymentOptions(l, lo) != null;
  return (Object.keys(ASSETS) as AssetName[]).filter((name) => {
    const a: AssetDef = ASSETS[name];
    return (!a.needsPayments || hasPayments) && (!a.needsConcession || activeConcession(l) != null);
  });
}
