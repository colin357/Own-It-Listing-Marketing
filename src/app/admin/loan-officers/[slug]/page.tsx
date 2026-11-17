import { notFound } from "next/navigation";
import { loanOfficers } from "@/lib/store";
import { loanOfficerToValues } from "@/lib/formValues";
import { LoanOfficerForm } from "@/components/admin/LoanOfficerForm";
import { deleteLoanOfficerAction } from "@/app/admin/actions";
import { buildPath } from "@/lib/loLinks";
import { siteUrl } from "@/lib/site";
import { CopyButton } from "@/components/CopyButton";
import { PendingButton } from "@/components/admin/PendingButton";
import { pendingDigests } from "@/lib/digest";
import { runLoPullAction, sendLoEmailAction } from "./actions";

// "Run pull" can take a few minutes (feed, kits, then photos).
export const maxDuration = 300;

export default async function EditLoanOfficerPage({ params, searchParams }: PageProps<"/admin/loan-officers/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const msg = typeof sp.msg === "string" ? sp.msg : "";
  const lo = await loanOfficers.get(slug);
  if (!lo) notFound();
  const origin = await siteUrl();
  const build = buildPath(lo.slug);
  const buildUrl = build ? `${origin}${build}` : null;
  const pending = await pendingDigests(origin).catch(() => null);
  const ready = pending?.digests.filter((d) => d.lo.slug === slug).reduce((n, d) => n + d.kits.length, 0) ?? 0;
  const waiting = pending?.noPhotos.filter((k) => k.listing.loanOfficerSlug === slug).length ?? 0;
  return (
    <>
      {msg ? <div className="alert alert-success">{msg}</div> : null}
      <h1>{lo.name}</h1>
      <p className="muted small">
        API slug: <code>{lo.slug}</code> — use this as <code>loanOfficerSlug</code> when creating listings via the API.
      </p>
      {buildUrl ? (
        <div className="alert">
          <strong>Kit builder link.</strong> Send this private link to {lo.name}. They enter an MLS number and get a
          finished kit, co-branded with them.
          <div className="share-row">
            <code>{buildUrl}</code>
            <CopyButton text={buildUrl} label="Copy link" />
          </div>
        </div>
      ) : null}
      <div className="alert" id="manual-pull">
        <strong>Manual pull.</strong> Checks only {lo.name}&apos;s areas for new listings and homes that just passed 90
        days on market, and builds their kits (2 listings-feed requests per area). Nothing is emailed until you press
        Send email now; otherwise the kits go out in the next 7 AM email.
        <p className="small">
          Waiting to email: {ready} kit{ready === 1 ? "" : "s"} ready
          {waiting ? `, ${waiting} still waiting for photos (photos usually load within a few minutes)` : ""}.
        </p>
        <div className="share-row">
          <form action={runLoPullAction.bind(null, slug)}>
            <PendingButton pendingText="Pulling…" note="Takes 1 to 4 minutes; keep this tab open.">
              Run pull
            </PendingButton>
          </form>
          <form action={sendLoEmailAction.bind(null, slug)}>
            <PendingButton className="btn btn-small btn-ghost" pendingText="Sending…" disabled={!ready || !lo.email}>
              Send email now
            </PendingButton>
          </form>
        </div>
        {!lo.email ? <p className="small muted">Add an email address below to send kit emails.</p> : null}
      </div>
      <LoanOfficerForm slug={slug} initial={loanOfficerToValues(lo)} />
      <form action={deleteLoanOfficerAction.bind(null, slug)} className="danger-zone">
        <button className="btn btn-small btn-danger">Delete loan officer</button>
      </form>
    </>
  );
}
