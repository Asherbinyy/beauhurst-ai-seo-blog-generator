# Setup, imports and operating limits

## Local toolbox

Use Node 24.22.2 and npm. Copy `.env.example` to `.env`, add `NUXT_GEMINI_API_KEY`, then run `npm run dev`. The default model remains configurable through `NUXT_GEMINI_MODEL`. Free-tier availability depends on the owner's project; no paid billing is required by this application.

`npm run build && npm start` runs the Node production application. `.env` is loaded by `npm start`. Saved articles live in `.data/articles` by default; preserve that directory to retain their URLs. `NUXT_ARTICLE_DATA_DIR` overrides it. Set `NUXT_PUBLIC_SITE_URL` to the public HTTP(S) origin when canonical URLs are appropriate.

Generation sends a bounded sample of source descriptions/industry labels and computed facts to the configured provider. Use data you are permitted to send under its applicable terms. The product interface stays provider-neutral; configuration and data handling are documented here. Review prose before publication.

## CSV import behavior

The importer accepts predictable variations in company datasets without inferring unavailable business facts.

| Field | Accepted header examples | Missing or incomplete values |
| --- | --- | --- |
| Company | Company, Company Name, Name, Business Name | A usable name is required to identify the record |
| Total Raised | Total Raised, Funding, Total Funding, Funding Raised, Total Fundraising | Blank/N/A/unknown/— stays null; never becomes £0 |
| Rank | Rank, Ranking, Position | Missing, duplicate or inconsistent ranks are recalculated |
| Region | Region, Location | Shown as — |
| Stage | Stage, Funding Stage | Shown as — |
| Employees | Employees, Employee Count, Headcount | Kept as source text/bands, or — |
| Description | Description, Company Description | Omitted when missing |
| Website | Website, URL, Company Website | Missing scheme becomes HTTPS; unusable links omitted and noted |
| Industries | Industries, Industry, Sector, Sectors | Semicolon-separated values; otherwise — |

Headers ignore case, spaces, underscores and hyphens in recognised names. Comma, semicolon and tab delimiters are detected. UTF-8/BOM, quoted fields, embedded newlines, reordered/additional columns and missing trailing cells are supported. Ambiguous duplicate recognised columns and non-empty extra cells without headers are rejected rather than guessed.

Funding accepts non-negative GBP values such as `£1,234`, `1234.50`, `GBP 1234` or `1234 GBP`. Present but malformed/ambiguous amounts and mixed currencies produce errors. No currency conversion or suffix guessing is performed. Monetary arithmetic uses integer pence.

With valid source ranks, those ranks are preserved. Otherwise records are ordered by recorded funding, unknown amounts last, with source order breaking ties. Import adjustments and funding coverage appear in the report's source notes. Every record is retained; invalid essential data is never silently dropped.

The 1 MiB / 1,000-record limits are application resource limits, not requirements asserted by the brief. Missing funding is excluded from total, median and concentration calculations. With no recorded funding, those statistics remain unavailable. A recorded zero is known and included.

## Report controls

Every heading sorts ascending/descending; missing values stay last. Original ranks remain unchanged. Employee bands use natural text ordering without estimating headcount. Search matches company names, descriptions and industries; region filtering combines with it.

CSV download includes the current visible selection in its current order, with source descriptions even in compact view. Cells that could execute spreadsheet formulas are neutralised for export. PDF includes all records even when filtered. PNG is a summary with exact figures, source and funding coverage.

## Public demo

`npm run build:pages` prerenders the home page and a prepared report using the same Nuxt components. GitHub Pages deploys only `.output-showcase/public`; the private API/server and credentials are not hosted there. The sample is derived from the supplied public dataset, with explicitly prepared copy. Local generation remains the workflow demonstrated against a new dataset.

The Pages workflow publishes the main branch. Production, browser tests and Pages use separate generated directories. The public example lives in `showcase/`; private `.data` records are never copied wholesale into a release.

## Verification and media

- `npm run check`: formatting, lint, types, unit/integration, production build and desktop/mobile browser tests.
- `npm run screenshots`: separate mocked build, desktop/mobile screenshots, recorded walkthrough, MP4/GIF/captions and the explicit public example. Requires Playwright Chromium and ffmpeg.
- `npm run build:pages`: prerendered report demo, with base-path support.

Automated generation uses fakes/mocks. Confirm the real provider with the supplied 100-company CSV: £622,301,270 total, £4,146,786 median, 78 London companies and 33.0% top-ten funding share. Then upload the four-company sample: £6,000,000 total and £1,500,000 median. Refresh/restart to verify saved links.

## Known limits

Local JSON storage is appropriate for this private toolbox. A public generation service would need access controls, request/quota limits and hosted durable storage. The hosted demo does not accept uploads.

The dependency audit still has 40 transitive findings (38 moderate, two low; no high/critical at the last check). No forced downgrade has been applied. The verification suite covers 93 unit/integration tests and 30 desktop/mobile browser tests. Automated accessibility scans and mobile emulation are useful checks, not complete cross-browser or WCAG certification. PDF support and pagination depend on the browser.
