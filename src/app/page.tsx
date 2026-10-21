import Link from "next/link";

export default function Home() {
  return (
    <main className="container landing">
      <h1>Listing Marketing Kits</h1>
      <p className="muted">
        Every listing gets a shareable page of co-branded social graphics, a print-ready flyer and copy-paste
        captions — generated automatically.
      </p>
      <p>
        <Link className="btn" href="/admin">
          Go to admin
        </Link>
      </p>
    </main>
  );
}
