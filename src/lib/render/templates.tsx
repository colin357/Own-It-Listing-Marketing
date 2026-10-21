/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */
import type { CSSProperties, ReactNode } from "react";
import type { Listing, LoanOfficer } from "../types";
import {
  cityLine,
  complianceLine,
  formatOpenHouse,
  formatPrice,
  formatNumber,
  paymentInfo,
  statusLabel,
  streetLine,
} from "../format";

/**
 * Satori templates (rendered to PNG by next/og). Satori supports a subset of
 * CSS: flexbox only, and every element with more than one child needs an
 * explicit `display: flex`.
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
}

const SANS = "Montserrat";
const SERIF = "Playfair";

const fill: CSSProperties = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 };

function Photo({ src, brand, style }: { src: string | null; brand: string; style?: CSSProperties }) {
  if (src) return <img src={src} style={{ objectFit: "cover", ...style }} />;
  return (
    <div
      style={{
        display: "flex",
        backgroundImage: `linear-gradient(135deg, ${brand}, #3a4a5c)`,
        ...style,
      }}
    />
  );
}

function Avatar({ src, name, size, ring }: { src: string | null; name: string; size: number; ring: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const box: CSSProperties = {
    width: size,
    height: size,
    borderRadius: size,
    border: `${Math.round(size / 22)}px solid ${ring}`,
  };
  if (src) return <img src={src} style={{ ...box, objectFit: "cover" }} />;
  return (
    <div
      style={{
        ...box,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#e8e4dc",
        color: "#333",
        fontSize: size * 0.36,
        fontFamily: SANS,
        fontWeight: 800,
      }}
    >
      {initials}
    </div>
  );
}

function Badge({ text, bg, color, size }: { text: string; bg: string; color: string; size: number }) {
  return (
    <div
      style={{
        display: "flex",
        background: bg,
        color,
        fontFamily: SANS,
        fontWeight: 800,
        fontSize: size,
        letterSpacing: size * 0.18,
        padding: `${size * 0.55}px ${size * 1.1}px`,
        textTransform: "uppercase",
      }}
    >
      {text}
    </div>
  );
}

function Stats({ l, size, color, gap }: { l: Listing; size: number; color: string; gap: number }) {
  const items: [string, string][] = [];
  if (l.beds != null) items.push([String(l.beds), "Beds"]);
  if (l.baths != null) items.push([String(l.baths), "Baths"]);
  if (l.sqft != null) items.push([formatNumber(l.sqft), "Sq Ft"]);
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", gap }}>
      {items.map(([v, k]) => (
        <div key={k} style={{ display: "flex", alignItems: "baseline", gap: size * 0.3, color }}>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: size }}>{v}</div>
          <div style={{ fontFamily: SANS, fontWeight: 400, fontSize: size * 0.62, opacity: 0.85 }}>{k}</div>
        </div>
      ))}
    </div>
  );
}

function Person({
  photo,
  name,
  lines,
  size,
  ring,
  color,
  align = "left",
}: {
  photo: string | null;
  name: string;
  lines: (string | undefined)[];
  size: number;
  ring: string;
  color: string;
  align?: "left" | "right";
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: size * 0.25,
        flexDirection: align === "right" ? "row-reverse" : "row",
      }}
    >
      <Avatar src={photo} name={name} size={size} ring={ring} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: align === "right" ? "flex-end" : "flex-start",
          color,
        }}
      >
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: size * 0.27 }}>{name}</div>
        {lines.filter(Boolean).map((t, i) => (
          <div key={i} style={{ fontFamily: SANS, fontWeight: 400, fontSize: size * 0.2, opacity: 0.9 }}>
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

function CoBrandBar({ d, size, pad }: { d: RenderData; size: number; pad: number }) {
  const { listing: l, lo } = d;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        padding: `${pad * 0.7}px ${pad}px ${pad * 0.5}px`,
        gap: pad * 0.35,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Person
          photo={d.agentHeadshot}
          name={l.agent.name}
          lines={[l.agent.brokerage, l.agent.phone]}
          size={size}
          ring={d.accent}
          color="#1a1a1a"
        />
        <Person
          photo={d.loHeadshot}
          name={lo.name}
          lines={[`NMLS #${lo.nmls}`, lo.phone]}
          size={size}
          ring={d.brand}
          color="#1a1a1a"
          align="right"
        />
      </div>
      <Compliance d={d} size={size * 0.15} color="#666" />
    </div>
  );
}

function Compliance({ d, size, color, withPayment = true }: { d: RenderData; size: number; color: string; withPayment?: boolean }) {
  const pay = withPayment ? paymentInfo(d.listing, d.lo) : null;
  const text = [complianceLine(d.lo), pay?.disclaimer, d.lo.disclaimer].filter(Boolean).join("  ");
  return (
    <div style={{ display: "flex", fontFamily: SANS, fontSize: size, color, lineHeight: 1.3 }}>{text}</div>
  );
}

function Price({ d, size, color }: { d: RenderData; size: number; color: string }) {
  const pay = paymentInfo(d.listing, d.lo);
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: size * 0.45, color }}>
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: size }}>{formatPrice(d.listing.price)}</div>
      {pay ? (
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: size * 0.45, opacity: 0.9 }}>
          {`Est. ${pay.label}`}
        </div>
      ) : null}
    </div>
  );
}

function OpenHouseLine({ l, size, color }: { l: Listing; size: number; color: string }) {
  const oh = formatOpenHouse(l);
  if (!oh) return null;
  return (
    <div style={{ display: "flex", fontFamily: SANS, fontWeight: 600, fontSize: size, color }}>{`Open House · ${oh}`}</div>
  );
}

/* ----------------------------------------------------------------------- */

/** 1080×1080 — Instagram / Facebook feed post. */
export function SquarePost(d: RenderData) {
  const l = d.listing;
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#fff" }}>
      <div style={{ display: "flex", position: "relative", flexGrow: 1 }}>
        <Photo src={d.photos[0]} brand={d.brand} style={{ ...fill, width: "100%", height: "100%" }} />
        <div
          style={{
            ...fill,
            display: "flex",
            backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.75) 100%)",
          }}
        />
        <div style={{ position: "absolute", top: 48, left: 48, display: "flex" }}>
          <Badge text={statusLabel(l)} bg={d.accent} color="#111" size={30} />
        </div>
        <div
          style={{
            position: "absolute",
            left: 48,
            right: 48,
            bottom: 36,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <Price d={d} size={66} color="#fff" />
          <div style={{ display: "flex", fontFamily: SERIF, fontSize: 52, color: "#fff", lineHeight: 1.1 }}>
            {streetLine(l)}
          </div>
          <div style={{ display: "flex", fontFamily: SANS, fontSize: 28, color: "#fff", opacity: 0.9 }}>
            {cityLine(l)}
          </div>
          <div style={{ display: "flex", marginTop: 8 }}>
            <Stats l={l} size={32} color="#fff" gap={36} />
          </div>
          <OpenHouseLine l={l} size={26} color="#fff" />
        </div>
      </div>
      <CoBrandBar d={d} size={96} pad={40} />
    </div>
  );
}

/** 1080×1920 — Instagram / Facebook story & Reels cover. */
export function StoryPost(d: RenderData) {
  const l = d.listing;
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: d.brand }}>
      <div style={{ display: "flex", position: "relative", height: 1150 }}>
        <Photo src={d.photos[0]} brand={d.brand} style={{ ...fill, width: "100%", height: "100%" }} />
        <div style={{ position: "absolute", top: 180, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <Badge text={statusLabel(l)} bg={d.accent} color="#111" size={40} />
        </div>
      </div>
      <div style={{ display: "flex", height: 210 }}>
        <Photo src={d.photos[1] ?? d.photos[0]} brand={d.brand} style={{ width: "50%", height: "100%" }} />
        <Photo src={d.photos[2] ?? d.photos[0]} brand={d.brand} style={{ width: "50%", height: "100%" }} />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flexGrow: 1,
          padding: "36px 60px 30px",
          gap: 14,
          color: "#fff",
        }}
      >
        <Price d={d} size={72} color="#fff" />
        <div style={{ display: "flex", fontFamily: SERIF, fontSize: 50, textAlign: "center" }}>{streetLine(l)}</div>
        <div style={{ display: "flex", fontFamily: SANS, fontSize: 30, opacity: 0.9 }}>{cityLine(l)}</div>
        <Stats l={l} size={34} color="#fff" gap={40} />
        <OpenHouseLine l={l} size={28} color={d.accent} />
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", marginTop: "auto" }}>
          <Person
            photo={d.agentHeadshot}
            name={l.agent.name}
            lines={[l.agent.brokerage, l.agent.phone]}
            size={100}
            ring={d.accent}
            color="#fff"
          />
          <Person
            photo={d.loHeadshot}
            name={d.lo.name}
            lines={[`NMLS #${d.lo.nmls}`, d.lo.phone]}
            size={100}
            ring={d.accent}
            color="#fff"
            align="right"
          />
        </div>
        <Compliance d={d} size={15} color="rgba(255,255,255,0.75)" />
      </div>
    </div>
  );
}

/** 1200×630 — Facebook / LinkedIn / X link post. Also the page's OG image. */
export function LandscapePost(d: RenderData) {
  const l = d.listing;
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#fff" }}>
      <Photo src={d.photos[0]} brand={d.brand} style={{ width: 690, height: "100%" }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 510,
          background: d.brand,
          color: "#fff",
          padding: "40px 40px 24px",
          gap: 10,
        }}
      >
        <div style={{ display: "flex" }}>
          <Badge text={statusLabel(l)} bg={d.accent} color="#111" size={22} />
        </div>
        <div style={{ display: "flex", fontFamily: SERIF, fontSize: 42, lineHeight: 1.1, marginTop: 10 }}>
          {streetLine(l)}
        </div>
        <div style={{ display: "flex", fontFamily: SANS, fontSize: 22, opacity: 0.9 }}>{cityLine(l)}</div>
        <Price d={d} size={46} color="#fff" />
        <Stats l={l} size={24} color="#fff" gap={22} />
        <OpenHouseLine l={l} size={19} color={d.accent} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: "auto" }}>
          <Person
            photo={d.agentHeadshot}
            name={l.agent.name}
            lines={[l.agent.brokerage]}
            size={64}
            ring={d.accent}
            color="#fff"
          />
          <Person
            photo={d.loHeadshot}
            name={d.lo.name}
            lines={[`NMLS #${d.lo.nmls} · ${d.lo.company}`]}
            size={64}
            ring={d.accent}
            color="#fff"
          />
          <Compliance d={d} size={10} color="rgba(255,255,255,0.7)" />
        </div>
      </div>
    </div>
  );
}

/** 1080×1350 — 4:5 portrait "feature" post with a photo grid and highlights. */
export function DetailsPost(d: RenderData) {
  const l = d.listing;
  const p = d.photos;
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#faf8f4" }}>
      <div style={{ display: "flex", height: 620, gap: 8, padding: 8 }}>
        <Photo src={p[0]} brand={d.brand} style={{ width: 700, height: "100%" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flexGrow: 1 }}>
          <Photo src={p[1] ?? p[0]} brand={d.brand} style={{ width: "100%", height: 298 }} />
          <Photo src={p[2] ?? p[0]} brand={d.brand} style={{ width: "100%", height: 298 }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", padding: "28px 56px 0", gap: 12, flexGrow: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Badge text={statusLabel(l)} bg={d.brand} color="#fff" size={24} />
          <Stats l={l} size={30} color={d.brand} gap={28} />
        </div>
        <div style={{ display: "flex", fontFamily: SERIF, fontSize: 50, color: "#1a1a1a", lineHeight: 1.1 }}>
          {streetLine(l)}
        </div>
        <div style={{ display: "flex", fontFamily: SANS, fontSize: 26, color: "#555" }}>{cityLine(l)}</div>
        <Price d={d} size={52} color={d.brand} />
        <OpenHouseLine l={l} size={24} color="#1a1a1a" />
        <div style={{ display: "flex", flexWrap: "wrap", rowGap: 8, columnGap: 28, marginTop: 6 }}>
          {l.highlights.slice(0, 6).map((h) => (
            <div key={h} style={{ display: "flex", fontFamily: SANS, fontSize: 23, color: "#333", width: 450 }}>
              <div style={{ display: "flex", color: d.accent, marginRight: 10, fontWeight: 800 }}>•</div>
              {h}
            </div>
          ))}
        </div>
      </div>
      <CoBrandBar d={d} size={84} pad={40} />
    </div>
  );
}

/** 1275×1650 — US Letter flyer at 150 dpi (print-ready PNG). */
export function Flyer(d: RenderData) {
  const l = d.listing;
  const p = d.photos;
  const pay = paymentInfo(l, d.lo);
  const qrs: { src: string; label: string }[] = [];
  if (d.listingQr) qrs.push({ src: d.listingQr, label: "View Listing" });
  if (d.applyQr && l.status !== "just-sold") qrs.push({ src: d.applyQr, label: "Get Pre-Approved" });

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#fff" }}>
      <div style={{ display: "flex", position: "relative", height: 720 }}>
        <Photo src={p[0]} brand={d.brand} style={{ ...fill, width: "100%", height: "100%" }} />
        <div style={{ position: "absolute", top: 50, left: 0, display: "flex" }}>
          <Badge text={statusLabel(l)} bg={d.accent} color="#111" size={36} />
        </div>
      </div>
      <div style={{ display: "flex", height: 230, gap: 8, padding: "8px 0" }}>
        {[1, 2, 3].map((i) => (
          <Photo key={i} src={p[i] ?? p[0]} brand={d.brand} style={{ flexGrow: 1, width: 420, height: "100%" }} />
        ))}
      </div>
      <div style={{ display: "flex", padding: "26px 60px 0", gap: 40, flexGrow: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, width: 760, gap: 10 }}>
          <div style={{ display: "flex", fontFamily: SERIF, fontSize: 54, color: "#1a1a1a", lineHeight: 1.05 }}>
            {streetLine(l)}
          </div>
          <div style={{ display: "flex", fontFamily: SANS, fontSize: 26, color: "#555" }}>{cityLine(l)}</div>
          <Stats l={l} size={30} color={d.brand} gap={30} />
          <OpenHouseLine l={l} size={24} color="#1a1a1a" />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {(l.highlights.length ? l.highlights.slice(0, 5) : []).map((h) => (
              <div key={h} style={{ display: "flex", fontFamily: SANS, fontSize: 22, color: "#333" }}>
                <div style={{ display: "flex", color: d.accent, marginRight: 10, fontWeight: 800 }}>•</div>
                {h}
              </div>
            ))}
            {!l.highlights.length && l.description ? (
              <div style={{ display: "flex", fontFamily: SANS, fontSize: 21, color: "#333", lineHeight: 1.4 }}>
                {l.description.length > 320 ? `${l.description.slice(0, 317)}…` : l.description}
              </div>
            ) : null}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: 360,
            background: d.brand,
            color: "#fff",
            padding: "26px 20px",
            gap: 8,
            height: 380,
          }}
        >
          <div style={{ display: "flex", fontFamily: SANS, fontSize: 18, letterSpacing: 3, opacity: 0.85 }}>
            OFFERED AT
          </div>
          <div style={{ display: "flex", fontFamily: SANS, fontWeight: 800, fontSize: 46 }}>
            {formatPrice(l.price)}
          </div>
          {pay ? (
            <div style={{ display: "flex", fontFamily: SANS, fontWeight: 600, fontSize: 20, color: d.accent }}>
              {`Est. ${pay.label}`}
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 18, marginTop: 10 }}>
            {qrs.map((q) => (
              <div key={q.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <img src={q.src} style={{ width: qrs.length > 1 ? 140 : 170, height: qrs.length > 1 ? 140 : 170 }} />
                <div style={{ display: "flex", fontFamily: SANS, fontSize: 15, fontWeight: 600 }}>{q.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          background: "#f4f1ea",
          padding: "22px 60px 18px",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Person
            photo={d.agentHeadshot}
            name={l.agent.name}
            lines={[l.agent.brokerage, [l.agent.phone, l.agent.email].filter(Boolean).join(" · ")]}
            size={110}
            ring={d.accent}
            color="#1a1a1a"
          />
          {d.logo ? <img src={d.logo} style={{ height: 70, objectFit: "contain" }} /> : null}
          <Person
            photo={d.loHeadshot}
            name={d.lo.name}
            lines={[
              [d.lo.title, `NMLS #${d.lo.nmls}`].filter(Boolean).join(" · "),
              d.lo.company,
              [d.lo.phone, d.lo.email].filter(Boolean).join(" · "),
            ]}
            size={110}
            ring={d.brand}
            color="#1a1a1a"
            align="right"
          />
        </div>
        <Compliance d={d} size={14} color="#666" />
      </div>
    </div>
  );
}

export const ASSETS = {
  square: { label: "Instagram / Facebook Post", size: "1080 × 1080", width: 1080, height: 1080, render: SquarePost },
  details: { label: "Feature Post (4:5)", size: "1080 × 1350", width: 1080, height: 1350, render: DetailsPost },
  story: { label: "Story / Reel Cover", size: "1080 × 1920", width: 1080, height: 1920, render: StoryPost },
  landscape: { label: "Facebook / LinkedIn Post", size: "1200 × 630", width: 1200, height: 630, render: LandscapePost },
  flyer: { label: "Printable Flyer (8.5 × 11)", size: "1275 × 1650", width: 1275, height: 1650, render: Flyer },
} satisfies Record<string, { label: string; size: string; width: number; height: number; render: (d: RenderData) => ReactNode }>;

export type AssetName = keyof typeof ASSETS;

export function isAssetName(s: string): s is AssetName {
  return s in ASSETS;
}
