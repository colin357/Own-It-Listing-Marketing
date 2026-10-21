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
import { ASSETS, assetsFor, isPrintAsset } from "@/lib/render/templates";
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
  const description = `Co-branded social posts, flyers and captions for ${streetLine(l)}, ${l.city}. Courtesy of ${lo.name}, ${lo.company}.`;
  const image = assetUrl(l.slug, "landscape.png", l.updatedAt);
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** "Jordan Avery" → ["Jordan", "Avery"], used for the two-tone footer wordmark. */
function splitName(name: string): [string, string] {
  const i = name.indexOf(" ");
  return i < 0 ? [name, ""] : [name.slice(0, i), name.slice(i + 1)];
}

export default async function ListingKitPage({ params }: PageProps<"/l/[slug]">) {
  const { slug } = await params;
  const kit = await getKit(slug);
  if (!kit) notFound();
  const { listing: l, lo } = kit;
  const { accent, onAccent } = brandColors(lo);
  const captions = buildCaptions(l, lo);
  const pay = paymentInfo(l, lo);
  const oh = formatOpenHouse(l);
  const v = l.updatedAt;
  const order = assetsFor(l, lo);
  const agentFirst = l.agent.name.split(" ")[0];
  const loFirst = lo.name.split(" ")[0];
  const [wordA, wordB] = splitName(lo.name);
  const statusWords = statusLabel(l).toUpperCase().split(" ");
  const tel = lo.phone ? `tel:${lo.phone.replace(/[^\d+]/g, "")}` : null;

  return (
    <div className="kit" style={{ "--accent": accent, "--on-accent": onAccent } as CSSProperties}>
      <header className="nav">
        <div className="wrap nav-inner">
          {lo.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lo.logoUrl} alt={lo.company} className="nav-logo" />
          ) : (
            <span className="wordmark">{lo.company}</span>
          )}
          <nav className="nav-links">
            <a href="#graphics">Graphics</a>
            <a href="#captions">Captions</a>
            <a href="#contact">Contact</a>
          </nav>
          <a className="pill" href={`/l/${l.slug}/download`}>
            Download all
          </a>
        </div>
      </header>

      <section className="hero">
        {l.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.photos[0]} alt={streetLine(l)} className="hero-bg" />
        ) : null}
        <div className="hero-shade" />
        <a className="chip" href="#contact">
          {lo.headshotUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lo.headshotUrl} alt="" />
          ) : null}
          <span>
            <strong>From {lo.name}</strong>
            <small>NMLS #{lo.nmls}</small>
          </span>
        </a>
        <div className="wrap hero-content">
          <h1 className="display">
            {statusWords.map((w, i) => (
              <span key={w}>
                {w}
                {i === statusWords.length - 1 ? "." : ""}
              </span>
            ))}
          </h1>
          <p className="hero-address">
            {streetLine(l)} · {cityLine(l)}
          </p>
          <p className="hero-facts">
            <span className="hero-price">{formatPrice(l.price)}</span>
            {statsLine(l) ? <span>{statsLine(l)}</span> : null}
            {pay ? <span>Est. {pay.label}</span> : null}
          </p>
          {oh ? <p className="hero-oh">Open house · {oh}</p> : null}
          <div className="actions">
            <a className="pill pill-lg" href={`/l/${l.slug}/download`}>
              Download everything
            </a>
            <a className="textlink" href={assetUrl(l.slug, "flyer.pdf", v, true)}>
              Flyer PDF
            </a>
          </div>
        </div>
      </section>

      <section className="intro">
        <div className="wrap intro-inner">
          <h2 className="display display-md">
            Made for
            <br />
            {agentFirst}.
          </h2>
          <div>
            <p className="lead">
              {loFirst} put together a full set of co-branded graphics, a print-ready flyer and captions for{" "}
              {streetLine(l)}. Everything is sized for each platform and already includes the compliance language.
            </p>
            <p className="muted">Download, post, done. Need a tweak? Just reply to {loFirst}.</p>
          </div>
        </div>
      </section>

      <section className="work" id="graphics">
        <div className="wrap">
          <div className="work-head">
            <div>
              <p className="lead">Tap a graphic to see it full size. On your phone, use Share to post straight to Instagram or Facebook.</p>
              <a className="pill" href={`/l/${l.slug}/download`}>
                Download all (.zip)
              </a>
            </div>
            <h2 className="display display-lg">
              Ready
              <br />
              to post.
            </h2>
          </div>
          <div className="cards">
            {order.map((name) => {
              const a = ASSETS[name];
              const file = `${name}.png`;
              return (
                <article key={name} className={`card card-${name}`}>
                  <a href={assetUrl(l.slug, file, v)} target="_blank" rel="noreferrer" className="card-img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={assetUrl(l.slug, file, v)}
                      alt={`${a.label} for ${streetLine(l)}`}
                      width={a.width}
                      height={a.height}
                      loading="lazy"
                    />
                  </a>
                  <div className="card-meta">
                    <p className="label">{a.label}</p>
                    <p className="card-use">
                      {a.use} · {a.size}
                    </p>
                    <div className="card-links">
                      <a className="textlink" href={assetUrl(l.slug, file, v, true)}>
                        PNG
                      </a>
                      {isPrintAsset(name) ? (
                        <a className="textlink" href={assetUrl(l.slug, `${name}.pdf`, v, true)}>
                          PDF
                        </a>
                      ) : null}
                      <ShareButton url={assetUrl(l.slug, file, v)} filename={`${l.slug}-${file}`} text={captions[0].text} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="dark" id="captions">
        <div className="wrap dark-inner">
          <div className="dark-intro">
            <p className="eyebrow">Your copywriter</p>
            <h2 className="display display-md">
              Captions,
              <br />
              already
              <br />
              written.
            </h2>
            <p className="lead">Copy, paste, post. Tweak a word or two to make it sound like you.</p>
          </div>
          <div className="rows">
            {captions.map((c) => (
              <div key={c.id} className="row">
                <details>
                  <summary>
                    <span className="row-name">{c.label}</span>
                    <span className="row-hint">Preview</span>
                  </summary>
                  <pre className="row-text">{c.text}</pre>
                </details>
                <CopyButton text={c.text} className="pill pill-white" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="partner" id="contact">
        <div className="wrap">
          <div className="partner-card">
            {lo.headshotUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lo.headshotUrl} alt={lo.name} className="partner-photo" />
            ) : null}
            <div>
              <p className="eyebrow">Your lending partner</p>
              <h2 className="display display-sm">{lo.name}</h2>
              <p className="muted">{[lo.title, `NMLS #${lo.nmls}`, lo.company].filter(Boolean).join(" · ")}</p>
              <p className="partner-links">
                {lo.phone && tel ? (
                  <a className="textlink" href={tel}>
                    {lo.phone}
                  </a>
                ) : null}
                {lo.email ? (
                  <a className="textlink" href={`mailto:${lo.email}`}>
                    {lo.email}
                  </a>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="wrap">
          <h2 className="display display-lg">
            Buyers asking
            <br />
            about financing?
          </h2>
          <div className="actions">
            {lo.applyUrl ? (
              <a className="pill pill-white pill-lg" href={lo.applyUrl} target="_blank" rel="noreferrer">
                Send them to {loFirst}
              </a>
            ) : tel ? (
              <a className="pill pill-white pill-lg" href={tel}>
                Call {loFirst}
              </a>
            ) : null}
            {lo.email ? (
              <a className="textlink" href={`mailto:${lo.email}`}>
                {lo.email}
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <footer className="foot">
        <div className="wrap">
          <div className="foot-top">
            <p className="foot-mark">
              <span>{wordA}</span>
              <span className="dim">{wordB}</span>
            </p>
            <div className="foot-cols">
              <a href="#graphics">Graphics</a>
              <a href="#captions">Captions</a>
              <a href={`/l/${l.slug}/download`}>Download all</a>
              {lo.applyUrl ? (
                <a href={lo.applyUrl} target="_blank" rel="noreferrer">
                  Get pre-approved
                </a>
              ) : null}
            </div>
          </div>
          <div className="foot-legal">
            <p>{complianceLine(lo)}</p>
            {pay ? <p>{pay.disclaimer}</p> : null}
            {lo.disclaimer ? <p>{lo.disclaimer}</p> : null}
            <p>
              Marketing by{" "}
              <a href="https://ownitsocial.com" target="_blank" rel="noreferrer">
                Own It Social
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
