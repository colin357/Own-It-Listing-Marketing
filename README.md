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
| Captions | — | Instagram, Facebook, LinkedIn, text message, email-to-sphere |
| Download all | .zip | Everything above plus `captions.txt` |

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

Response (201) includes `url` (the link to send the agent), `downloadUrl`, `flyerPdfUrl` and direct
`assets.*` image URLs — so a Zap can create the kit and then text/email the link in the next step.

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

Listing slugs are derived from the address and never change once created, so links you've sent stay valid.

## Project layout

```
src/app/l/[slug]/            Agent-facing kit page, image/PDF routes, ZIP download
src/app/admin/               Admin UI (basic auth via src/proxy.ts) + Blob upload token route
src/app/api/                 Bearer-token JSON API
src/lib/render/templates.tsx All graphic templates — edit here to change designs
src/lib/captions.ts          Caption copy
src/lib/store.ts             Upstash Redis / local JSON storage
src/lib/validate.ts          Input normalization for API + forms
assets/fonts/                Montserrat + Playfair Display (OFL) used in graphics
data/                        Demo data used when no database is configured
```

## Compliance note

Templates include NMLS numbers and Equal Housing Opportunity on every asset, and payment estimates
carry a disclaimer. Have your compliance team review the templates and the payment disclaimer
(`src/lib/format.ts`) before going live; LOs can add state-specific text in their profile.
