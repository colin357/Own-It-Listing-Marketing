import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { PLAN } from "@/lib/plan";
import { DEMO_SLUG } from "@/lib/demo";
import { configuredOrigin } from "@/lib/site";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import "./site.css";

const TITLE = "Listing marketing for your agents · Own It Social";
const DESCRIPTION = `Every time one of your agents lists a home, you get a finished, co-branded marketing kit to send them. $${PLAN.priceUsd}/month, ${PLAN.trialDays}-day free trial.`;
const ORIGIN = configuredOrigin() ?? "https://kits.ownitsocial.com";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${ORIGIN}/` },
  openGraph: {
    type: "website",
    url: `${ORIGIN}/`,
    siteName: "Own It Social",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: `${ORIGIN}/share-image`, width: 1200, height: 630, alt: "Listing marketing for your agents" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [`${ORIGIN}/share-image`] },
};

const STEPS = [
  {
    title: "Sign up, we set you up",
    text: "Start your free trial. Our team gets your headshot and logo and loads the agents you work with and the areas you cover.",
  },
  {
    title: "We watch for their listings",
    text: "Twice a week we check every new listing in your area. When one of your agents lists a home, we build the kit.",
  },
  {
    title: "You send one link",
    text: "The finished kit lands in your inbox with an email to the agent already written. Tap send and you're the lender who showed up first.",
  },
];

const KIT = [
  { name: "Social posts", text: "Square, 4:5 and story sizes for Instagram and Facebook, plus a landscape post for LinkedIn." },
  { name: "Print flyer", text: "8.5 × 11 with QR codes to the listing and your pre-approval link. PNG and PDF." },
  { name: "Payment flyers", text: "Monthly payments by loan type, cash to close and what it takes to qualify, with your NMLS and disclosures." },
  { name: "Seller incentive", text: "The agent taps a buydown or closing credit and every graphic updates with the new payment." },
  { name: "Buyer page", text: "A shareable page for the home with photos, payments and a button to book a tour." },
  { name: "Captions and emails", text: "Copy-and-paste captions and six ready-to-send emails in the agent's voice." },
];

const FAQ = [
  {
    q: "Where do the listings come from?",
    a: "We check the listing feed for your area every Monday and Thursday morning and match each listing agent against the agents you work with. Photos are pulled in automatically, usually the same day.",
  },
  {
    q: "What if an agent isn't on my list, or I'm still getting set up?",
    a: "Build a kit for any active listing yourself. Type the address and the full kit is ready in about a minute. There's no limit on kits.",
  },
  {
    q: "Is my information on every graphic?",
    a: "Your name, NMLS, company and Equal Housing line go on every graphic that mentions financing. Graphics without financing show the agent only, so agents are happy to post them.",
  },
  {
    q: "Can my compliance team review it first?",
    a: "Yes, and we suggest it. Send them the sample kit link. Every graphic that mentions financing shows your name, NMLS #, company and the Equal Housing Opportunity line, and the payment graphics spell out the rate, APR and assumptions behind each number. If your company requires specific disclosure wording, we add it for you during setup.",
  },
  {
    q: "What does the agent have to do?",
    a: "Nothing technical. They open the link, download what they want and post. They can add their own headshot and pick a seller incentive with one tap.",
  },
  {
    q: "Can I cancel?",
    a: `Yes, any time from your account. You won't be charged during the ${PLAN.trialDays}-day trial, and kits you've already sent keep working after you cancel.`,
  },
];

export default function Home() {
  return (
    <div className="site">
      <SiteHeader />
      <main>
        <section className="lp-hero">
          <div className="wrap lp-hero-inner">
            <div className="lp-hero-copy">
              <h1 className="display lp-title">
                <span>Listing marketing</span>
                <span>for your agents.</span>
              </h1>
              <p className="lead lp-lead">
                Every time one of your agents takes a new listing, we build a full marketing kit with your name on it.{" "}
                <span className="lp-lead-extra">Social posts, flyers, payment breakdowns, captions and emails. </span>You send one
                link. They post it.
              </p>
              <div className="actions">
                <Link className="pill pill-lg" href="/signup">
                  Start {PLAN.trialDays}-day free trial
                </Link>
                <Link className="textlink" href={`/l/${DEMO_SLUG}`}>
                  See a sample kit
                </Link>
              </div>
              <p className="small muted lp-fine">
                ${PLAN.priceUsd}/month after your trial. Cancel any time.
              </p>
            </div>
            <div className="lp-stack" aria-label="Sample graphics from one listing kit">
              <Image
                className="lp-stack-flyer"
                src="/sample/flyer.png"
                alt="Sample print flyer"
                width={1275}
                height={1650}
                sizes="(max-width: 900px) 64vw, 380px"
                preload
              />
              <Image
                className="lp-stack-square"
                src="/sample/square.png"
                alt="Sample Just Listed post"
                width={1080}
                height={1080}
                sizes="(max-width: 900px) 58vw, 340px"
                preload
              />
            </div>
          </div>
        </section>

        <section className="lp-proof" aria-label="What loan officers say">
          <div className="wrap lp-proof-inner">
            <p className="lp-stat">
              <strong>1,000+</strong>
              <span>listing kits built in the last 7 days</span>
            </p>
            <figure className="lp-quote">
              <blockquote>
                &ldquo;I&apos;ve been able to stay in front of my referral partners and build relationships with new ones because of
                these easy marketing pieces!&rdquo;
              </blockquote>
              <figcaption>Ashley Hickmon, Loan Officer</figcaption>
            </figure>
          </div>
        </section>

        <section className="lp-how">
          <div className="wrap">
            <h2 className="display display-sm lp-h2">How it works</h2>
            <ol className="lp-steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="lp-num">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="lp-step-title">{s.title}</h3>
                  <p className="muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-kit" id="kit">
          <div className="wrap">
            <div className="lp-kit-head">
              <h2 className="display display-md">Everything for one listing</h2>
              <div>
                <p className="lead">One link per listing. Every graphic is made for that home, ready to post the day it lists.</p>
                <Link className="pill pill-white lp-kit-demo" href={`/l/${DEMO_SLUG}`}>
                  Open the sample kit
                </Link>
              </div>
            </div>
            <div className="lp-strip">
              {[
                ["details", "Feature post", 1080, 1350],
                ["payments", "Payment options", 1275, 1650],
                ["ways", "Ways to buy", 1275, 1650],
                ["qualify", "What it takes", 1275, 1650],
              ].map(([file, label, w, h]) => (
                <figure key={file}>
                  <Image
                    src={`/sample/${file}.png`}
                    alt={`Sample ${label}`}
                    width={w as number}
                    height={h as number}
                    sizes="(max-width: 900px) 50vw, 300px"
                  />
                  <figcaption>{label}</figcaption>
                </figure>
              ))}
            </div>
            <div className="rows lp-rows">
              {KIT.map((k) => (
                <div className="lp-row" key={k.name}>
                  <h3 className="row-name">{k.name}</h3>
                  <p>{k.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-price" id="pricing">
          <div className="wrap lp-price-inner">
            <div>
              <h2 className="display display-md">One plan</h2>
              <p className="lead muted">Every listing by every agent on your list, plus any listing you build yourself.</p>
            </div>
            <div className="lp-price-card">
              <p className="site-label">Listing Kits</p>
              <p className="lp-amount">
                ${PLAN.priceUsd}
                <span>/month</span>
              </p>
              <ul>
                <li>{PLAN.trialDays}-day free trial</li>
                <li>Unlimited kits</li>
                <li>We set up your agents and service area for you</li>
                <li>New listings checked twice a week, kits emailed to you</li>
                <li>Build a kit for any listing yourself</li>
                <li>Cancel any time</li>
              </ul>
              <Link className="pill pill-lg" href="/signup">
                Start free trial
              </Link>
            </div>
          </div>
        </section>

        <section className="lp-faq">
          <div className="wrap lp-faq-inner">
            <h2 className="display display-sm lp-h2">Questions</h2>
            <div className="lp-faq-list">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p className="muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="cta">
          <div className="wrap">
            <h2 className="display display-lg">
              <span>Be the lender</span>
              <span>they post with.</span>
            </h2>
            <Link className="pill pill-lg pill-white" href="/signup">
              Start {PLAN.trialDays}-day free trial
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
