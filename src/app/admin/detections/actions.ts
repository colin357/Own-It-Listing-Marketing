"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { siteUrl } from "@/lib/site";
import { approveDetection, dismissDetection, runDetection } from "@/lib/detect/run";
import { parseCsv, parseMetros, parseRoster, saveMetros, saveRoster } from "@/lib/detect/roster";
import { ValidationError } from "@/lib/validate";

export async function runNowAction(fd: FormData) {
  const dryRun = fd.get("dryRun") === "1";
  let msg: string;
  try {
    const { run } = await runDetection({ dryRun, origin: await siteUrl() });
    msg = `${dryRun ? "Test run" : "Run"} done: ${run.listingsScanned} listings scanned, ${run.matches} new matches, ${run.created} kits created${run.errors.length ? `, ${run.errors.length} errors` : ""}.`;
  } catch (err) {
    msg = `Run failed: ${(err as Error).message}`;
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
