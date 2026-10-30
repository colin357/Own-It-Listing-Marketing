import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { getKit } from "@/lib/listings";
import { buildCaptions } from "@/lib/captions";
import { buildEmails } from "@/lib/emails";
import {
  brandColors,
  cityLine,
  complianceLine,
  firstName,
  formatOpenHouse,
  formatPrice,
  paymentInfo,
  statsLine,
  statusLabel,
  streetLine,
} from "@/lib/format";
import { ASSETS, assetsFor, assetVersion, isPrintAsset, type AssetName } from "@/lib/render/templates";
import { CopyButton } from "@/components/CopyButton";
import { ShareButton } from "@/components/ShareButton";
import { AgentPhotoUpload } from "@/components/AgentPhotoUpload";
import { blobMode } from "@/lib/blob";
import { programOptions } from "@/lib/mortgage";
import { activeConcession, concessionTag } from "@/lib/concessions";
import { ConcessionCalculator } from "@/components/ConcessionCalculator";
import { GraphicsTabs } from "@/components/GraphicsTabs";
import { buyerPagePath, siteUrl } from "@/lib/site";

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
  const image = assetUrl(l.slug, "landscape.png", assetVersion(l));
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
  const buyerUrl = (await siteUrl()) + buyerPagePath(l.slug);
  const captions = buildCaptions(l, lo, buyerUrl);
  const emails = buildEmails(l, lo, buyerUrl);
  const pay = paymentInfo(l, lo);
  const oh = formatOpenHouse(l);
  const v = assetVersion(l);
  const order = assetsFor(l, lo);
  const agentFirst = firstName(l.agent.name) ?? "you";
  const loFirst = lo.name.split(" ")[0];
  const [wordA, wordB] = splitName(lo.name);
  const statusWords = statusLabel(l).toUpperCase().split(" ");
  const tel = lo.phone ? `tel:${lo.phone.replace(/[^\d+]/g, "")}` : null;
  const credit = activeConcession(l);
  // The calculator starts from the payments without any credit and applies it live.
  const forSale = l.status !== "just-sold" && l.status !== "under-contract";
  const basePrograms = forSale ? programOptions({ ...l, concession: undefined }, lo) : null;

  // Most-used first: feed posts, then stories and link posts; the listing flyer leads the print set.
  const social = order.filter((name) => !isPrintAsset(name));
  const flyers = order.filter((name) => isPrintAsset(name));
  const card = (name: AssetName) => {
    const a = ASSETS[name];
    const file = `${name}.png`;
    return (
      <article key={name} className={`card card-${name}`} style={{ "--ratio": a.width / a.height } as CSSProperties}>
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
          <p className="card-use">{a.use}</p>
          <div className="card-links">
            {isPrintAsset(name) ? (
              <a className="textlink" href={assetUrl(l.slug, `${name}.pdf`, v, true)}>
                PDF
              </a>
            ) : null}
            <a className="textlink" href={assetUrl(l.slug, file, v, true)}>
              PNG
            </a>
            <ShareButton url={assetUrl(l.slug, file, v)} filename={`${l.slug}-${file}`} text={captions[0].text} />
          </div>
        </div>
      </article>
    );
  };

  // Same order as the sections on the page, so the header reads top to bottom.
  const navLinks = [
    ["#buyer-page", "Buyer page"],
    ...(basePrograms ? [["#seller-credit", "Seller incentive"]] : []),
    ["#graphics", "Graphics"],
    ["#captions", "Captions"],
    ["#emails", "Emails"],
    ["#contact", "Contact"],
  ].map(([href, text]) => (
    <a key={href} href={href}>
      {text}
    </a>
  ));

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
          <nav className="nav-links">{navLinks}</nav>
          <a className="pill" href={`/l/${l.slug}/download`}>
            Download all
          </a>
        </div>
        <nav className="nav-sub" aria-label="Sections">
          <div className="wrap nav-sub-inner">{navLinks}</div>
        </nav>
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
            {credit ? <span>{concessionTag(credit)}</span> : null}
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

      {!l.photos.length ? (
        <section className="intro photos-needed">
          <div className="wrap intro-inner">
            <h2 className="display display-md">
              Add your
              <br />
              photos.
            </h2>
            <div>
              <p className="lead">
                We couldn&apos;t find photos for {streetLine(l)} yet. Add yours and every graphic and the flyer update
                right away.
              </p>
              {blobMode() ? (
                <AgentPhotoUpload slug={l.slug} mode={blobMode()!} />
              ) : (
                <p className="muted">Reply to {loFirst} with your listing photos and they&apos;ll add them.</p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="intro">
        <div className="wrap intro-inner">
          <h2 className="display display-md">
            Made for
            <br />
            {agentFirst}.
          </h2>
          <div>
            <div className="buyer-link" id="buyer-page">
              <p className="label">Your buyer page</p>
              <p className="muted">
                A page for this home to text or email to buyers: photos, details, payments and a button to call you for a
                tour. The flyer QR code, captions and emails already link to it.
              </p>
              <div className="actions">
                <CopyButton text={buyerUrl} label="Copy link" className="pill" />
                <a className="textlink" href={buyerPagePath(l.slug)} target="_blank" rel="noreferrer">
                  Open it
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {basePrograms ? (
        <section className="credit" id="seller-credit">
          <div className="wrap credit-inner">
            <div className="credit-intro">
              <p className="eyebrow">Seller incentive</p>
              <h2 className="display display-md">
                Offer a
                <br />
                buydown.
              </h2>
              <p className="lead">
                Is the seller willing to help with the buyer&apos;s costs? Pick an option and every graphic, flyer, caption and
                email updates to match.
              </p>
              <p className="muted">Not sure which to pick? A 2-1 buydown is the most popular. Or ask {loFirst}.</p>
            </div>
            <ConcessionCalculator slug={l.slug} price={l.price} scenarios={basePrograms.scenarios} initial={credit} />
          </div>
        </section>
      ) : null}

      <section className="work" id="graphics">
        <div className="wrap">
          <div className="work-head">
            <h2 className="display display-lg">
              Ready
              <br />
              to post.
            </h2>
            <div>
              <p className="lead">Tap a graphic to see it full size.</p>
              <a className="pill" href={`/l/${l.slug}/download`}>
                Download all (.zip)
              </a>
            </div>
          </div>
          <GraphicsTabs
            tabs={[
              {
                id: "social",
                label: "Social posts",
                note: "Sized for Instagram, Facebook and LinkedIn. On your phone, tap Share to post straight from here.",
                names: social,
              },
              {
                id: "flyers",
                label: "Flyers",
                note: "Print-ready 8.5 × 11. Grab the PDF for the printer, or the PNG to text or email.",
                names: flyers,
              },
            ]
              .filter((t) => t.names.length)
              .map(({ names, ...t }) => ({ ...t, count: names.length, content: <div className="cards">{names.map(card)}</div> }))}
          />
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

      <section className="mail" id="emails">
        <div className="wrap dark-inner">
          <div className="dark-intro">
            <p className="eyebrow">Your inbox</p>
            <h2 className="display display-md">
              Emails,
              <br />
              ready
              <br />
              to send.
            </h2>
            <p className="lead">
              Copy the subject and the email into Gmail, Outlook or your CRM. Fill in anything in [brackets] before you send.
            </p>
          </div>
          <div className="rows">
            {emails.map((e) => (
              <div key={e.id} className="row">
                <details>
                  <summary>
                    <span>
                      <span className="row-name">{e.label}</span>
                      <span className="row-sub">{e.audience}</span>
                    </span>
                    <span className="row-hint">Preview</span>
                  </summary>
                  <p className="row-subject">
                    <strong>Subject:</strong> {e.subject}
                  </p>
                  <pre className="row-text">{e.body}</pre>
                </details>
                <div className="row-actions">
                  <CopyButton text={e.subject} label="Copy subject" className="pill pill-ghost" />
                  <CopyButton text={e.body} label="Copy email" className="pill" />
                </div>
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
              <a href="#emails">Emails</a>
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
