import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { activateCheckout } from "@/lib/billing";
import { accountPath } from "@/lib/loLinks";
import { siteUrl } from "@/lib/site";
import { CONTACT_EMAIL } from "@/lib/plan";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import "../../site.css";

export const metadata: Metadata = { title: "Welcome · Listing Kits", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Stripe sends people here after checkout. Sets up their account (if the webhook hasn't yet) and opens it. */
export default async function WelcomePage({ searchParams }: PageProps<"/signup/welcome">) {
  const { session_id } = await searchParams;
  let path: string | null = null;
  if (typeof session_id === "string" && session_id.startsWith("cs_")) {
    try {
      const lo = await activateCheckout(session_id, await siteUrl());
      if (lo) path = accountPath(lo.slug);
    } catch (err) {
      console.error("Welcome page activation failed", err);
    }
  }
  if (path) redirect(`${path}?welcome=1`);
  return (
    <div className="site">
      <SiteHeader />
      <main className="wrap acct">
        <h1 className="display display-md">Thanks for signing up</h1>
        <p className="lead muted acct-intro">
          We&apos;re setting up your account. We&apos;ll email your sign-in link in a minute. If it doesn&apos;t arrive, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
        <p>
          <Link className="textlink" href="/login">
            Get my sign-in link
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
