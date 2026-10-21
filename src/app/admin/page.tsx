import Link from "next/link";
import { listings, loanOfficers } from "@/lib/store";
import { formatPrice, statusLabel, streetLine } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { CopyButton } from "@/components/CopyButton";

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const lo = typeof sp.lo === "string" ? sp.lo : "";
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const saved = typeof sp.saved === "string" ? sp.saved : "";

  const [all, los, origin] = await Promise.all([listings.list(), loanOfficers.list(), siteUrl()]);
  const loName = new Map(los.map((x) => [x.slug, x.name]));
  const rows = all.filter(
    (l) =>
      (!lo || l.loanOfficerSlug === lo) &&
      (!q || `${l.address} ${l.city} ${l.agent.name}`.toLowerCase().includes(q)),
  );
  const savedListing = saved ? all.find((l) => l.slug === saved) : undefined;

  return (
    <>
      {savedListing ? (
        <div className="alert alert-success">
          <strong>Kit ready for {streetLine(savedListing)}.</strong> Send this link to {savedListing.agent.name}:
          <div className="share-row">
            <code>{`${origin}/l/${savedListing.slug}`}</code>
            <CopyButton text={`${origin}/l/${savedListing.slug}`} label="Copy link" />
            <a className="btn btn-small btn-ghost" href={`/l/${savedListing.slug}`} target="_blank" rel="noreferrer">
              Open
            </a>
          </div>
        </div>
      ) : null}

      <div className="toolbar">
        <h1>Listings ({rows.length})</h1>
        <form className="filters">
          <input name="q" placeholder="Search address or agent" defaultValue={q} />
          <select name="lo" defaultValue={lo}>
            <option value="">All loan officers</option>
            {los.map((x) => (
              <option key={x.slug} value={x.slug}>
                {x.name}
              </option>
            ))}
          </select>
          <button className="btn btn-small btn-ghost">Filter</button>
        </form>
      </div>

      {!los.length ? (
        <div className="empty">
          <p>Add your first loan officer to get started.</p>
          <Link className="btn" href="/admin/loan-officers/new">
            Add loan officer
          </Link>
        </div>
      ) : !rows.length ? (
        <div className="empty">
          <p>No listings yet.</p>
          <Link className="btn" href="/admin/listings/new">
            Create a listing kit
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th />
                <th>Listing</th>
                <th>Status</th>
                <th>Agent</th>
                <th>Loan officer</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.slug}>
                  <td className="thumb">
                    {l.photos[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.photos[0]} alt="" />
                    ) : null}
                  </td>
                  <td>
                    <strong>{streetLine(l)}</strong>
                    <div className="muted small">
                      {l.city}, {l.state} · {formatPrice(l.price)}
                    </div>
                  </td>
                  <td>
                    <span className="pill">{statusLabel(l)}</span>
                  </td>
                  <td>{l.agent.name}</td>
                  <td>{loName.get(l.loanOfficerSlug) ?? l.loanOfficerSlug}</td>
                  <td className="small muted">{new Date(l.createdAt).toLocaleDateString("en-US")}</td>
                  <td>
                    <div className="row-actions">
                    <CopyButton text={`${origin}/l/${l.slug}`} label="Copy link" />
                    <a className="btn btn-small btn-ghost" href={`/l/${l.slug}`} target="_blank" rel="noreferrer">
                      View
                    </a>
                    <Link className="btn btn-small btn-ghost" href={`/admin/listings/${l.slug}`}>
                      Edit
                    </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
