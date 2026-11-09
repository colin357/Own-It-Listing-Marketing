import { billingPortalUrl, createCheckout } from "@/lib/billing";
import { isActive } from "@/lib/plan";
import { validAccountToken } from "@/lib/loLinks";
import { originFromRequest } from "@/lib/site";
import { loanOfficers } from "@/lib/store";

/** Opens Stripe's billing page (card, invoices, cancel) and comes back to the account page. */
export async function GET(req: Request, ctx: RouteContext<"/account/[slug]/[token]/billing">) {
  const { slug, token } = await ctx.params;
  if (!validAccountToken(slug, token)) return new Response("Not found", { status: 404 });
  const lo = await loanOfficers.get(slug);
  if (!lo?.billing) return new Response("Not found", { status: 404 });
  const back = `${originFromRequest(req)}/account/${slug}/${token}`;
  try {
    // A canceled subscription can't be restarted in the portal, so start a new checkout for the same customer.
    if (!isActive(lo)) {
      const url = await createCheckout(
        { name: lo.name, email: lo.email ?? "", company: lo.company, nmls: lo.nmls },
        originFromRequest(req),
        lo.billing.customerId,
        `/account/${slug}/${token}`,
      );
      return Response.redirect(url, 303);
    }
    return Response.redirect(await billingPortalUrl(lo, back), 303);
  } catch (err) {
    console.error("Billing portal failed", err);
    return new Response("The billing page isn't available right now. Try again in a minute.", { status: 502 });
  }
}
