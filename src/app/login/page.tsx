import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { LoginForm } from "./LoginForm";
import "../site.css";

export const metadata: Metadata = { title: "Sign in · Listing Kits" };

export default function LoginPage() {
  return (
    <div className="site">
      <SiteHeader />
      <main className="wrap acct">
        <h1 className="display display-md">Sign in</h1>
        <p className="lead muted acct-intro">No password needed. We&apos;ll email you a private link to your account.</p>
        <LoginForm />
        <p className="small muted acct-keep">
          New here? <Link href="/signup">Start a free trial</Link>.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
