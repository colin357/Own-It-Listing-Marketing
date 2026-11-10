import type { Metadata } from "next";
import { CONTACT_EMAIL } from "@/lib/plan";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import "../site.css";

export const metadata: Metadata = { title: "Privacy policy · Listing Kits" };

const UPDATED = "November 10, 2026";

export default function PrivacyPage() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <div className="site">
      <SiteHeader />
      <main className="wrap acct legal">
        <h1 className="display display-md">Privacy policy</h1>
        <p className="lead muted acct-intro">Last updated {UPDATED}</p>

        <p>
          Own It Social (&quot;we&quot;) runs Listing Kits at kits.ownitsocial.com. This policy explains what we collect, why, and the
          choices you have. Questions go to {mail}.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account details you give us</strong> when you sign up or we set you up: name, email, phone, company, NMLS number,
            headshot, logo and the agents and areas you work with.
          </li>
          <li>
            <strong>Billing</strong> is handled by Stripe. We store your Stripe customer and subscription status, never your full card
            number.
          </li>
          <li>
            <strong>Listing information</strong> from public listing sources (address, price, photos, listing agent name, brokerage and
            phone) to build marketing kits.
          </li>
          <li>
            <strong>Website usage</strong>: pages visited, device and browser details, and cookies, including the Meta (Facebook) Pixel on
            our sales pages (home, sign-up, sign-in and account pages).
          </li>
        </ul>

        <h2>How we use it</h2>
        <ul>
          <li>To build and email your listing kits and run your account.</li>
          <li>To bill you and send account and service emails.</li>
          <li>To measure and improve our advertising, for example knowing whether a sign-up came from a Facebook or Instagram ad.</li>
          <li>To keep the service secure and to meet legal obligations.</li>
        </ul>
        <p>We do not sell your personal information.</p>

        <h2>Advertising cookies and the Meta Pixel</h2>
        <p>
          Our sales pages use the Meta Pixel, and when you start a trial we send Meta a hashed (scrambled) copy of your email and phone so
          it can tell which ad you came from. Meta may use this to show you ads and measure them, under{" "}
          <a href="https://www.facebook.com/privacy/policy" target="_blank" rel="noreferrer">
            Meta&apos;s privacy policy
          </a>
          . Listing kit pages and buyer pages do not use the Meta Pixel. You can turn off ad personalization in your{" "}
          <a href="https://accountscenter.facebook.com/ad_preferences" target="_blank" rel="noreferrer">
            Meta ad preferences
          </a>{" "}
          or block cookies in your browser.
        </p>

        <h2>Who we share it with</h2>
        <p>
          Only service providers that help us run Listing Kits: Stripe (payments), Vercel (hosting), Upstash (database), Microsoft (email),
          our listing and photo data providers, and Meta (advertising measurement). The kits you send are seen by the agents and buyers
          you share them with. We may also share information if the law requires it.
        </p>

        <h2>How long we keep it</h2>
        <p>
          We keep account information while your account is open and for a reasonable time after, as needed for billing records and legal
          obligations. Ask us to delete your account at any time.
        </p>

        <h2>Your choices</h2>
        <p>
          You can see, correct or delete your information, or cancel your subscription, by emailing {mail} or from your account page.
          Depending on where you live, you may have other privacy rights; contact us to use them.
        </p>

        <h2>Changes</h2>
        <p>If we change this policy we&apos;ll update the date above, and tell you by email if the change is significant.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
