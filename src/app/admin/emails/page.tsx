import { pendingDigests } from "@/lib/digest";
import { mailConfigured } from "@/lib/mail";
import { siteUrl } from "@/lib/site";
import { sendNowAction, sendTestAction } from "./actions";
import { PendingButton } from "@/components/admin/PendingButton";

export const dynamic = "force-dynamic";

export default async function EmailsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const msg = typeof sp.msg === "string" ? sp.msg : "";
  const { digests, skipped, repeats } = await pendingDigests(await siteUrl());
  const ready = mailConfigured();
  const total = digests.reduce((n, d) => n + d.kits.length, 0);

  return (
    <>
      {msg ? <div className="alert alert-success">{msg}</div> : null}
      <div className="toolbar">
        <h1>LO emails</h1>
        <div className="filters">
          <form action={sendTestAction}>
            <PendingButton className="btn btn-small btn-ghost" disabled={!ready} pendingText="Sending test…">
              Send test to {ready ? process.env.MAIL_FROM : "me"}
            </PendingButton>
          </form>
          <form action={sendNowAction}>
            <PendingButton
              disabled={!ready || !digests.length}
              pendingText="Sending…"
              note="Emailing each loan officer. Usually under a minute; keep this tab open."
            >
              Send to all LOs now
            </PendingButton>
          </form>
        </div>
      </div>
      <p className="muted small">
        At 7 AM Eastern on any day with new kits (after the listing photos have loaded), every loan officer gets one email
        with the kits created for their agents since their last email. Sending from: <strong>{ready ? process.env.MAIL_FROM : "not set up yet"}</strong>.{" "}
        {digests.length
          ? `${total} kit${total === 1 ? "" : "s"} waiting for ${digests.length} loan officer${digests.length === 1 ? "" : "s"}.`
          : "Nothing waiting to send, so a test email uses the newest kits."}
      </p>
      {!ready ? (
        <div className="alert">
          <p>
            Email isn&apos;t set up on this deployment. Add MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET and MAIL_FROM in Vercel
            (Production), then redeploy.
          </p>
        </div>
      ) : null}
      {repeats.length ? (
        <p className="muted small">
          Left out as repeats (same home the loan officer already got under another address):{" "}
          {repeats.map((r) => `${r.listing.address}${r.listing.unit ? ` ${r.listing.unit}` : ""}, ${r.listing.city}`).join("; ")}.
        </p>
      ) : null}
      {skipped.length ? (
        <div className="alert">
          {skipped.map((s) => (
            <p key={s}>{s}</p>
          ))}
        </div>
      ) : null}
      {digests.map((d) => (
        <details key={d.lo.slug} className="digest">
          <summary>
            <strong>{d.lo.name}</strong> · {d.lo.email} · {d.subject}
          </summary>
          <iframe title={`Email to ${d.lo.name}`} srcDoc={d.html} style={{ width: "100%", height: 720, border: "1px solid var(--line)", background: "#fff" }} />
        </details>
      ))}
    </>
  );
}
