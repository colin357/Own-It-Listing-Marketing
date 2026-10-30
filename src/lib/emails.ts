import type { Listing, LoanOfficer } from "./types";
import { formatOpenHouse, formatPrice, fullAddress, paymentInfo, statsLine, streetLine } from "./format";
import { programOptions } from "./mortgage";
import { activeConcession, concessionSentence } from "./concessions";

/**
 * Ready-to-send emails for the listing agent, written in the agent's voice.
 * Plain text so they paste cleanly into Gmail, Outlook or a CRM.
 */

export interface Email {
  id: string;
  label: string;
  /** Who it's for, shown on the kit page. */
  audience: string;
  subject: string;
  body: string;
}

const lines = (...parts: (string | null | undefined | false)[]) =>
  parts
    .filter((x): x is string => typeof x === "string")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

function signature(l: Listing): string {
  return lines("Best,", l.agent.name, [l.agent.brokerage, l.agent.phone, l.agent.email].filter(Boolean).join(" | "));
}

function loLine(lo: LoanOfficer): string {
  const reach = [lo.phone, lo.email].filter(Boolean).join(" or ");
  return `${lo.name} (NMLS #${lo.nmls}) with ${lo.company}${reach ? `, ${reach}` : ""}`;
}

function highlightList(l: Listing, max = 5): string | null {
  const h = l.highlights.slice(0, max);
  return h.length ? h.map((x) => `• ${x}`).join("\n") : null;
}

function factsLine(l: Listing): string {
  const stats = statsLine(l, " | ");
  return `${formatPrice(l.price)}${stats ? ` | ${stats}` : ""}`;
}

/** `url` is where buyers see the home: the buyer page, or the MLS / Zillow link. */
export function buildEmails(l: Listing, lo: LoanOfficer, url = l.listingUrl): Email[] {
  const street = streetLine(l);
  const sold = l.status === "just-sold";
  const pending = l.status === "under-contract";
  const active = !sold && !pending;
  const oh = formatOpenHouse(l);
  const pay = paymentInfo(l, lo);
  const programs = active ? programOptions(l, lo) : null;
  const link = url ? `See all the photos and details: ${url}` : null;
  const apply = lo.applyUrl ? `Get pre-approved online: ${lo.applyUrl}` : null;
  const c = activeConcession(l);
  const credit = c ? concessionSentence(c) : null;
  const emails: Email[] = [];

  // 1. Friends, family and past clients.
  emails.push({
    id: "sphere",
    label: sold ? "Just sold announcement" : "New listing announcement",
    audience: "Friends, family and past clients",
    subject: sold
      ? `Just sold: ${street}, ${l.city}`
      : pending
        ? `Under contract: ${street}, ${l.city}`
        : `${l.status === "coming-soon" ? "Coming soon" : l.status === "price-improved" ? "Price improved" : "Just listed"}: ${street}, ${l.city}`,
    body: lines(
      "Hi [First name],",
      "",
      sold
        ? `I'm excited to share that ${fullAddress(l)} is officially sold! Thank you to everyone who shared it and sent people my way.`
        : pending
          ? `Quick update: ${fullAddress(l)} is under contract. If you or someone you know was hoping for something like it, I'd love to help find the next one.`
          : `I just listed ${fullAddress(l)}, offered at ${formatPrice(l.price)}, and wanted you to be one of the first to know.`,
      "",
      factsLine(l),
      l.description && active ? `\n${l.description}` : null,
      active && highlightList(l) ? `\nA few highlights:\n${highlightList(l)}` : null,
      credit ? `\n${credit}` : null,
      active && oh ? `\nOpen house: ${oh}` : null,
      active && link ? `\n${link}` : null,
      "",
      active
        ? "If you know anyone who might be a fit, I'd be grateful if you passed this along. Referrals from people like you are the best compliment I can get."
        : "If you or anyone you know is thinking about buying or selling this year, I'd love to help. Just reply to this email.",
      "",
      signature(l),
    ),
  });

  // 2. The neighborhood: neighbors often know the next buyer, and wonder what their own home is worth.
  emails.push({
    id: "neighbors",
    label: sold ? "Just sold in your neighborhood" : "Neighbor letter",
    audience: "Homeowners near the listing",
    subject: sold ? `A home near you just sold: ${street}` : `A home in your neighborhood just hit the market`,
    body: lines(
      "Hi neighbor,",
      "",
      sold
        ? `I wanted to let you know that I just sold ${street} in your neighborhood. Homes nearby are getting real attention from buyers right now.`
        : `I wanted to give you a heads up that I just listed ${street} in your neighborhood, offered at ${formatPrice(l.price)}.`,
      "",
      factsLine(l),
      active && oh ? `\nYou're welcome to stop by the open house: ${oh}.` : null,
      "",
      active
        ? "Neighbors often know someone who'd love to live nearby, like a friend, family member or coworker. If someone comes to mind, I'd be grateful if you sent them my way."
        : null,
      "",
      "Curious what your own home might be worth in today's market? I'm happy to put together a free, no-pressure home value report. Just reply to this email.",
      "",
      signature(l),
    ),
  });

  if (active) {
    // 3. Other agents with buyers.
    emails.push({
      id: "agents",
      label: "Bring your buyers",
      audience: "Agents in your office and network",
      subject: `New listing: ${street}, ${l.city} | ${formatPrice(l.price)}`,
      body: lines(
        "Hi [First name],",
        "",
        `I have a new listing that might be right for one of your buyers: ${fullAddress(l)}.`,
        "",
        factsLine(l),
        l.lotSize ? `Lot: ${l.lotSize}` : null,
        l.yearBuilt ? `Built: ${l.yearBuilt}` : null,
        highlightList(l, 4) ? `\n${highlightList(l, 4)}` : null,
        credit ? `\n${credit}` : null,
        oh ? `\nOpen house: ${oh}` : null,
        link ? `\n${link}` : null,
        "",
        "Showings: [how to schedule, e.g. ShowingTime or call/text me]",
        "",
        `Buyers who still need a pre-approval can reach my lending partner ${loLine(lo)}. They can usually turn one around quickly so your offer is ready to go.`,
        "",
        "Happy to answer any questions.",
        "",
        signature(l),
      ),
    });

    // 4. Invite to the open house, or to a private showing when none is scheduled.
    emails.push(
      oh
        ? {
            id: "open-house",
            label: "Open house invite",
            audience: "Buyers, your sphere and neighbors",
            subject: `You're invited: open house at ${street}, ${oh}`,
            body: lines(
              "Hi [First name],",
              "",
              `I'm hosting an open house at ${fullAddress(l)} and I'd love for you to stop by.`,
              "",
              `When: ${oh}`,
              `Where: ${fullAddress(l)}`,
              "",
              factsLine(l),
              highlightList(l, 4) ? `\n${highlightList(l, 4)}` : null,
              credit ? `\n${credit}` : null,
              "",
              `My lending partner ${lo.name} can answer financing questions or run numbers for you. Feel free to bring friends, and reply to let me know you're coming.`,
              "",
              signature(l),
            ),
          }
        : {
            id: "showing",
            label: "Private showing invite",
            audience: "Buyers you're working with",
            subject: `Want a private tour of ${street}?`,
            body: lines(
              "Hi [First name],",
              "",
              `A home just came on the market that made me think of you: ${fullAddress(l)}, offered at ${formatPrice(l.price)}.`,
              "",
              factsLine(l),
              highlightList(l, 4) ? `\n${highlightList(l, 4)}` : null,
              credit ? `\n${credit}` : null,
              link ? `\n${link}` : null,
              "",
              "Want to see it in person? Reply with a couple of times that work and I'll set up a private showing.",
              "",
              signature(l),
            ),
          },
    );

    // 5. Financing spotlight, co-branded with the loan officer.
    if (programs || pay) {
      const rows = programs?.scenarios
        .filter((s) => s.id !== "conv-20")
        .map((s) => {
          const y1 = s.concession?.schedule[0];
          const year1 = y1 ? ` (${formatPrice(Math.round(y1.total))}/mo in year 1 with the ${s.concession!.type} buydown)` : "";
          return `• ${s.name} with ${s.detail}: about ${formatPrice(Math.round(s.total))}/mo*${year1}, ${formatPrice(Math.round(s.cashToClose))} est. cash to close`;
        });
      emails.push({
        id: "financing",
        label: "Financing spotlight",
        audience: "Buyers, especially first-time buyers",
        subject: `What it would take to own ${street}`,
        body: lines(
          "Hi [First name],",
          "",
          `If you've been wondering what it would actually cost to own ${street}, my lending partner ${lo.name} and I ran some numbers.`,
          "",
          `List price: ${formatPrice(l.price)}`,
          credit,
          rows?.length ? `\n${rows.join("\n")}` : pay ? `\nEstimated principal and interest: ${pay.label}` : null,
          "",
          "A lot of buyers are surprised to learn they don't need 20% down. The best first step is a quick pre-approval, so you know your budget before you fall in love with a home.",
          "",
          `Reach ${loLine(lo)}.`,
          apply,
          "",
          signature(l),
          "",
          programs ? `*${programs.disclaimer}` : pay ? pay.disclaimer : null,
          `${lo.name} NMLS #${lo.nmls} | ${lo.company}${lo.companyNmls ? ` NMLS #${lo.companyNmls}` : ""} | Equal Housing Opportunity`,
          lo.disclaimer,
        ),
      });
    }

    // 6. Reply to someone who asked about the listing.
    emails.push({
      id: "inquiry",
      label: "Reply to a buyer inquiry",
      audience: "Someone who asked about the home",
      subject: `Re: ${street}`,
      body: lines(
        "Hi [First name],",
        "",
        `Thanks for reaching out about ${fullAddress(l)}! Here are the details:`,
        "",
        factsLine(l),
        highlightList(l, 4) ? `\n${highlightList(l, 4)}` : null,
        credit ? `\n${credit}` : null,
        oh ? `\nOpen house: ${oh}` : null,
        link ? `\n${link}` : null,
        "",
        "I'd be happy to show it to you. What day and time works best this week?",
        "",
        `If you haven't been pre-approved yet, I'd recommend talking with my lending partner ${loLine(lo)}. It takes the guesswork out of your budget and makes any offer stronger.`,
        apply,
        "",
        signature(l),
      ),
    });
  }

  return emails;
}
