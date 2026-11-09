import { getKit } from "@/lib/listings";
import { originFromRequest } from "@/lib/site";
import { agentEmailAddress, agentEmailBody, agentEmailHtml, agentEmailSubject } from "@/lib/digest";
import { draftEml } from "@/lib/eml";

/** The kit email to the listing agent as an .eml draft with clickable links (Outlook for Windows). */
export async function GET(req: Request, ctx: RouteContext<"/l/[slug]/email-agent/draft">) {
  const { slug } = await ctx.params;
  const kit = await getKit(slug);
  if (!kit) return new Response("Not found", { status: 404 });
  const { listing, lo } = kit;
  const origin = originFromRequest(req);
  const eml = draftEml({
    to: agentEmailAddress(listing),
    subject: agentEmailSubject(listing),
    text: agentEmailBody(listing, lo, origin),
    html: agentEmailHtml(listing, lo, origin),
  });
  return new Response(eml, {
    headers: {
      "Content-Type": "message/rfc822",
      "Content-Disposition": `attachment; filename="${listing.slug}-email-to-agent.eml"`,
      "Cache-Control": "private, no-store",
    },
  });
}
