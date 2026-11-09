import type { Metadata } from "next";
import { PLAN } from "@/lib/plan";
import { stripeTestMode } from "@/lib/billing";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { SignupForm } from "./SignupForm";
import "../site.css";

export const metadata: Metadata = { title: "Start your free trial · Listing Kits" };
export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { canceled } = await searchParams;
  return (
    <div className="site">
      <SiteHeader />
      <main className="wrap signup">
        <div className="signup-copy">
          <p className="eyebrow">{PLAN.trialDays} days free</p>
          <h1 className="display display-md">Start your free trial</h1>
          <p className="lead muted">
            Tell us who you are. Next you&apos;ll add a card and upload your headshot and logo. Our team takes care of setting up your agents.
          </p>
          <ul className="signup-points">
            <li>${PLAN.priceUsd}/month after the {PLAN.trialDays}-day trial</li>
            <li>Cancel any time from your account</li>
            <li>Kits for every new listing by your agents, plus any listing you choose</li>
            <li>We set up your agents and service area for you</li>
          </ul>
        </div>
        <div className="signup-form">
          {canceled ? <div className="site-note">Checkout was canceled. Nothing was charged. You can try again below.</div> : null}
          {stripeTestMode() ? (
            <div className="site-note">Test mode: use card 4242 4242 4242 4242, any future date and any CVC.</div>
          ) : null}
          <SignupForm trialDays={PLAN.trialDays} price={PLAN.priceUsd} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
