"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { siteUrl } from "@/lib/site";
import { approveDetection, backfillPhotos, dismissDetection, runDetection } from "@/lib/detect/run";
import { parseCsv, parseMetros, parseRoster, saveMetros, saveRoster } from "@/lib/detect/roster";
import { ValidationError } from "@/lib/validate";

export async function runNowAction(fd: FormData) {
  const dryRun = fd.get("dryRun") === "1";
  let msg: string;
  try {
    const { run } = await runDetection({ dryRun, origin: await siteUrl() });
    msg = `${dryRun ? "Test run" : "Run"} done: ${run.listingsScanned} listings scanned, ${run.matches} new matches, ${run.created} kits created${run.photosQueued ? `, photos still loading in the background for ${run.photosQueued}` : ""}${run.errors.length ? `, ${run.errors.length} errors` : ""}.${dryRun ? "" : " Loan officer emails go out at the next 7 AM (Mon/Thu), or send them now from Emails."}`;
  } catch (err) {
    msg = `Run failed: ${(err as Error).message}`;
  }
  revalidatePath("/admin/detections");
  redirect(`/admin/detections?msg=${encodeURIComponent(msg)}`);
}

/** Zillow photo lookup for every kit that has none. Uses no RentCast requests. */
export async function fetchPhotosAction() {
  let msg: string;
  try {
    const r = await backfillPhotos();
    msg = !r.missing
      ? "Every kit already has photos."
      : `Checked Zillow for kits without photos and added photos to ${r.added} of ${r.missing}. ` +
        (r.queued
          ? `The other ${r.queued} keep loading in the background (every 5 minutes); kits Zillow doesn't show yet are retried for a week.`
          : "All done.") +
        (r.errors.length ? ` ${r.errors.join(" ")}` : "");
  } catch (err) {
    msg = `Photo lookup failed: ${(err as Error).message}`;
  }
  revalidatePath("/admin/detections");
  redirect(`/admin/detections?msg=${encodeURIComponent(msg)}`);
}

export async function approveAction(slug: string, fd: FormData) {
  const lo = typeof fd.get("lo") === "string" && fd.get("lo") ? String(fd.get("lo")) : undefined;
  let msg: string;
  try {
    const det = await approveDetection(slug, await siteUrl(), lo);
    msg = `Kit created for ${det.listing.address}.`;
  } catch (err) {
    msg = `Couldn't create the kit: ${(err as Error).message}`;
  }
  revalidatePath("/admin/detections");
  redirect(`/admin/detections?msg=${encodeURIComponent(msg)}`);
}

export async function dismissAction(slug: string) {
  await dismissDetection(slug);
  revalidatePath("/admin/detections");
}

export interface RosterState {
  ok?: string;
  issues?: string[];
}

export async function uploadRosterAction(_prev: RosterState, fd: FormData): Promise<RosterState> {
  const done: string[] = [];
  try {
    for (const type of ["agents", "metros"] as const) {
      const file = fd.get(type);
      if (!(file instanceof File) || !file.size) continue;
      const rows = parseCsv(await file.text());
      if (type === "agents") {
        const agents = parseRoster(rows);
        await saveRoster(agents);
        done.push(`${agents.length} agents`);
      } else {
        const metros = parseMetros(rows);
        await saveMetros(metros);
        done.push(`${metros.length} metros`);
      }
    }
  } catch (err) {
    return { issues: err instanceof ValidationError ? err.issues : [(err as Error).message] };
  }
  if (!done.length) return { issues: ["Choose a roster CSV, a metros CSV, or both."] };
  revalidatePath("/admin/roster");
  return { ok: `Saved ${done.join(" and ")}.` };
}
