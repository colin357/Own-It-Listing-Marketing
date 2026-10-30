import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getKit } from "@/lib/listings";
import {
  cityLine,
  complianceLine,
  firstName,
  formatNumber,
  formatOpenHouse,
  formatPrice,
  statsLine,
  statusLabel,
  streetLine,
} from "@/lib/format";
import { programOptions } from "@/lib/mortgage";
import { activeConcession, concessionSentence } from "@/lib/concessions";
import { PhotoGallery } from "@/components/PhotoGallery";
import "./buyer.css";

/**
 * Public, buyer-facing page for one listing (/home/<slug>), the link agents
 * text or email to buyers and the flyer QR code opens. Brand-neutral: it's the
 * agent's page, so no Own It purple and no lender colors. The loan officer
 * only appears next to the payment estimates.
 */

export async function generateMetadata({ params }: PageProps<"/home/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const kit = await getKit(slug);
  if (!kit) return { title: "Home not found" };
  const l = kit.listing;
  const title = `${streetLine(l)}, ${cityLine(l)} | ${formatPrice(l.price)}`;
  const description = [statusLabel(l), statsLine(l), l.agent.name && `Listed by ${l.agent.name}`].filter(Boolean).join(" · ");
  const images = l.photos[0] ? [{ url: l.photos[0] }] : [];
  return {
    title,
    description,
    // Listing photos come from the MLS / Zillow, so keep these pages out of search results.
    robots: { index: false, follow: false },
    openGraph: { title, description, images },
    twitter: { card: "summary_large_image", title, description, images: images.map((i) => i.url) },
  };
}

const money = (n: number) => formatPrice(Math.round(n));

export default async function BuyerPage({ params }: PageProps<"/home/[slug]">) {
  const { slug } = await params;
  const kit = await getKit(slug);
  if (!kit) notFound();
  const { listing: l, lo } = kit;
  const agent = l.agent;
  const agentFirst = firstName(agent.name);
  const forSale = l.status !== "just-sold" && l.status !== "under-contract";
  const programs = forSale ? programOptions(l, lo) : null;
  const credit = activeConcession(l);
  const oh = forSale ? formatOpenHouse(l) : null;

  // One button: call the agent. Falls back to email when there's no phone on file.
  const tel = agent.phone ? `tel:${agent.phone.replace(/[^\d+]/g, "")}` : null;
  const mail = agent.email
    ? `mailto:${agent.email}?subject=${encodeURIComponent(`Tour of ${streetLine(l)}`)}`
    : null;
  const contactHref = tel ?? mail;
  const contactLabel = forSale ? "Schedule a tour" : `Contact ${agentFirst ?? "the agent"}`;

  const facts = [
    { label: "Price", value: formatPrice(l.price) },
    l.beds != null ? { label: "Bedrooms", value: String(l.beds) } : null,
    l.baths != null ? { label: "Bathrooms", value: String(l.baths) } : null,
    l.sqft != null ? { label: "Square feet", value: formatNumber(l.sqft) } : null,
    l.sqft ? { label: "Price per sq ft", value: formatPrice(Math.round(l.price / l.sqft)) } : null,
    l.lotSize ? { label: "Lot", value: l.lotSize } : null,
    l.yearBuilt ? { label: "Year built", value: String(l.yearBuilt) } : null,
    l.source?.mlsNumber ? { label: "MLS #", value: l.source.mlsNumber } : null,
  ].filter((f): f is { label: string; value: string } => !!f);

  const agentCard = (
    <div className="bp-agent">
      {agent.headshotUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={agent.headshotUrl} alt={agent.name} className="bp-agent-photo" />
      ) : null}
      <div>
        <p className="bp-agent-name">{agent.name}</p>
        {agent.brokerage ? <p className="muted">{agent.brokerage}</p> : null}
      </div>
    </div>
  );

  return (
    <div className="bp">
      <header className="bp-bar">
        <div className="wrap bp-bar-inner">
          <p className="bp-bar-agent">
            <strong>{agent.name}</strong>
            {agent.brokerage ? <span className="muted"> · {agent.brokerage}</span> : null}
          </p>
          {contactHref ? (
            <a className="pill" href={contactHref}>
              {contactLabel}
            </a>
          ) : null}
        </div>
      </header>

      <PhotoGallery photos={l.photos} alt={streetLine(l)} />

      <div className="wrap bp-main">
        <main className="bp-body">
          <section className="bp-head">
            <p className="bp-status">{statusLabel(l)}</p>
            <h1 className="bp-address">{streetLine(l)}</h1>
            <p className="bp-city">{cityLine(l)}</p>
            <p className="bp-price">{formatPrice(l.price)}</p>
            {statsLine(l) ? <p className="bp-stats">{statsLine(l)}</p> : null}
          </section>

          {oh || credit ? (
            <section className="bp-notes">
              {oh ? (
                <p className="bp-note">
                  <span className="label">Open house</span>
                  {oh}
                </p>
              ) : null}
              {credit ? (
                <p className="bp-note">
                  <span className="label">Seller incentive</span>
                  {concessionSentence(credit)}
                </p>
              ) : null}
            </section>
          ) : null}

          {l.description || l.highlights.length ? (
            <section className="bp-section">
              <h2 className="bp-h2">About this home</h2>
              {l.description ? <p className="bp-desc">{l.description}</p> : null}
              {l.highlights.length ? (
                <ul className="bp-highlights">
                  {l.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          <section className="bp-section">
            <h2 className="bp-h2">Details</h2>
            <dl className="bp-facts">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {programs ? (
            <section className="bp-section" id="payments">
              <h2 className="bp-h2">Estimated monthly payment</h2>
              <p className="muted bp-intro">
                Including taxes and insurance, for a few common ways to buy.
              </p>
              <ul className="bp-pay">
                {programs.scenarios.map((s) => {
                  const year1 = s.concession?.available && s.concession.schedule.length ? s.concession.schedule[0] : null;
                  return (
                    <li key={s.id}>
                      <div>
                        <strong>{s.name}</strong>
                        <span className="muted">
                          {s.detail}
                          {s.downPayment ? ` · ${money(s.downPayment)} down` : ""}
                        </span>
                      </div>
                      <div className="bp-pay-amount">
                        <strong>{money(s.total)}/mo</strong>
                        {year1 ? <span>{money(year1.total)}/mo in year 1</span> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="bp-lender">
                {lo.headshotUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={lo.headshotUrl} alt={lo.name} className="bp-agent-photo" />
                ) : null}
                <div>
                  <p className="label">Questions about financing?</p>
                  <p className="bp-agent-name">{lo.name}</p>
                  <p className="muted">{[lo.title, lo.company, `NMLS #${lo.nmls}`].filter(Boolean).join(" · ")}</p>
                  <p className="bp-links">
                    {lo.applyUrl ? (
                      <a className="pill pill-ghost" href={lo.applyUrl} target="_blank" rel="noreferrer">
                        Get pre-approved
                      </a>
                    ) : null}
                    {lo.phone ? (
                      <a className="textlink" href={`tel:${lo.phone.replace(/[^\d+]/g, "")}`}>
                        {lo.phone}
                      </a>
                    ) : null}
                    {lo.email ? (
                      <a className="textlink" href={`mailto:${lo.email}`}>
                        Email
                      </a>
                    ) : null}
                  </p>
                </div>
              </div>
              <p className="bp-fine">{programs.paymentDisclaimer}</p>
            </section>
          ) : null}
        </main>

        <aside className="bp-side">
          <div className="bp-card">
            {agentCard}
            {contactHref ? (
              <a className="pill pill-lg bp-cta" href={contactHref}>
                {contactLabel}
              </a>
            ) : null}
            <p className="bp-links">
              {agent.phone && tel ? (
                <a className="textlink" href={tel}>
                  {agent.phone}
                </a>
              ) : null}
              {agent.email ? (
                <a className="textlink" href={`mailto:${agent.email}`}>
                  Email
                </a>
              ) : null}
            </p>
          </div>
        </aside>
      </div>

      <footer className="bp-foot">
        <div className="wrap">
          <p>
            Listing courtesy of {agent.name}
            {agent.brokerage ? `, ${agent.brokerage}` : ""}
            {agent.license ? ` · License #${agent.license}` : ""}
          </p>
          {programs ? <p>{complianceLine(lo)}</p> : null}
          {programs && lo.disclaimer ? <p>{lo.disclaimer}</p> : null}
        </div>
      </footer>

      {/* Phones: the tour button stays in reach while scrolling. */}
      {contactHref ? (
        <div className="bp-dock">
          <a className="pill pill-lg" href={contactHref}>
            {contactLabel}
          </a>
        </div>
      ) : null}
    </div>
  );
}
