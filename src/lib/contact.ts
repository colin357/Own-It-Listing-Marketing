import type { Agent } from "./types";

/**
 * Who a buyer reaches from the buyer page's "Schedule a tour" button.
 *
 * MLS feeds often put the brokerage's main or toll-free number in the listing
 * agent's phone field, so a toll-free number (or one flagged as the office
 * line at detection) is treated as the office, not the agent's own phone.
 * Order: the agent's own phone, then the office line, then email.
 */

const TOLL_FREE = /^(800|833|844|855|866|877|888)$/;

export function phoneDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

export function isTollFree(phone: string): boolean {
  return TOLL_FREE.test(phoneDigits(phone).slice(0, 3));
}

/** True when the agent's phone looks like the brokerage line rather than their own. */
export function isOfficePhone(agent: Agent): boolean {
  return !!agent.phone && (!!agent.phoneIsOffice || isTollFree(agent.phone));
}

export interface TourContact {
  href: string;
  /** "cell": the agent's own phone; "office": the brokerage line; "email": no phone at all. */
  kind: "cell" | "office" | "email";
}

export function tourContact(agent: Agent, subject: string): TourContact | null {
  if (agent.phone) {
    return { href: `tel:${agent.phone.replace(/[^\d+]/g, "")}`, kind: isOfficePhone(agent) ? "office" : "cell" };
  }
  if (agent.email) return { href: `mailto:${agent.email}?subject=${encodeURIComponent(subject)}`, kind: "email" };
  return null;
}
