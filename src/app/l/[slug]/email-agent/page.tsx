import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getKit } from "@/lib/listings";
import { firstName, streetLine } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { agentEmailAddress, agentEmailBody, agentEmailHtml, agentEmailSubject } from "@/lib/digest";
import { CopyRichButton } from "@/components/CopyRichButton";
import { CopyButton } from "@/components/CopyButton";
import "./email-agent.css";

export const metadata: Metadata = { title: "Email the kit to the agent", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * For loan officers on a computer. The "Email kit" button in their email is a
 * plain-text mailto: draft, and desktop Outlook doesn't make the links in it
 * clickable for the agent. This page gives the same email with real links, as
 * an Outlook draft file or as formatted text to paste into any mail app.
 */
export default async function EmailAgentPage({ params }: PageProps<"/l/[slug]/email-agent">) {
  const { slug } = await params;
  const kit = await getKit(slug);
  if (!kit) notFound();
  const { listing: l, lo } = kit;
  const origin = await siteUrl();
  const to = agentEmailAddress(l);
  const subject = agentEmailSubject(l);
  const html = agentEmailHtml(l, lo, origin);
  const text = agentEmailBody(l, lo, origin);
  const agent = firstName(l.agent.name) ?? "the agent";
  const newEmail = `mailto:${to ? encodeURIComponent(to).replace(/%40/g, "@") : ""}?subject=${encodeURIComponent(subject)}`;

  return (
    <>
      <header className="nav">
        <div className="wrap nav-inner">
          <span className="wordmark">Listing kits</span>
          <span className="small muted">{lo.name}</span>
        </div>
      </header>
      <main className="wrap ea-main">
        <p className="eyebrow">{streetLine(l)}, {l.city}</p>
        <h1 className="display display-md">Email the kit to {agent}</h1>
        <p className="lead muted ea-lead">
          This version keeps the links clickable when {agent} opens it on a computer. Pick the way that matches your
          mail app.
        </p>

        <section className="ea-options">
          <div className="ea-option">
            <h2 className="label">Outlook on Windows</h2>
            <a className="pill pill-lg" href={`/l/${l.slug}/email-agent/draft`}>Open as Outlook draft</a>
            <p className="small muted">
              Downloads the email. Open the file and it shows up as a new email in Outlook{to ? `, addressed to ${agent}` : ""}.
              Then hit Send.
            </p>
          </div>
          <div className="ea-option">
            <h2 className="label">Gmail, Outlook on the web, Mac or any other app</h2>
            <ol className="ea-steps">
              <li>
                <CopyRichButton html={html} text={text} className="pill pill-lg" />
              </li>
              <li>
                <a className="pill pill-lg pill-ghost" href={newEmail}>Start a new email</a>
              </li>
              <li className="small muted">Paste into the body and hit Send.</li>
            </ol>
          </div>
        </section>

        <section className="ea-preview">
          <dl className="ea-head">
            <dt className="label">To</dt>
            <dd>{to ?? <span className="muted">We don&apos;t have {agent}&apos;s email address. Add it in the To line.</span>}</dd>
            <dt className="label">Subject</dt>
            <dd className="ea-subject">
              {subject} <CopyButton text={subject} label="Copy" />
            </dd>
          </dl>
          <div className="ea-body" dangerouslySetInnerHTML={{ __html: html }} />
        </section>
      </main>
    </>
  );
}
