import { getMetros, getRoster } from "@/lib/detect/roster";
import { metrosCsv, rosterCsv } from "@/lib/detect/csv";

export const dynamic = "force-dynamic";

/** /admin/roster/roster.csv and /admin/roster/metros.csv: download what's saved now (behind admin auth). */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  let body: string;
  if (file === "roster.csv") body = rosterCsv(await getRoster());
  else if (file === "metros.csv") body = metrosCsv(await getMetros());
  else return new Response("Not found", { status: 404 });
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "no-store",
    },
  });
}
