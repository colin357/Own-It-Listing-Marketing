import Link from "next/link";
import type { Metadata } from "next";
import { storageMode } from "@/lib/store";

export const metadata: Metadata = { title: "Admin – Listing Marketing", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin">
      <header className="admin-header">
        <div className="container admin-header-inner">
          <Link href="/admin" className="admin-title">
            Own It <span>Listing Kits</span>
          </Link>
          <nav>
            <Link href="/admin">Listings</Link>
            <Link href="/admin/detections">New listings</Link>
            <Link href="/admin/loan-officers">Loan officers</Link>
            <Link href="/admin/roster">Roster</Link>
            <Link href="/admin/listings/new" className="btn btn-small">
              + New listing
            </Link>
          </nav>
        </div>
      </header>
      {storageMode === "files" ? (
        <div className="container">
          <div className="alert">
            Using local JSON files in <code>/data</code>. Connect Upstash Redis (Vercel → Storage → Marketplace) to
            save listings in production.
          </div>
        </div>
      ) : null}
      <main className="container admin-main">{children}</main>
    </div>
  );
}
