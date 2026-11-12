import Link from "next/link";
import { detections, loanOfficers } from "@/lib/store";
import { formatPrice } from "@/lib/format";
import { kitsMissingPhotos, lastRun, lastTestRun } from "@/lib/detect/run";
import { PendingButton } from "@/components/admin/PendingButton";
import { currentMarketRates } from "@/lib/rates";
import { listingProvider, photoSource } from "@/lib/detect/providers";
import type { DetectionStatus } from "@/lib/detect/types";
import { duplicateGroups } from "@/lib/detect/dedupe";
import { approveAction, dismissAction, fetchPhotosAction, runNowAction } from "./actions";

export const maxDuration = 300;

const LABELS: Record<DetectionStatus, string> = {
  created: "Kit created",
  review: "Needs review",
  "waiting-lo": "Waiting on LO",
  dismissed: "Dismissed",
};

export default async function DetectionsPage({ searchParams }: PageProps<"/admin/detections">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const msg = typeof sp.msg === "string" ? sp.msg : "";
  const all = await detections.list();
  const [los, run, test, rates, noPhotos] = await Promise.all([
    loanOfficers.list(),
    lastRun(),
    lastTestRun(),
    currentMarketRates(),
    kitsMissingPhotos(undefined, all),
  ]);
  const rows = all.filter((d) => (status ? d.status === status : d.status !== "dismissed"));
  const count = (s: DetectionStatus) => all.filter((d) => d.status === s).length;
  const waitingLos = [...new Set(all.filter((d) => d.status === "waiting-lo").map((d) => d.loanOfficerName))];
  const repeatGroups = duplicateGroups(all.filter((d) => d.status !== "dismissed"));
  const provider = listingProvider();
  const photos = photoSource();

  return (
    <>
      {msg ? <div className="alert alert-success">{msg}</div> : null}
      <div className="toolbar">
        <h1>New listings</h1>
        <form action={runNowAction} className="filters">
          <PendingButton
            className="btn btn-small btn-ghost"
            name="dryRun"
            value="1"
            disabled={!provider}
            pendingText="Test running…"
            note="Checking every area. Takes 1 to 2 minutes; keep this tab open."
          >
            Test run
          </PendingButton>
          <PendingButton
            name="dryRun"
            value="0"
            disabled={!provider}
            pendingText="Running…"
            note="Pulling listings, building kits, fetching photos, then emailing LOs. Takes up to about 4 minutes; keep this tab open."
          >
            Run now
          </PendingButton>
        </form>
      </div>

      <p className="muted small">
        Every Monday and Thursday at 3 AM Eastern we pull new listings around each metro, match the listing agent to your{" "}
        <Link href="/admin/roster">roster</Link> and build the kit. Confident matches become kits automatically;
        close calls wait here for you. Listing photos load in the background after each run, and loan officers are emailed at 7 AM.
        {" "}
        Listings feed: <strong>{provider ? provider.name : "not set up (add RENTCAST_API_KEY)"}</strong> · Photos:{" "}
        <strong>{photos === "zillow" ? "Zillow via Apify" : photos === "webhook" ? "photo webhook" : "not set up (add APIFY_TOKEN)"}</strong>
        {run ? (
          <>
            {" "}
            · Last run {new Date(run.finishedAt).toLocaleString("en-US")}: {run.listingsScanned} scanned, {run.matches} matched
            {run.agedMatches ? ` (${run.agedMatches} at 90 days on market)` : ""},{" "}
            {run.created} kits, {run.requests} feed requests
            {run.repeatsSkipped ? `, ${run.repeatsSkipped} repeat homes skipped` : ""}
            {run.errors.length ? `, ${run.errors.length} errors` : ""}
          </>
        ) : null}
      </p>
      <p className="muted small">
        National rates for payment estimates:{" "}
        {rates ? (
          <strong>
            Conventional {rates.conventional.ratePct}% ({rates.conventional.aprPct}% APR est.) · FHA {rates.fha.ratePct}% (
            {rates.fha.aprPct}% APR est.) · VA {rates.va.ratePct}% ({rates.va.aprPct}% APR est.), as of {rates.asOf}
          </strong>
        ) : (
          <strong>couldn&apos;t be loaded right now (they retry on the next run)</strong>
        )}
        . A loan officer&apos;s own default rate, if set, takes priority.
      </p>
      {run?.errors.length ? (
        <div className="alert alert-error">
          <strong>Errors in the last run</strong>
          <ul>
            {run.errors.slice(0, 8).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {test && (!run || test.run.finishedAt > run.finishedAt) ? (
        <div className="alert">
          <strong>Last test run</strong> ({new Date(test.run.finishedAt).toLocaleString("en-US")}, nothing saved):{" "}
          {test.run.metros} metros checked with {test.run.requests} feed requests, {test.run.listingsScanned} new listings
          scanned, {test.detections.length} matched your roster.
          {test.run.errors.length ? (
            <ul>
              {test.run.errors.slice(0, 8).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          {test.detections.length ? (
            <ul>
              {test.detections.map((d) => (
                <li key={d.slug}>
                  <strong>{d.listing.address}</strong>, {d.listing.city} ({formatPrice(d.listing.price)}): listed by{" "}
                  {d.listing.agent.name}, matches {d.rosterAgent.name} (LO {d.loanOfficerName}),{" "}
                  {Math.round(d.confidence * 100)}%:{" "}
                  {d.status === "created" ? "would create the kit" : d.status === "review" ? "would ask you to review" : "waiting on the LO record"}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">
              No roster agents listed anything in that window. That&apos;s normal on a quiet day; press Run now to save
              results, or check back after tomorrow&apos;s run.
            </p>
          )}
        </div>
      ) : null}
      {noPhotos.length ? (
        <div className="alert">
          <div className="toolbar" style={{ margin: 0 }}>
            <strong>
              {noPhotos.length} kit{noPhotos.length === 1 ? "" : "s"} without photos
            </strong>
            <form action={fetchPhotosAction}>
              <PendingButton
                disabled={!photos}
                pendingText="Fetching photos…"
                note="Looking each home up on Zillow (no RentCast use). Takes up to about 4 minutes; anything left keeps loading in the background."
              >
                Fetch missing photos
              </PendingButton>
            </form>
          </div>
          <details>
            <summary className="small">Show which</summary>
            <ul>
              {noPhotos.map(({ det, kit }) => (
                <li key={det.slug}>
                  <a href={`/l/${kit.slug}`} target="_blank" rel="noreferrer">
                    {kit.address}, {kit.city}
                  </a>{" "}
                  <span className="muted small">
                    (LO {det.loanOfficerName}, found {new Date(det.createdAt).toLocaleDateString("en-US")})
                    {det.photoNote ? (
                      <>
                        {" "}
                        · {det.photoNote}
                        {det.photoTries ? ` (tried ${det.photoTries}×)` : ""}
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
      {repeatGroups.length ? (
        <div className="alert">
          <strong>
            {repeatGroups.length} home{repeatGroups.length === 1 ? "" : "s"} found twice
          </strong>{" "}
          (the listings feed sent the same home under two addresses or ids, e.g. with and without a unit). New runs skip these, and
          a loan officer is never emailed the same home twice. Dismiss the extra kit if you like.
          <details>
            <summary className="small">Show which</summary>
            <ul>
              {repeatGroups.map((g) => (
                <li key={g[0].slug}>
                  {g.map((d, i) => (
                    <span key={d.slug}>
                      {i ? " = " : ""}
                      {d.listingSlug ? (
                        <a href={`/l/${d.listingSlug}`} target="_blank" rel="noreferrer">
                          {d.listing.address}
                          {d.listing.unit ? ` ${d.listing.unit}` : ""}
                        </a>
                      ) : (
                        <>
                          {d.listing.address}
                          {d.listing.unit ? ` ${d.listing.unit}` : ""}
                        </>
                      )}
                    </span>
                  ))}{" "}
                  <span className="muted small">
                    ({g[0].listing.city}, LO {g[0].loanOfficerName}
                    {g.filter((d) => d.emailedAt && !d.duplicateOf).length > 1 ? ", emailed twice before this fix" : ""})
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
      {waitingLos.length ? (
        <div className="alert">
          Kits are waiting on loan officers who aren&apos;t set up yet: <strong>{waitingLos.join(", ")}</strong>.{" "}
          <Link href="/admin/loan-officers/new">Add them</Link> (same name) and the next run creates their kits.
        </div>
      ) : null}

      <nav className="filters" style={{ margin: "24px 0 16px" }}>
        {(
          [
            ["", `Open (${all.length - count("dismissed")})`],
            ["review", `Needs review (${count("review")})`],
            ["waiting-lo", `Waiting on LO (${count("waiting-lo")})`],
            ["created", `Kit created (${count("created")})`],
            ["dismissed", `Dismissed (${count("dismissed")})`],
          ] as const
        ).map(([s, label]) => (
          <Link key={s} className={`btn btn-small ${status === s ? "" : "btn-ghost"}`} href={s ? `?status=${s}` : "?"}>
            {label}
          </Link>
        ))}
      </nav>

      {!rows.length ? (
        <div className="empty">
          <p>Nothing here yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th />
                <th>Listing</th>
                <th>Listing agent</th>
                <th>Roster match</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.slug}>
                  <td className="thumb">
                    {d.listing.photos[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.listing.photos[0]} alt="" />
                    ) : null}
                  </td>
                  <td>
                    <strong>{d.listing.address}</strong>
                    <div className="muted small">
                      {d.listing.city}, {d.listing.state} · {formatPrice(d.listing.price)}
                      {d.listing.mlsNumber ? ` · MLS #${d.listing.mlsNumber}` : ""} · {d.listing.photos.length} photos
                    </div>
                  </td>
                  <td>
                    {d.listing.agent.name}
                    <div className="muted small">{d.listing.office?.name}</div>
                  </td>
                  <td>
                    {d.rosterAgent.name} → LO {d.loanOfficerName}
                    <div className="muted small">
                      {Math.round(d.confidence * 100)}% · {d.reason}
                    </div>
                  </td>
                  <td>
                    <span className="tag-status">{LABELS[d.status]}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      {d.status === "created" && d.listingSlug ? (
                        <>
                          <a className="btn btn-small btn-ghost" href={`/l/${d.listingSlug}`} target="_blank" rel="noreferrer">
                            View kit
                          </a>
                          <Link className="btn btn-small btn-ghost" href={`/admin/listings/${d.listingSlug}`}>
                            Edit
                          </Link>
                        </>
                      ) : d.status !== "dismissed" ? (
                        <form action={approveAction.bind(null, d.slug)} className="row-actions">
                          {!d.loanOfficerSlug ? (
                            <select name="lo" defaultValue="">
                              <option value="">LO: {d.loanOfficerName}</option>
                              {los.map((lo) => (
                                <option key={lo.slug} value={lo.slug}>
                                  {lo.name}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          <PendingButton pendingText="Creating…">Create kit</PendingButton>
                          <button className="btn btn-small btn-ghost" formAction={dismissAction.bind(null, d.slug)}>
                            Not a match
                          </button>
                        </form>
                      ) : null}
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
