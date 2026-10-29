# Own It — Listing Marketing Kits

Automatically generates a co-branded marketing kit for every listing a Loan Officer's referral
partner (agent) takes. The LO sends the agent **one link**; the agent gets ready-to-post graphics,
a print-ready flyer and copy-paste captions.

```
https://your-domain.com/l/123-maple-ridge-dr-austin-tx
```

## What each listing page includes

| Asset | Size | Use |
| --- | --- | --- |
| Square post | 1080×1080 | Instagram / Facebook feed |
| Feature post | 1080×1350 | Instagram 4:5 with photo collage + highlights |
| Story | 1080×1920 | IG / FB Stories, Reels cover |
| Landscape | 1200×630 | Facebook / LinkedIn / link previews (also the page's OG image) |
| Flyer | 8.5×11 PNG + PDF | Print, with QR codes to the listing and LO's pre-approval link |
| Payment options flyer | 8.5×11 PNG + PDF | Three PITI scenarios: Conventional 5% down, Conventional 20% down, FHA 3.5% down (needs a rate) |
| Captions | — | Instagram, Facebook, LinkedIn, text message, email-to-sphere |
| Download all | .zip | Everything above plus `captions.txt` |

The kit page and admin use the Own It Social design language from ownitsocial.com: Archivo Black
display type, Montserrat body copy, ink/paper/purple (`#0A0A0A` / `#F4F3F1` / `#8B3DFF`). The
generated graphics use the same type in a neutral black/white/stone palette so they suit any
brand. A loan officer's brand/accent colors replace the defaults when set, and text colors flip
automatically to stay readable.

Every asset is co-branded (agent + LO headshots), uses the LO's brand colors, and carries the
compliance line (LO NMLS, company NMLS, Equal Housing Opportunity, optional custom disclaimer).
If the LO has payment settings, an **estimated P&I payment** with disclaimer is shown (hidden
for Under Contract / Just Sold, and can be turned off per listing).

Graphics adapt to the listing **status**: Coming Soon, Just Listed, Open House, Price Improved,
Under Contract, Just Sold. Change the status (UI or API) and every asset + caption updates.

Images are generated on demand (Next.js `ImageResponse` + `sharp`) and cached at Vercel's CDN, so
there's nothing to pre-build — hundreds of listings cost nothing until someone opens them. Edits bust
the cache automatically.

## Deploy to Vercel

1. Import this repo in Vercel (framework auto-detected as Next.js).
2. **Storage → Marketplace → Upstash Redis** → connect to the project. This stores listings and
   loan officers (`KV_REST_API_URL` / `KV_REST_API_TOKEN` are injected automatically).
3. **Storage → Blob** → create a store and connect it (enables photo uploads in the admin).
4. **Settings → Environment Variables**: set `ADMIN_PASSWORD` and `API_KEY`
   (optionally `NEXT_PUBLIC_SITE_URL` once you add a custom domain).
5. Redeploy. Go to `/admin`, add your loan officers, and start creating listings.

> Without Redis the app reads the demo JSON in `/data` (read-only on Vercel) — handy for previewing.

## Local development

```bash
npm install
cp .env.example .env.local   # optional; admin is open in dev without ADMIN_PASSWORD
npm run dev
```

Open http://localhost:3000/l/123-maple-ridge-dr-austin-tx for the demo kit and
http://localhost:3000/admin for the admin. Locally, records are stored as JSON in `/data`.

## Creating listings

### 1. Admin UI — `/admin`
Fill out the form (photos can be uploaded or pasted as URLs). On save you get the share link with a
**Copy link** button to text/email to the agent.

### 2. Automation API (Zapier, Make, CRM webhooks, scripts)

All API calls need `Authorization: Bearer $API_KEY`.

```bash
curl -X POST https://your-domain.com/api/listings \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "loanOfficerSlug": "jordan-avery",
    "status": "just-listed",
    "address": "123 Maple Ridge Dr",
    "city": "Austin", "state": "TX", "zip": "78704",
    "price": 685000, "beds": 4, "baths": 3, "sqft": 2450,
    "description": "Light-filled modern home…",
    "highlights": ["Chef'"'"'s kitchen", "Primary suite with spa bath"],
    "photos": ["https://…/front.jpg", "https://…/kitchen.jpg"],
    "listingUrl": "https://…",
    "openHouse": { "date": "2026-10-25", "startTime": "1:00 PM", "endTime": "4:00 PM" },
    "agent": { "name": "Taylor Morgan", "phone": "(512) 555-0199", "email": "taylor@example.com",
               "brokerage": "Hill Country Realty", "headshotUrl": "https://…" }
  }'
```

#### Financing fields (payment options flyer)

Send the rate with the listing to unlock the payment-options flyer and the "Est. $X/mo" teaser:

| Field | Aliases | |
| --- | --- | --- |
| `rate` | `ratePct`, `interestRate` | Conventional note rate, e.g. `6.375` (required for payments) |
| `apr` | `aprPct` | Conventional APR. **Send this** — Reg Z requires APR when ads state a rate or payment |
| `fhaRate` | `fhaRatePct` | FHA note rate (defaults to `rate`) |
| `fhaApr` | `fhaAprPct` | FHA APR |
| `annualTaxes` | `taxes` | Actual annual property taxes (from MLS). Otherwise estimated by state |
| `annualInsurance` | `insurance` | Annual homeowners insurance. Otherwise estimated by state |
| `hoaMonthly` | `hoa` | Added to every scenario |

Scenarios are 30-year fixed. Conventional 5% down includes estimated PMI; FHA includes the 1.75%
upfront MIP financed into the loan plus annual MIP. All assumptions (state tax/insurance tables,
PMI and MIP rates) live in `src/lib/mortgage.ts`. If a listing has no rate, the loan officer's
default rate is used; with neither, the payment flyer is simply omitted.

Response (201) includes `url` (the link to send the agent), `downloadUrl`, `pdfs.*` (flyer PDFs) and
direct `assets.*` image URLs — so a Zap can create the kit and then text/email the link in the next step.

The API is forgiving so no-code tools are easy to map: prices like `"$685,000"`, flat agent fields
(`agentName`, `agentPhone`, `agentEmail`, `agentBrokerage`, `agentHeadshotUrl`), flat open-house fields
(`openHouseDate`, `openHouseStart`, `openHouseEnd`), `bedrooms`/`bathrooms`, and newline/comma
separated `photos`. Statuses like `"Sold"`, `"Pending"`, `"Price Reduced"` are normalized.

| Method | Path | |
| --- | --- | --- |
| `POST` | `/api/listings` | Create one listing, or send an array to bulk-import (207 on partial failure) |
| `GET` | `/api/listings?loanOfficer=slug` | List listings |
| `GET` / `PUT` / `PATCH` / `DELETE` | `/api/listings/:slug` | `PATCH {"status":"just-sold"}` to flip a kit to Sold |
| `POST` / `GET` | `/api/loan-officers` | Create / list loan officers |
| `GET` / `PUT` / `DELETE` | `/api/loan-officers/:slug` | |
| `GET` / `POST` | `/api/roster?type=agents\|metros` | Read or replace the roster / metros (CSV or JSON body) |
| `GET` | `/api/detections?status=review` | Detected listings and the last run |
| `GET` | `/api/cron/detect?dryRun=1&days=7` | Run detection now (also `Authorization: Bearer $CRON_SECRET`) |

Listing slugs are derived from the address and never change once created, so links you've sent stay valid.

## New-listing detection

Every morning (`vercel.json` cron, 12:00 UTC) the app looks for new listings by the agents in your
roster and builds their kits automatically, so the loan officer has a finished link the day an agent lists.

1. **Upload the roster** at `/admin/roster`: the agent roster CSV (`full_name`, `brokerage`, `notes` with
   `LO: Name`, …) and the metros CSV (`name`, `city`, `state`, `latitude`, `longitude`, `radius_miles`).
   Or `POST /api/roster?type=agents|metros` with the CSV as the body.
2. **Add each loan officer** under Loan officers, with the same name as in the roster. Matches for a
   loan officer who isn't set up yet wait under "Waiting on LO" and become kits on the next run after
   they're added.
3. **Set the environment variables**: `RENTCAST_API_KEY` (listings feed), `APIFY_TOKEN` (photos) and
   `CRON_SECRET`.

How a run works:

- For each metro, RentCast returns active listings from the last 7 days within the radius (overlapping
  metros are de-duplicated). Each listing has the listing agent's name, email, phone and brokerage.
- The listing agent is matched against the roster by name (nicknames like Will/William count), and
  only against agents whose loan officer works that area. A matching brokerage raises confidence and a
  different one lowers it.
- **90%+ matches become kits automatically.** Lower-confidence matches, and names that match agents
  of two different loan officers, wait under **Admin → New listings** for a person to click
  "Create kit" or "Not a match".
- **Photos and description** are scraped from the public Zillow listing (Apify actor
  `maxcopell~zillow-detail-scraper`, looked up by address), only for matched listings. Zillow can lag
  the MLS by a day, so kits without photos are retried for a week. Until then the kit page asks the
  agent to upload their own photos (needs the Blob store), which then fill every graphic.
- Kits get the status Just Listed, the agent's contact info from the feed, and the loan officer's
  default rate for payments (no per-listing rate is known).
- With `DETECTION_WEBHOOK_URL` set, each new kit is POSTed there (`event: "kit.created"`, `kitUrl`,
  `needsPhotos`, `agent`, `loanOfficer`) so a Zap can text or email the link.

Run it manually from **Admin → New listings** ("Test run" matches without saving anything) or with
`GET /api/cron/detect?dryRun=1` (API key). `GET /api/detections?status=review` lists the queue.

Expect roughly 25 to 60 RentCast requests a day for 21 metros (one per 500 listings per metro), and one
Apify actor run per day for the matched homes.

> Scraped photos come from Zillow's public pages, which is against Zillow's terms of use, and listing
> photos are owned by the photographer or brokerage. The photo source is pluggable
> (`src/lib/detect/providers`) so it can be swapped for a licensed MLS feed later.

## Project layout

```
src/app/l/[slug]/            Agent-facing kit page, image/PDF routes, ZIP download
src/app/admin/               Admin UI (basic auth via src/proxy.ts) + Blob upload token route
src/app/api/                 Bearer-token JSON API
src/lib/render/templates.tsx All graphic templates — edit here to change designs
src/lib/captions.ts          Caption copy
src/lib/mortgage.ts          PITI scenarios + state tax/insurance estimates
src/lib/store.ts             Upstash Redis / local JSON storage
src/lib/validate.ts          Input normalization for API + forms
src/lib/detect/              New-listing detection: roster, matching, RentCast feed, Zillow photos
assets/fonts/                Archivo + Montserrat (OFL), used by both the pages and the graphics
data/                        Demo data used when no database is configured
```

## Compliance note

Templates include NMLS numbers and Equal Housing Opportunity on every asset, and payment estimates
carry a disclaimer. Have your compliance team review the templates and the payment disclaimer
(`src/lib/format.ts`) before going live; LOs can add state-specific text in their profile.
