import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listings, loanOfficers } from "@/lib/store";
import { validKitEditToken } from "@/lib/loLinks";
import { listingToValues } from "@/lib/formValues";
import { streetLine } from "@/lib/format";
import { blobMode } from "@/lib/blob";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { EditKitForm } from "./EditKitForm";
import "../../../site.css";

export const metadata: Metadata = { title: "Edit kit · Listing Kits", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The loan officer's private page for changing one kit. The link comes from their account page or kit emails. */
export default async function EditKitPage({ params }: PageProps<"/edit/[kit]/[token]">) {
  const { kit, token } = await params;
  if (!validKitEditToken(kit, token)) notFound();
  const listing = await listings.get(kit);
  if (!listing) notFound();
  const lo = await loanOfficers.get(listing.loanOfficerSlug);

  return (
    <div className="site">
      <SiteHeader right={lo ? <span className="small muted">{lo.name}</span> : null} />
      <main className="wrap acct">
        <p className="eyebrow">Edit kit</p>
        <h1 className="display display-md">{streetLine(listing)}</h1>
        <p className="muted acct-intro">
          {listing.city}, {listing.state} · Listed by {listing.builder ?? listing.agent.name}.{" "}
          <Link href={`/l/${kit}`} target="_blank">
            View kit ↗
          </Link>
        </p>
        <p className="muted acct-intro">
          Change anything below and save. Every graphic, flyer, caption and the buyer page update right away, and the agent&apos;s
          link stays the same.
        </p>
        <EditKitForm
          kit={kit}
          token={token}
          initial={{ ...listingToValues(listing), builder: listing.builder ?? "" }}
          isBuilder={!!listing.builder}
          uploadMode={blobMode()}
          defaultRate={lo?.payment?.ratePct}
        />
        <p className="small muted acct-keep">
          This page&apos;s address is private to you. Don&apos;t forward it: anyone with it can edit this kit. To change the address,
          reply to your kit email.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
