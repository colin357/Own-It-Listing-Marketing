import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listings, loanOfficers } from "@/lib/store";
import { buildPath, validAccountToken } from "@/lib/loLinks";
import { loanOfficerToValues } from "@/lib/formValues";
import { billingLabel, CONTACT_EMAIL, isActive, PLAN } from "@/lib/plan";
import { formatPrice, streetLine } from "@/lib/format";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { ProfileForm } from "./AccountForms";
import "../../../site.css";

export const metadata: Metadata = { title: "Your account · Listing Kits", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage({ params, searchParams }: PageProps<"/account/[slug]/[token]">) {
  const { slug, token } = await params;
  const { welcome } = await searchParams;
  if (!validAccountToken(slug, token)) notFound();
  const [lo, all] = await Promise.all([loanOfficers.get(slug), listings.list()]);
  if (!lo) notFound();

  const active = isActive(lo);
  const self = !!lo.billing;
  const build = buildPath(slug);
  const recent = all.filter((l) => l.loanOfficerSlug === slug).slice(0, 8);

  return (
    <div className="site">
      <SiteHeader right={<span className="small muted">{lo.name}</span>} />
      <main className="wrap acct">
        <p className="eyebrow">Your account</p>
        <h1 className="display display-md">Hi {lo.name.split(/\s+/)[0]}</h1>

        {welcome && lo.billing?.status === "trialing" ? (
          <div className="site-note">
            You&apos;re in. Your {PLAN.trialDays}-day free trial has started. We also emailed you this page&apos;s link.
          </div>
        ) : null}

        {self ? (
          <section className="acct-status">
            <div>
              <p className="site-label">Plan</p>
              <p className="acct-plan">
                Listing Kits · ${PLAN.priceUsd}/month
              </p>
              <p className={active ? "small" : "small acct-warn"}>{billingLabel(lo)}</p>
            </div>
            <Link className="pill pill-ghost" href={`/account/${slug}/${token}/billing`} prefetch={false}>
              {active ? "Manage billing" : "Restart subscription"}
            </Link>
          </section>
        ) : null}

        {!active ? (
          <div className="site-alert">
            <p>
              Your subscription isn&apos;t active, so we&apos;ve paused new kits. Kits you already have still work. Restart it
              from Manage billing, or email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          </div>
        ) : null}

        {self && active ? (
          <section className="acct-steps">
            <h2 className="site-h2">What happens next</h2>
            <p className="muted">
              Our team will reach out to get your headshot, logo and the agents you work with, and set up the areas you cover.
              After that, kits for your agents&apos; new listings arrive in your inbox.
            </p>
            {!lo.applyUrl ? <p className="muted">Meanwhile, add your pre-approval link below so the flyer QR code points to it.</p> : null}
          </section>
        ) : null}

        {active && build ? (
          <section className="acct-build">
            <div>
              <h2 className="site-h2">Build a kit now</h2>
              <p className="muted">Type the address of any active listing and get the full kit in about a minute.</p>
            </div>
            <Link className="pill pill-lg" href={build}>
              Build a kit
            </Link>
          </section>
        ) : null}

        <section className="acct-section">
          <h2 className="site-h2">Your details</h2>
          <p className="muted acct-intro">These go on every graphic that mentions financing, with your NMLS and Equal Housing line.</p>
          <ProfileForm slug={slug} token={token} initial={loanOfficerToValues(lo)} />
        </section>

        {recent.length ? (
          <section className="acct-section">
            <h2 className="site-h2">Recent kits</h2>
            <ul className="acct-kits">
              {recent.map((l) => (
                <li key={l.slug}>
                  <Link href={`/l/${l.slug}`}>
                    <strong>{streetLine(l)}</strong>, {l.city}
                  </Link>
                  <span className="muted small">
                    {formatPrice(l.price)} · {l.builder ?? l.agent.name}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="small muted acct-keep">
          This page&apos;s address is your private sign-in link. Bookmark it, or get it again any time from Sign in.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
