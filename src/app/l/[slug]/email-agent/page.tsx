import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { firstName, streetLine } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { agentEmailAddress, agentEmailBody, agentEmailHtml, agentEmailSubject, agentEmailPagePath, mailtoHref } from "@/lib/agentEmail";
import { loadEmailKits } from "./load";
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
export default async function EmailAgentPage({ params, searchParams }: PageProps<"/l/[slug]/email-agent">) {
  const { slug } = await params;
  const kits = await loadEmailKits(slug, (await searchParams).with);
  if (!kits) notFound();
  const { listings: ls, lo } = kits;
  const l = ls[0];
  const origin = await siteUrl();
  const to = agentEmailAddress(ls);
  const subject = agentEmailSubject(ls);
  const html = agentEmailHtml(ls, lo, origin);
  const text = agentEmailBody(ls, lo, origin);
  const agent = firstName(l.agent.name) ?? "the agent";
  // An empty draft with To and Subject filled in, to paste the copied email into.
  const newEmail = mailtoHref(to, subject);
  const draftHref = agentEmailPagePath(ls).replace("/email-agent", "/email-agent/draft");

  return (
    <>
      <header className="nav">
        <div className="wrap nav-inner">
          <span className="wordmark">Listing kits</span>
          <span className="small muted">{lo.name}</span>
        </div>
      </header>
      <main className="wrap ea-main">
        <p className="eyebrow">{ls.length === 1 ? `${streetLine(l)}, ${l.city}` : ls.map(streetLine).join(" · ")}</p>
        <h1 className="display display-md">Email {ls.length === 1 ? "the kit" : `${ls.length === 2 ? "both" : `all ${ls.length}`} kits`} to {agent}</h1>
        <p className="lead muted ea-lead">
          Send it from your own email. Every link in it is a real link, so it&apos;s clickable wherever {agent} opens
          it: phone, computer, any mail app.
        </p>

        <section className="ea-options">
          <div className="ea-option">
            <h2 className="label">Phone, Gmail, Outlook on the web, Mac or any other app</h2>
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
          <div className="ea-option ea-desktop">
            <h2 className="label">Outlook on Windows</h2>
            <a className="pill pill-lg" href={draftHref}>Open as Outlook draft</a>
            <p className="small muted">
              Downloads the email. Open the file and it shows up as a new email in Outlook{to ? `, addressed to ${agent}` : ""}.
              Then hit Send.
            </p>
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
