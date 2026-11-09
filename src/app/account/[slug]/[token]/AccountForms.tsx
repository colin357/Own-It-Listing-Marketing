"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { upload, uploadPresigned } from "@vercel/blob/client";
import { saveImageAction, saveProfileAction, type AccountFormState } from "./actions";

function Issues({ state }: { state: AccountFormState }) {
  if (state.issues?.length)
    return (
      <div className="site-alert" role="alert">
        {state.issues.map((i) => (
          <p key={i}>{i}</p>
        ))}
      </div>
    );
  return null;
}

function Input({
  label,
  name,
  values,
  hint,
  ...rest
}: { label: string; name: string; values: Record<string, string>; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="site-field">
      <span>{label}</span>
      <input name={name} defaultValue={values[name] ?? ""} {...rest} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function ProfileForm({ slug, token, initial }: { slug: string; token: string; initial: Record<string, string> }) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(saveProfileAction.bind(null, slug, token), {});
  const v = state.values ?? initial;
  return (
    <form action={action} className="site-form" key={state.values ? JSON.stringify(state.values) : "initial"}>
      <Issues state={state} />
      <div className="site-grid">
        <Input label="Full name" name="name" values={v} required autoComplete="name" />
        <Input label="Title" name="title" values={v} placeholder="Senior Loan Officer" />
        <Input label="Your NMLS #" name="nmls" values={v} required inputMode="numeric" />
        <Input label="Company" name="company" values={v} required />
        <Input label="Company NMLS #" name="companyNmls" values={v} inputMode="numeric" />
        <Input label="Mobile phone" name="phone" values={v} type="tel" autoComplete="tel" />
        <Input label="Email" name="email" values={v} type="email" required hint="Where we send your new kits." />
        <Input
          label="Pre-approval link"
          name="applyUrl"
          values={v}
          type="url"
          placeholder="https://"
          hint="The flyer's QR code opens this."
        />
        <Input label="Brand color" name="brandColor" values={v} placeholder="#0a0a0a" hint="Optional. A hex color for your graphics." />
      </div>
      <label className="site-field">
        <span>Extra disclaimer</span>
        <textarea name="disclaimer" rows={3} defaultValue={v.disclaimer ?? ""} />
        <small>Optional. Added to every graphic, for example a state license line.</small>
      </label>
      <div className="site-form-actions">
        <button className="pill" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </button>
        {state.saved ? <span className="small">Saved.</span> : null}
      </div>
    </form>
  );
}

/** Headshots become an 800px square JPEG; logos keep their own shape and transparency. */
async function prepare(file: File, square: boolean): Promise<{ body: Blob; type: string; ext: string }> {
  const bitmap = await createImageBitmap(file);
  const max = square ? 800 : 1200;
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  if (square) {
    const out = Math.min(max, side);
    canvas.width = canvas.height = out;
    canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) * 0.2, side, side, 0, 0, out, out);
  } else {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }
  const type = square ? "image/jpeg" : "image/png";
  const body = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read that image"))), type, 0.88),
  );
  return { body, type, ext: square ? "jpg" : "png" };
}

export function ImageUpload({
  slug,
  token,
  mode,
  field,
  label,
  current,
  hint,
}: {
  slug: string;
  token: string;
  mode: "token" | "presigned" | null;
  field: "headshotUrl" | "logoUrl";
  label: string;
  current?: string;
  hint: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const busy = !!status && !status.startsWith("Upload failed");
  const square = field === "headshotUrl";

  const onFile = async (file: File | undefined) => {
    if (!file || !mode) return;
    try {
      setStatus("Uploading…");
      const { body, type, ext } = await prepare(file, square);
      const blob = await (mode === "token" ? upload : uploadPresigned)(`lo/${slug}/${square ? "headshot" : "logo"}.${ext}`, body, {
        access: "public",
        handleUploadUrl: `/account/${slug}/${token}/upload`,
        contentType: type,
      });
      const res = await saveImageAction(slug, token, field, blob.url);
      if (res.error) throw new Error(res.error);
      router.refresh();
      setStatus(null);
    } catch (err) {
      setStatus(`Upload failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="site-upload">
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current} alt="" className={square ? "site-upload-round" : "site-upload-logo"} />
      ) : (
        <span className={`site-upload-empty ${square ? "site-upload-round" : "site-upload-logo"}`} aria-hidden="true" />
      )}
      <div>
        <p className="site-label">{label}</p>
        <p className="small muted">{hint}</p>
        {mode ? (
          <label className={`pill pill-ghost${busy ? " is-busy" : ""}`}>
            {current ? "Change" : "Upload"}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={busy}
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        ) : (
          <p className="small muted">Uploads aren&apos;t available yet.</p>
        )}
        {status ? <p className="small">{status}</p> : null}
      </div>
    </div>
  );
}
