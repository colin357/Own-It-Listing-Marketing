import { pendingDigests } from "@/lib/digest";
import { mailConfigured } from "@/lib/mail";
import { siteUrl } from "@/lib/site";
import { sendNowAction, sendTestAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function EmailsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const msg = typeof sp.msg === "string" ? sp.msg : "";
  const { digests, skipped } = await pendingDigests(await siteUrl());
  const ready = mailConfigured();
  const total = digests.reduce((n, d) => n + d.kits.length, 0);

  return (
    <>
      {msg ? <div className="alert alert-success">{msg}</div> : null}
      <div className="toolbar">
        <h1>LO emails</h1>
        <div className="filters">
          <form action={sendTestAction}>
            <button className="btn btn-small btn-ghost" disabled={!ready || !digests.length}>
              Send test to {ready ? process.env.MAIL_FROM : "me"}
            </button>
          </form>
          <form action={sendNowAction}>
            <button className="btn btn-small" disabled={!ready || !digests.length}>
              Send to all LOs now
            </button>
          </form>
        </div>
      </div>
      <p className="muted small">
        After each Monday and Thursday run, every loan officer gets one email with the kits created for their agents since
        their last email. Sending from: <strong>{ready ? process.env.MAIL_FROM : "not set up yet"}</strong>.{" "}
        {digests.length
          ? `${total} kit${total === 1 ? "" : "s"} waiting for ${digests.length} loan officer${digests.length === 1 ? "" : "s"}.`
          : "Nothing waiting to send."}
      </p>
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
