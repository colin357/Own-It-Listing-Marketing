import type { Metadata } from "next";
import { OpenTextDraft } from "@/components/OpenTextDraft";
import { smsHref } from "@/lib/textLink";

export const metadata: Metadata = { title: "Text kit · Listing Kits", robots: { index: false, follow: false } };

/**
 * The "Text kit" button in LO emails links here instead of straight to sms:,
 * because Outlook on iPhone ignores sms: links in emails. This page (a normal
 * https link every mail app opens) hands off to Messages with the draft filled in.
 */
export default async function TextPage({ searchParams }: PageProps<"/text">) {
  const q = await searchParams;
  const to = typeof q.to === "string" ? q.to : "";
  const body = typeof q.body === "string" ? q.body : "";
  const number = to.replace(/[^\d+]/g, "").slice(0, 16);
  const message = body.slice(0, 2000);
  const d = number.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  const shown = d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : number;
  return (
    <main className="wrap text-page">
      <h1 className="display display-sm">Text the kit</h1>
      <OpenTextDraft href={smsHref(number, message)} to={shown} body={message} />
    </main>
  );
}
