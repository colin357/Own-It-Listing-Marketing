import Link from "next/link";
import { listings, loanOfficers } from "@/lib/store";
import { buildPath } from "@/lib/loLinks";
import { siteUrl } from "@/lib/site";
import { CopyButton } from "@/components/CopyButton";

export default async function LoanOfficersPage() {
  const [los, all, origin] = await Promise.all([loanOfficers.list(), listings.list(), siteUrl()]);
  const counts = new Map<string, number>();
  for (const l of all) counts.set(l.loanOfficerSlug, (counts.get(l.loanOfficerSlug) ?? 0) + 1);

  return (
    <>
      <div className="toolbar">
        <h1>Loan officers ({los.length})</h1>
        <Link className="btn btn-small" href="/admin/loan-officers/new">
          + Add loan officer
        </Link>
      </div>
      <div className="lo-grid">
        {los.map((lo) => (
          <article key={lo.slug} className="lo-tile" style={{ borderTopColor: lo.brandColor || "#0f2a44" }}>
            {lo.headshotUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lo.headshotUrl} alt="" />
            ) : null}
            <div>
              <strong>{lo.name}</strong>
              <div className="small muted">
                {lo.company} · NMLS #{lo.nmls}
              </div>
              <div className="small muted">
                Slug: <code>{lo.slug}</code> · {counts.get(lo.slug) ?? 0} listings
              </div>
              <div className="row-actions">
                <Link className="btn btn-small btn-ghost" href={`/admin/loan-officers/${lo.slug}`}>
                  Edit
                </Link>
                <Link className="btn btn-small btn-ghost" href={`/admin?lo=${lo.slug}`}>
                  Listings
                </Link>
                <Link className="btn btn-small btn-ghost" href={`/admin/listings/new?lo=${lo.slug}`}>
                  + Listing
                </Link>
                {buildPath(lo.slug) ? (
                  <CopyButton
                    text={`${origin}${buildPath(lo.slug)}`}
                    label="Copy kit builder link"
                    className="btn btn-small btn-ghost"
                  />
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
