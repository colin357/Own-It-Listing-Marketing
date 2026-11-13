"use client";

import { useEffect } from "react";
import { CopyButton } from "./CopyButton";

/**
 * Opens the text draft as soon as the page loads, with a big button for when
 * the browser wants a tap first, and the message to copy if neither works
 * (for example inside a mail app's built-in browser that can't open Messages).
 */
export function OpenTextDraft({ href, to, body }: { href: string; to: string; body: string }) {
  useEffect(() => {
    window.location.href = href;
  }, [href]);

  return (
    <div className="text-draft">
      <a className="btn text-draft-open" href={href}>
        Open text message
      </a>
      <p className="muted text-draft-hint">
        Nothing happened? Tap the button above. If you&apos;re reading this inside Outlook or another mail app, open this page in Safari
        (the share or ••• menu), or copy the message below and paste it into a text.
      </p>
      <div className="text-draft-box">
        {to && (
          <p className="text-draft-to">
            <span className="muted">To:</span> <strong>{to}</strong> <CopyButton text={to} label="Copy number" />
          </p>
        )}
        <p className="text-draft-body">{body}</p>
        <CopyButton text={body} label="Copy message" className="btn" />
      </div>
    </div>
  );
}
