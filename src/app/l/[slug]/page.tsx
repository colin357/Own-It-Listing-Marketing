import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { getKit } from "@/lib/listings";
import { buildCaptions } from "@/lib/captions";
import {
  brandColors,
  cityLine,
  complianceLine,
  formatOpenHouse,
  formatPrice,
  paymentInfo,
  statsLine,
  statusLabel,
  streetLine,
} from "@/lib/format";
import { ASSETS, type AssetName } from "@/lib/render/templates";
import { CopyButton } from "@/components/CopyButton";
import { ShareButton } from "@/components/ShareButton";

function assetUrl(slug: string, file: string, version: string, download = false) {
  const v = encodeURIComponent(version);
  return `/l/${slug}/assets/${file}?v=${v}${download ? "&download=1" : ""}`;
}

export async function generateMetadata({ params }: PageProps<"/l/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const kit = await getKit(slug);
  if (!kit) return { title: "Listing not found" };
  const { listing: l, lo } = kit;
  const title = `${statusLabel(l)}: ${streetLine(l)} – Marketing Kit`;
  const description = `Free co-branded social posts, flyers and captions for ${streetLine(l)}, ${l.city}. Courtesy of ${lo.name}, ${lo.company}.`;
  const image = assetUrl(l.slug, "landscape.png", l.updatedAt);
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function ListingKitPage({ params }: PageProps<"/l/[slug]">) {
  const { slug } = await params;
  const kit = await getKit(slug);
  if (!kit) notFound();
  const { listing: l, lo } = kit;
  const { brand, accent } = brandColors(lo);
  const captions = buildCaptions(l, lo);
  const pay = paymentInfo(l, lo);
  const oh = formatOpenHouse(l);
  const v = l.updatedAt;
  const order: AssetName[] = ["square", "details", "story", "landscape", "flyer"];
  const agentFirst = l.agent.name.split(" ")[0];

  return (
    <div className="kit" style={{ "--brand": brand, "--accent": accent } as CSSProperties}>
      <header className="kit-header">
        <div className="container kit-header-inner">
          <div className="kit-brand">
            {lo.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lo.logoUrl} alt={lo.company} className="kit-logo" />
            ) : (
              <span className="kit-company">{lo.company}</span>
            )}
          </div>
          <a className="btn btn-accent" href={`/l/${l.slug}/download`}>
            Download all
          </a>
        </div>
      </header>

      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-photo">
            {l.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.photos[0]} alt={streetLine(l)} />
            ) : (
              <div className="hero-photo-fallback" />
            )}
            <span className="badge">{statusLabel(l)}</span>
          </div>
          <div className="hero-copy">
            <p className="eyebrow">Your listing marketing kit</p>
            <h1>{streetLine(l)}</h1>
            <p className="muted">{cityLine(l)}</p>
            <p className="price">
              {formatPrice(l.price)}
              {pay ? <span className="price-pay"> · Est. {pay.label}</span> : null}
            </p>
            {statsLine(l) ? <p>{statsLine(l)}</p> : null}
            {oh ? <p className="oh">Open House · {oh}</p> : null}
            <p className="hero-note">
              Hi {agentFirst}! {lo.name} put together ready-to-post graphics, a printable flyer and
              captions for your listing. Download what you like and post away — everything is
              co-branded and compliance-ready.
            </p>
            <div className="hero-actions">
              <a className="btn" href={`/l/${l.slug}/download`}>
                Download everything (.zip)
              </a>
              <a className="btn btn-ghost" href={assetUrl(l.slug, "flyer.pdf", v, true)}>
                Flyer PDF
              </a>
            </div>
          </div>
        </div>
      </section>

      <main className="container">
        <section className="section">
          <h2>Social graphics</h2>
          <p className="muted">Tap an image to view full size. On your phone, use Share to post directly.</p>
          <div className="asset-grid">
            {order.map((name) => {
              const a = ASSETS[name];
              const file = `${name}.png`;
              return (
                <article key={name} className={`asset-card asset-${name}`}>
                  <a href={assetUrl(l.slug, file, v)} target="_blank" rel="noreferrer" className="asset-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={assetUrl(l.slug, file, v)}
                      alt={`${a.label} for ${streetLine(l)}`}
                      width={a.width}
                      height={a.height}
                      loading="lazy"
                    />
                  </a>
                  <div className="asset-meta">
                    <div>
                      <h3>{a.label}</h3>
                      <p className="muted small">{a.size}</p>
                    </div>
                    <div className="asset-actions">
                      <ShareButton
                        url={assetUrl(l.slug, file, v)}
                        filename={`${l.slug}-${file}`}
                        text={captions[0].text}
                      />
                      <a className="btn btn-small" href={assetUrl(l.slug, file, v, true)}>
                        PNG
                      </a>
                      {name === "flyer" ? (
                        <a className="btn btn-small" href={assetUrl(l.slug, "flyer.pdf", v, true)}>
                          PDF
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="section">
          <h2>Captions</h2>
          <p className="muted">Copy, paste and tweak to make it yours.</p>
          <div className="caption-list">
            {captions.map((c) => (
              <article key={c.id} className="caption-card">
                <div className="caption-head">
                  <h3>{c.label}</h3>
                  <CopyButton text={c.text} />
                </div>
                <pre className="caption-text">{c.text}</pre>
              </article>
            ))}
          </div>
        </section>

        <section className="section lo-card">
          {lo.headshotUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lo.headshotUrl} alt={lo.name} className="lo-photo" />
          ) : null}
          <div>
            <p className="eyebrow">Your lending partner</p>
            <h2>{lo.name}</h2>
            <p className="muted">
              {[lo.title, `NMLS #${lo.nmls}`, lo.company].filter(Boolean).join(" · ")}
            </p>
            <p className="lo-contact">
              {lo.phone ? <a href={`tel:${lo.phone.replace(/[^\d+]/g, "")}`}>{lo.phone}</a> : null}
              {lo.email ? <a href={`mailto:${lo.email}`}>{lo.email}</a> : null}
              {lo.applyUrl ? (
                <a href={lo.applyUrl} target="_blank" rel="noreferrer">
                  Pre-approval link
                </a>
              ) : null}
            </p>
            <p className="small muted">
              Need a change or a different style? Just reply to {lo.name.split(" ")[0]}&apos;s message.
            </p>
          </div>
        </section>
      </main>

      <footer className="kit-footer">
        <div className="container small">
          <p>{complianceLine(lo)}</p>
          {pay ? <p>{pay.disclaimer}</p> : null}
          {lo.disclaimer ? <p>{lo.disclaimer}</p> : null}
        </div>
      </footer>
    </div>
  );
}
