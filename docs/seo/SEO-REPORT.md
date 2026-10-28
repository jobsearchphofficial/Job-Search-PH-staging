# Job Search PH: SEO audit and implementation report

Date: 2026-10-28 · Branch: `seo-overhaul` (not merged, not live) · Work done in the **staging** repo copy.

> **Status key:** DONE = built and tested here, **not yet live**. NEEDS YOU = needs account access or a decision. TODO = recommended, not built.
> Nothing in this report is a ranking promise. No search-volume or difficulty figures were available, so none are given.

## 1. What I found (audit)

Stack: plain HTML/CSS/JS single-page app on GitHub Pages, Firebase Auth + Firestore, hash routing (`#/job/<id>`). No build step. A script (`scripts/build-job-pages.mjs`, run every 2 h by a GitHub Action in the live repo) generates static job pages and `sitemap.xml`.

Live checks (fetched 2026-10-28): `robots.txt` allows everything and lists the sitemap; the sitemap had **3 URLs** (home, `/jobs/`, one job); `/jobs/` listed **1 job**; footer links to Terms/Privacy/Safety/Support were `#/` links.

| # | Problem | Why it matters | Fix | Priority | Status |
|---|---|---|---|---|---|
| 1 | Terms, Privacy, Safety/FAQ, Support exist only at `#/...` addresses | Google ignores everything after `#`; no trust pages could be indexed, and Facebook app review needs a real Privacy URL | Real pages `/terms/ /privacy/ /safety/ /faq/ /contact/ /about/ /how-it-works/ /employers/`. Text shared with the app via `assets/content.js` (output verified identical) | Critical | DONE |
| 2 | Sitemap only had home, `/jobs/` and one job; no category/location/info pages | Little for Google to discover | Generator now writes sitemap with every indexable page; excludes noindex, paginated, expired | Critical | DONE |
| 3 | `build-job-pages.mjs` read the **first** `apiKey`/`projectId` in `firebase-config.js`. In this copy that is the *test* project | If the live repo's file has the same order, the live job pages are built from test data | Now reads the `LIVE_CONFIG` block only | High | DONE. **Please confirm** the live repo's file order |
| 4 | Removed/expired jobs fall to `404.html`, which meta-refreshed everyone to the home page | Soft-redirect to home is exactly what Google says not to do | New 404: real 404 status, `noindex`, says "This job is no longer available" for `/jobs/...`, links to open jobs | High | DONE |
| 5 | Job URLs are opaque IDs (`/jobs/kkpkSM.../`) with no breadcrumbs, related jobs, category or city links | Weak relevance and internal linking | `/jobs/<title>-<city>-<id>/`, breadcrumbs (+BreadcrumbList), related jobs, category/city links. Old `/jobs/<id>/` URLs forward via canonical + refresh | High | DONE |
| 6 | No category or location pages for the main searches (kasambahay, yaya, Bacolod...) | These are the pages that can rank for the keyword plan | `/jobs/kasambahay/`, `/jobs/yaya/`, `/jobs/in/bacolod-city/`, `/jobs/in/negros-occidental/`, etc. with guidance text and empty states; thin pages stay `noindex` | High | DONE |
| 7 | Home H1 "Find work near you in Negros Occidental" had no Bacolod; generic title | Misses the main local term | Title "Jobs in Bacolod City & Negros Occidental", H1 "Find work in Bacolod and Negros Occidental", new description | Medium | DONE |
| 8 | Share image was a square logo; no Twitter card, `og:type`, `og:site_name` | Poor link previews on Facebook/Messenger, which is your main channel | 1200×630 `og-default.png` + full OG/Twitter tags on every page | Medium | DONE |
| 9 | No Organization / WebSite / BreadcrumbList schema | Brand and breadcrumb understanding | Added; only with real data (logo, Facebook page, support email). No ratings/reviews | Medium | DONE |
| 10 | JobPosting had no `validThrough` when `expiresAt` was missing; employer free text could contain phone/email | Google requires an end date for expiring jobs; privacy | `validThrough` always set (approval + 30 days if needed); phone numbers and emails redacted; households shown as "Private household in <city>" | Medium | DONE |
| 11 | Low-quality jobs could be indexed | Thin/scam pages hurt trust | A job gets a page only if live, not expired, has a title, city, 80+ char description and no scam wording (reuses `assets/safety.js`). Held jobs are logged | Medium | DONE |
| 12 | Only home and one job in the sitemap's lastmod; `robots.txt` did not block `/__/` (Firebase auth helper) | Minor crawl waste | Generator writes `robots.txt` with `Disallow: /__/` (keeps rules-file blocks and Sitemap line). Skipped automatically on the test site | Low | DONE |
| 13 | README mentions `scripts/sample-jobs.json`, which did not exist | Generator untestable | Added fixture (made-up data, never published) | Low | DONE |
| 14 | `app.js` is 289 KB unminified, `styles.css` 96 KB; Poppins from Google Fonts | May slow LCP on mobile | Not measured (no PageSpeed access). See next steps | Medium | TODO / NEEDS YOU to run PageSpeed |
| 15 | Home content is drawn by JavaScript | Google can render it, but other crawlers and link previews see an empty shell | Crawlable footer links + `<noscript>` on home; real pages for everything else. Full prerender not worth it yet | Low | PARTLY DONE |

**Not found / not applicable:** no paused-job state exists (only pending, approved, rejected, closed), so there is no paused indexing rule. Deleted jobs return a real 404 (no fake redirects).

## 2. Files

Created: `scripts/seo/{config,layout,jobs,listings,editorial,pages}.mjs`, `scripts/build-static-pages.mjs`, `scripts/seo-check.mjs`, `scripts/sample-jobs.json`, `assets/content.js`, `assets/img/og-default.png`, `.github/workflows/seo-check.yml`, `docs/seo/*`, and generated pages `about/ how-it-works/ employers/ safety/ faq/ contact/ terms/ privacy/`.
Modified: `scripts/build-job-pages.mjs` (rewritten), `assets/app.js` (static text moved to `content.js`; home title/H1), `assets/styles.css` (appended block), `index.html` (metadata, schema, footer, cache version), `404.html` (regenerated), `README.md`, cache-busting `?v=` numbers.

## 3. How indexing decisions work

* **Always indexed:** `/`, info pages, `/jobs/`, Bacolod City, Negros Occidental, Kasambahay, Yaya.
* **Indexed at 2+ live jobs:** other categories, other cities, category+city pages (`/jobs/kasambahay/in/bacolod-city/`). Below that they exist but are `noindex,follow` and not in the sitemap. Towns with no jobs have no page.
* **Pagination:** 20 jobs per page, self-canonical, `rel=prev/next`, not in the sitemap.
* **Job lifecycle:** approved + unexpired → page and JobPosting. Closed/expired/removed → page deleted on next build (2 h max), visitors get the "no longer available" 404. An inline script also shows a "This job has closed" notice and hides Apply if someone loads a cached page after `validThrough`.

## 4. JobPosting status

Generated from the job record, consistent with the visible page. Includes title, description, datePosted, validThrough, employmentType, hiringOrganization, jobLocation (city, region, PH; street address only for businesses), baseSalary when pay is given, identifier, url. `directApply` is `false` (applying needs sign-in). Checked by `scripts/seo-check.mjs` for required fields, future `validThrough`, valid salary units and URL match.
**Not yet validated in Google's Rich Results Test** (needs the live URL; NEEDS YOU, see section 6). Risks to watch: private-household jobs use "Private household in <city>" as the hiring organization; Google may flag or ignore anonymous employers. Verified employers could later show their real name if they agree.

## 5. Tests run

* `node scripts/seo-check.mjs`: **passes** (145 pages and 69 sitemap URLs from test data). It builds from test data and checks: titles/descriptions present and unique, one H1, canonicals, internal links, sitemap URLs exist and are indexable, JobPosting fields, expired/pending/scam/short jobs are not published, no phone/email/household name on job pages, pagination, thin pages noindex, robots.txt. Also fails if committed info pages are out of date. Negative test run: a stale page is caught.
* App smoke test in headless Chromium: `/#/terms` loads through the new `content.js` with no JS errors; Terms/Privacy/Safety output compared with the old inline text: identical.
* Visual check of job, listing, employers pages (desktop + mobile).
* **Not run:** Rich Results Test, PageSpeed/Lighthouse, Search Console (no access), real Firestore build (network blocked), GitHub Pages 404 behavior (verified only by reading the 404 file).

## 6. What needs you (the live repo wasn't attachable here)

1. **Apply the branch to the live repo** (`Job-Search-PH`) and test on staging first, as in your README. Staging deploy copies the new pages but keeps its `Disallow: /`.
2. In the live `job-pages.yml`, make sure the commit step adds `jobs/`, `sitemap.xml` **and `robots.txt`**. Also check the file-order issue in row 3.
3. Run `node scripts/build-job-pages.mjs` once on live (or wait for the Action) and open `/sitemap.xml`.
4. **Search Console:** the `google4bcab78e3e473e6d.html` verification file is present, so the property may already exist. In Search Console → Sitemaps, submit `https://jobsearchph.com/sitemap.xml`; use URL Inspection → Request indexing for `/`, `/jobs/in/bacolod-city/`, `/employers/`.
5. After deploy, test one job page at https://search.google.com/test/rich-results and run https://pagespeed.web.dev on `/` and a job page (mobile). Send me the results and I will fix what they show.
6. **Verify the wage claim:** the app's FAQ and safety text say household workers' minimum is ₱6,500/month in Negros Occidental (since Nov 19, 2025). I couldn't confirm that from independent sources (I found the RBVI-29 daily rates and a 2019 kasambahay order only). I left it in the app unchanged but **left it off the public `/faq/` and `/safety/` pages and wrote no wage figures in any new copy**.
7. Have a lawyer review Terms/Privacy (already in your README), now that they are public pages.
8. **GA4** (optional): needs a Measurement ID. It would also need a line in the Privacy policy. Your existing `?src=` tracking already counts sign-ups, posts and applications by source.

## 7. Limits

* Pages refresh every 2 hours, not instantly.
* Job pages need the Action to run on the live repo; nothing here runs against live data yet.
* The Facebook-heavy audience will mostly arrive through Facebook; these pages help Google and also make shared links preview properly.
* The `/jobs/` URL change means the one job indexed under the old ID URL forwards to the new one.
* Only one live job exists today, so most category and city pages will start `noindex`. That is intentional; they switch on automatically at 2 jobs. Growth in real listings is the biggest SEO lever.

## 8. Monitoring plan

Weekly (15 min), in Search Console: Pages (indexed vs not, and why), Performance (impressions, clicks, CTR, queries; filter to `/jobs/`), Sitemaps (discovered URLs vs submitted). Monthly: compare impressions for Bacolod/kasambahay/yaya queries; check Core Web Vitals report; run `node scripts/seo-check.mjs` before releases. In-app: Admin → Analytics → "Where users come from" for `?src=` sign-ups, posts and applications. Suggested conversion events if GA4 is added: `sign_up` (role), `post_job_submitted`, `apply_submitted`; send no names, phone numbers or emails.

## 9. 30-day growth plan

| Days | Task |
|---|---|
| 1-3 | Review and merge branch, test on staging, deploy live. Submit sitemap, request indexing for 5 key URLs. Verify wage claim. |
| 4-7 | Rich Results Test + PageSpeed; send me results. Fix anything flagged. Confirm Action commits `robots.txt`. |
| 8-14 | Get real supply: ask existing Facebook-group contacts and employers to post 10+ real jobs (this is what turns on category/city pages). Add `?src=` links to every Facebook post that point to `/jobs/in/bacolod-city/` or `/jobs/kasambahay/`. |
| 15-21 | Write and publish guides 1, 6 and 3 from `content-plan.md` after accuracy review (see plan). Add links from the guides to category pages. |
| 22-28 | Check Search Console: which pages are indexed, what queries show. Improve titles/descriptions of pages with impressions but low CTR. Add Google Business Profile for "Job Search PH, Bacolod" only if you have a legitimate business address (needs DTI/permits first). |
| 29-30 | Re-run PageSpeed; plan performance work (minify, split `app.js`) if mobile LCP is poor. Review what to do next. |
