"use client";

import { useState } from "react";

/**
 * Copies formatted HTML (with working links) plus a plain-text fallback, so
 * pasting into Gmail, Outlook or Apple Mail keeps the links clickable.
 */
export function CopyRichButton({
  html,
  text,
  label = "Copy email",
  className = "pill pill-lg",
}: {
  html: string;
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              "text/html": new Blob([html], { type: "text/html" }),
              "text/plain": new Blob([text], { type: "text/plain" }),
            }),
          ]);
        } catch {
          // Older browsers: select a hidden copy of the formatted email and copy the selection.
          const div = document.createElement("div");
          div.innerHTML = html;
          div.style.position = "fixed";
          div.style.left = "-9999px";
          document.body.appendChild(div);
          const range = document.createRange();
          range.selectNodeContents(div);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
          document.execCommand("copy");
          sel?.removeAllRanges();
          div.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
