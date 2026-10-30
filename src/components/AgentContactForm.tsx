"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAgentContactAction } from "@/app/l/[slug]/actions";

/** Kit page: lets the agent point the buyer page's tour button at their own cell and email. */
export function AgentContactForm({ slug, summary, needsCell }: { slug: string; summary: string; needsCell: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(needsCell);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="tour-contact">
      <p className="muted">
        {summary}{" "}
        {!open ? (
          <button type="button" className="textlink" onClick={() => setOpen(true)}>
            Change
          </button>
        ) : null}
      </p>
      {open ? (
        <form
          className="tour-form"
          onSubmit={(ev) => {
            ev.preventDefault();
            setStatus(null);
            startTransition(async () => {
              const res = await saveAgentContactAction(slug, phone, email);
              if (res.error) return setStatus(res.error);
              setStatus("Saved. Tour calls now come to you.");
              setPhone("");
              setEmail("");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <input type="tel" inputMode="tel" placeholder="Your cell" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Your cell" />
          <input type="email" placeholder="Your email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Your email" />
          <button type="submit" className="pill" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      ) : null}
      {status ? <p className="small">{status}</p> : null}
    </div>
  );
}
