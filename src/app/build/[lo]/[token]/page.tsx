import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listings, loanOfficers } from "@/lib/store";
import { accountPath, validLoToken } from "@/lib/loLinks";
import { isActive } from "@/lib/plan";
import { photoSource } from "@/lib/detect/providers";
import { formatPrice, streetLine } from "@/lib/format";
import { BuildForm } from "./BuildForm";
import "./build.css";

export const metadata: Metadata = { title: "Build a listing kit", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
// Building a kit waits for the listing photos.
export const maxDuration = 300;

export default async function BuildPage({ params }: PageProps<"/build/[lo]/[token]">) {
  const { lo: slug, token } = await params;
  if (!validLoToken(slug, token)) notFound();
  const [lo, all] = await Promise.all([loanOfficers.get(slug), listings.list()]);
  if (!lo) notFound();
  if (!isActive(lo)) return <Inactive slug={slug} />;
  const recent = all.filter((l) => l.loanOfficerSlug === lo.slug).slice(0, 12);

  return (
    <>
      <header className="nav">
        <div className="wrap nav-inner">
          <span className="wordmark">Listing kits</span>
          <span className="small muted">{lo.name}</span>
        </div>
      </header>
      <main className="wrap build-main">
        <p className="eyebrow">Hi {lo.name.split(/\s+/)[0]}</p>
        <h1 className="display display-md">Build a listing kit</h1>
        <p className="lead muted build-lead">
          Enter the address of any active listing. We pull the home details and photos and build the full kit
          (social posts, flyers, captions and emails) co-branded with you, ready to send to the agent.
        </p>
        <BuildForm slug={slug} token={token} photos={!!photoSource()} />

        {recent.length ? (
          <section className="build-recent">
            <h2 className="label">Your recent kits</h2>
            <ul>
              {recent.map((l) => (
                <li key={l.slug}>
                  <Link href={`/l/${l.slug}`}>
                    <strong>{streetLine(l)}</strong>, {l.city}
                  </Link>
                  <span className="muted small">
                    {formatPrice(l.price)} · {l.agent.name}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </>
  );
}

function Inactive({ slug }: { slug: string }) {
  const account = accountPath(slug);
  return (
    <main className="wrap build-main">
      <h1 className="display display-md">Your subscription isn&apos;t active</h1>
      <p className="lead muted build-lead">
        Restart your Listing Kits subscription to build kits again. Kits you already made still work.
      </p>
      {account ? (
        <Link className="pill pill-lg" href={account}>
          Go to my account
        </Link>
      ) : null}
    </main>
  );
}
