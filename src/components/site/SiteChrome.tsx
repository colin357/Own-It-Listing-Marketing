import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/plan";

export function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="site-nav">
      <div className="wrap site-nav-inner">
        <Link href="/" className="site-mark">
          Listing Kits
          <small>by Own It Social</small>
        </Link>
        <nav className="site-nav-links">
          {right ?? (
            <>
              <Link href="/login" className="site-navlink">
                Sign in
              </Link>
              <Link href="/signup" className="pill">
                Start free trial
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-top">
          <p className="foot-mark">
            <span>Own It</span>
            <span className="dim">Social</span>
          </p>
          <div className="foot-cols">
            <Link href="/signup">Start free trial</Link>
            <Link href="/login">Sign in</Link>
            <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
            <a href="https://ownitsocial.com" target="_blank" rel="noreferrer">
              ownitsocial.com
            </a>
          </div>
        </div>
        <div className="foot-legal">
          <p>© {new Date().getFullYear()} Own It Social. Listing Kits is marketing software for mortgage loan officers.</p>
        </div>
      </div>
    </footer>
  );
}
