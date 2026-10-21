"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // Older mobile browsers: fall back to a hidden textarea.
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
