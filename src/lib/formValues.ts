import type { Listing, LoanOfficer } from "./types";

const s = (v: unknown) => (v == null ? "" : String(v));

/** Flatten records into the string values the admin forms expect. */
export function listingToValues(l: Listing): Record<string, string> {
  return {
    loanOfficerSlug: l.loanOfficerSlug,
    status: l.status,
    address: l.address,
    unit: s(l.unit),
    city: l.city,
    state: l.state,
    zip: l.zip,
    price: s(l.price),
    beds: s(l.beds),
    baths: s(l.baths),
    sqft: s(l.sqft),
    lotSize: s(l.lotSize),
    yearBuilt: s(l.yearBuilt),
    listingUrl: s(l.listingUrl),
    description: s(l.description),
    highlights: l.highlights.join("\n"),
    photos: l.photos.join("\n"),
    openHouseDate: s(l.openHouse?.date),
    openHouseStart: s(l.openHouse?.startTime),
    openHouseEnd: s(l.openHouse?.endTime),
    agentName: l.agent.name,
    agentBrokerage: s(l.agent.brokerage),
    agentPhone: s(l.agent.phone),
    agentEmail: s(l.agent.email),
    agentLicense: s(l.agent.license),
    agentHeadshotUrl: s(l.agent.headshotUrl),
    rate: s(l.financing?.ratePct),
    apr: s(l.financing?.aprPct),
    fhaRate: s(l.financing?.fhaRatePct),
    fhaApr: s(l.financing?.fhaAprPct),
    annualTaxes: s(l.financing?.annualTaxes),
    annualInsurance: s(l.financing?.annualInsurance),
    hoaMonthly: s(l.financing?.hoaMonthly),
    showPayment: String(l.showPayment),
  };
}

export function loanOfficerToValues(lo: LoanOfficer): Record<string, string> {
  return {
    name: lo.name,
    title: s(lo.title),
    nmls: lo.nmls,
    company: lo.company,
    companyNmls: s(lo.companyNmls),
    phone: s(lo.phone),
    email: s(lo.email),
    applyUrl: s(lo.applyUrl),
    headshotUrl: s(lo.headshotUrl),
    logoUrl: s(lo.logoUrl),
    brandColor: s(lo.brandColor),
    accentColor: s(lo.accentColor),
    disclaimer: s(lo.disclaimer),
    paymentRatePct: s(lo.payment?.ratePct),
    paymentDownPct: s(lo.payment?.downPaymentPct),
    paymentTermYears: s(lo.payment?.termYears),
  };
}
