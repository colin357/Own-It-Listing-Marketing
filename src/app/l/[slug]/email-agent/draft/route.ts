import { originFromRequest } from "@/lib/site";
import { agentEmailAddress, agentEmailBody, agentEmailHtml, agentEmailSubject } from "@/lib/agentEmail";
import { draftEml } from "@/lib/eml";
import { loadEmailKits } from "../load";

/** The kit email to the listing agent as an .eml draft with clickable links (Outlook for Windows). */
export async function GET(req: Request, ctx: RouteContext<"/l/[slug]/email-agent/draft">) {
  const { slug } = await ctx.params;
  const kits = await loadEmailKits(slug, new URL(req.url).searchParams.get("with"));
  if (!kits) return new Response("Not found", { status: 404 });
  const { listings, lo } = kits;
  const origin = originFromRequest(req);
  const eml = draftEml({
    to: agentEmailAddress(listings),
    subject: agentEmailSubject(listings),
    text: agentEmailBody(listings, lo, origin),
    html: agentEmailHtml(listings, lo, origin),
  });
  const name = listings.length === 1 ? listings[0].slug : `${listings[0].slug}-and-${listings.length - 1}-more`;
  return new Response(eml, {
    headers: {
      "Content-Type": "message/rfc822",
      "Content-Disposition": `attachment; filename="${name}-email-to-agent.eml"`,
      "Cache-Control": "private, no-store",
    },
  });
}
