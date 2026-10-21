"use client";

import { useEffect, useState } from "react";

/**
 * Uses the native share sheet on phones so agents can send an image straight
 * to Instagram / Facebook without saving it first. Hidden where unsupported.
 */
export function ShareButton({ url, filename, text }: { url: string; filename: string; text?: string }) {
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const probe = new File([""], "x.png", { type: "image/png" });
    setSupported(typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }));
  }, []);

  if (!supported) return null;
  return (
    <button
      type="button"
      className="textlink"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const blob = await (await fetch(url)).blob();
          const file = new File([blob], filename, { type: blob.type });
          await navigator.share({ files: [file], text });
        } catch {
          // User cancelled the share sheet — nothing to do.
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Preparing…" : "Share"}
    </button>
  );
}
