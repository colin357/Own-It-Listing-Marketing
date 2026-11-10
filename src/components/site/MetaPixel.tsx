"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

type Fbq = (...args: unknown[]) => void;
declare global {
  interface Window {
    fbq?: Fbq;
  }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
let lastPage: string | null = null;

/** Fires a Meta Pixel event if the pixel is on this page. */
export function trackMeta(event: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.fbq) window.fbq("track", event, params);
}

/**
 * Meta (Facebook/Instagram) Pixel for the sales site only: landing, signup, sign-in and account pages
 * (it lives in SiteHeader). Kit pages and buyer pages never load it. Off unless NEXT_PUBLIC_META_PIXEL_ID is set.
 */
export function MetaPixel() {
  const pathname = usePathname();
  useEffect(() => {
    if (!PIXEL_ID || lastPage === pathname) return;
    lastPage = pathname;
    // The loader may not have run yet; the fbq stub queues the call until it does.
    if (!window.fbq) setTimeout(() => trackMeta("PageView"), 0);
    else trackMeta("PageView");
  }, [pathname]);
  if (!PIXEL_ID) return null;
  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');`}
    </Script>
  );
}
