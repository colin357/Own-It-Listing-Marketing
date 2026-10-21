import Link from "next/link";

export default function Home() {
  return (
    <main className="container landing">
      <h1 className="display">Listing kits,<br />on autopilot.</h1>
      <p className="lead muted">
        Every listing gets a shareable page of co-branded social graphics, a print-ready flyer and copy-paste
        captions — generated automatically.
      </p>
      <p>
        <Link className="pill pill-lg" href="/admin">
          Go to admin
        </Link>
      </p>
    </main>
  );
}
