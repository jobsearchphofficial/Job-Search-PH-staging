// SEO regression check. Builds the site from test data (no network) and fails if anything breaks:
// missing or duplicate titles/descriptions, wrong H1 count, missing or wrong canonicals, broken internal
// links, bad sitemap URLs, invalid JobPosting data, expired/pending/risky jobs published, phone numbers
// or household names leaking, noindex pages in the sitemap, committed info pages out of date.
//
// Run:  node scripts/seo-check.mjs        (no dependencies, takes about a second)
import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./build-job-pages.mjs";
import { writeTrustPages } from "./build-static-pages.mjs";
import { SITE, TRUST_PAGES } from "./seo/config.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const fail = (where, msg) => failures.push(`${where}: ${msg}`);

// ---- test data: the fixture plus enough extra jobs to force pagination ----
const now = Date.now();
const raw = JSON.parse(await readFile(join(ROOT, "scripts/sample-jobs.json"), "utf8"));
const t = (v) => (typeof v === "string" && /^-?\d+h$/.test(v) ? now + parseInt(v, 10) * 3600000 : v);
const jobs = raw.jobs.map((j) => ({ ...j, ...Object.fromEntries(["approvedAt", "expiresAt"].filter((k) => k in j).map((k) => [k, t(j[k])])) }));
for (let i = 0; i < 45; i++) jobs.push({ id: `bulk${String(i).padStart(3, "0")}`, status: "approved", approvedAt: now - i * 3600000, expiresAt: now + 500 * 3600000, title: `Cook helper ${i}`, category: "Cook", city: "Bacolod City", workplace: "business", employerName: "Bulk Test", employmentType: "Stay-out", schedule: "Full-time", salaryMin: 400 + i, salaryPeriod: "day", description: "Helps the cook prepare ingredients, keeps the kitchen clean and serves customers during lunch hours." });

const out = await mkdtemp(join(tmpdir(), "seo-check-"));
try {
  const { files, sitemapEntries } = await build({ jobs, out, now, log: () => {} });

  // committed info pages must match their source
  const stale = await writeTrustPages(ROOT, { check: true });
  for (const p of stale) fail(p, "committed page is out of date; run node scripts/build-static-pages.mjs");

  // collect every HTML page: built pages + committed pages + 404
  const pages = new Map(); // url path -> html
  for (const [p, html] of files) pages.set(p, html);
  for (const p of TRUST_PAGES) {
    const f = p.path.endsWith(".html") ? join(ROOT, p.path) : join(ROOT, p.path, "index.html");
    if (existsSync(f)) pages.set(p.path, await readFile(f, "utf8")); else fail(p.path, "page file is missing");
  }
  pages.set("/", await readFile(join(ROOT, "index.html"), "utf8"));

  const exists = (path) => pages.has(path) || pages.has(path.endsWith("/") ? path : path + "/") || existsSync(join(ROOT, path.split("?")[0].split("#")[0])) && !path.endsWith("/");
  const get = (html, re) => html.match(re)?.[1];
  const titles = new Map(), descs = new Map(), indexable = new Set();

  for (const [path, html] of pages) {
    if (/http-equiv="refresh"/.test(html)) { indexable.delete(path); continue; } // legacy /jobs/<id>/ forwarding stubs
    const robots = get(html, /<meta name="robots" content="([^"]*)"/) || "index";
    const noindex = /noindex/.test(robots);
    if (!noindex) indexable.add(path);
    const title = get(html, /<title>([^<]*)<\/title>/);
    const desc = get(html, /<meta name="description" content="([^"]*)"/);
    if (!title) fail(path, "missing <title>");
    if (!desc) fail(path, "missing meta description");
    if (!noindex && title) { if (titles.has(title)) fail(path, `duplicate title with ${titles.get(title)}`); titles.set(title, path); }
    if (!noindex && desc) { if (descs.has(desc)) fail(path, `duplicate description with ${descs.get(desc)}`); descs.set(desc, path); }
    if (title && title.replace(/&[a-z#0-9]+;/g, "x").length > 75) fail(path, `title is long (${title.length} chars)`);

    const h1s = (html.match(/<h1[\s>]/g) || []).length;
    if (path !== "/" && h1s !== 1) fail(path, `expected 1 <h1>, found ${h1s}`); // home's H1 is drawn by the app

    const canonical = get(html, /<link rel="canonical" href="([^"]*)"/);
    if (!noindex) {
      const want = path === "/404.html" ? null : `${SITE}${path}`;
      if (!canonical) fail(path, "missing canonical");
      else if (canonical !== want && !/\/page\/\d+\/$/.test(path)) fail(path, `canonical ${canonical} should be ${want}`);
      else if (canonical !== want) fail(path, `paginated page canonical ${canonical} should point to itself`);
    }

    // structured data
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch { fail(path, "JSON-LD is not valid JSON"); return null; } }).filter(Boolean);
    const postings = ld.filter((x) => x["@type"] === "JobPosting");
    const isJobPage = /^\/jobs\/[^/]+-[A-Za-z0-9_-]{8,}\/$/.test(path) && !/\/in\//.test(path) && postings.length > 0;
    if (!isJobPage && postings.length) fail(path, "JobPosting on a page that is not a job page");
    for (const jp of postings) {
      for (const k of ["title", "description", "datePosted", "validThrough", "hiringOrganization", "jobLocation", "employmentType"]) if (!jp[k]) fail(path, `JobPosting missing ${k}`);
      if (jp.validThrough && Date.parse(jp.validThrough) <= now) fail(path, "JobPosting validThrough is in the past");
      if (jp.hiringOrganization && !jp.hiringOrganization.name) fail(path, "JobPosting hiringOrganization has no name");
      if (jp.jobLocation?.address?.addressCountry !== "PH") fail(path, "JobPosting location is not PH");
      if (jp.baseSalary && (jp.baseSalary.currency !== "PHP" || !["HOUR", "DAY", "WEEK", "MONTH", "YEAR"].includes(jp.baseSalary.value?.unitText))) fail(path, "JobPosting salary is invalid");
      if (jp.url !== `${SITE}${path}`) fail(path, "JobPosting url does not match the page");
    }

    // internal links
    for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
      const href = m[1];
      if (href.startsWith("/#") || href.startsWith("//")) continue;
      const clean = href.split("#")[0].split("?")[0];
      if (!clean || /^\/(assets|favicon)/.test(clean)) { if (clean && !existsSync(join(ROOT, clean))) fail(path, `missing file ${clean}`); continue; }
      if (!pages.has(clean) && !pages.has(clean.endsWith("/") ? clean : clean + "/")) fail(path, `broken internal link ${href}`);
    }

    // privacy and content leaks on every public page except the legal text and the support contact box
    if (/^\/jobs\//.test(path)) {
      const text = html.replace(/jobsearchph\.official@gmail\.com/g, "");
      if (/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(text)) fail(path, "email address on a public job page");
      if (/(?:\+?63|\b0)\s?9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/.test(text)) fail(path, "phone number on a public job page");
      for (const secret of ["Test Family (never shown)", "Fixture Household", "Another Fixture", "Fixture Family", "Fixture Town", "09171234567"]) if (text.includes(secret)) fail(path, `household/private detail "${secret}" is public`);
      for (const bad of ["fixOldd0006", "fixScam0007", "fixShrt0008", "fixPend0011", "Expired cook job", "Pending job not public"]) if (text.includes(bad)) fail(path, `ineligible job (${bad}) is published`);
    }
  }

  // sitemap
  const seen = new Set();
  for (const [p] of sitemapEntries) {
    if (seen.has(p)) fail("sitemap", `duplicate URL ${p}`);
    seen.add(p);
    if (!pages.has(p)) fail("sitemap", `URL has no page: ${p}`);
    else if (!indexable.has(p)) fail("sitemap", `noindex page in sitemap: ${p}`);
    if (/\/page\/\d+\/$/.test(p)) fail("sitemap", `paginated page in sitemap: ${p}`);
  }
  for (const p of indexable) if (p !== "/404.html" && !/\/page\/\d+\/$/.test(p) && !/^\/jobs\/[A-Za-z0-9_-]+\/$/.test(p) && !seen.has(p) && !p.startsWith("/jobs/fix") ) fail("sitemap", `indexable page missing from sitemap: ${p}`);

  // legacy /jobs/<id>/ stubs forward and are not in the sitemap
  for (const j of ["fixYaya0001AAAAAAAA"]) {
    const stub = pages.get(`/jobs/${j}/`);
    if (!stub || !/http-equiv="refresh"/.test(stub)) fail(`/jobs/${j}/`, "legacy URL does not forward to the new address");
  }

  // pagination: 46 Cook-or-other jobs in Bacolod means /jobs/ must have several pages
  for (const p of ["/jobs/page/2/", "/jobs/page/3/"]) if (!pages.has(p)) fail(p, "pagination page missing");
  if (!/rel="next"/.test(pages.get("/jobs/") || "")) fail("/jobs/", "no rel=next link");

  // thin pages stay out of the index; core pages stay in
  if (indexable.has("/jobs/in/talisay-city/")) fail("/jobs/in/talisay-city/", "thin page (1 job) should be noindex");
  for (const p of ["/jobs/in/bacolod-city/", "/jobs/in/negros-occidental/", "/jobs/kasambahay/", "/jobs/yaya/"]) if (!indexable.has(p)) fail(p, "core page must be indexable");

  // robots.txt
  const robots = await readFile(join(out, "robots.txt"), "utf8");
  if (/^Disallow:\s*\/\s*$/m.test(robots)) fail("robots.txt", "blocks the whole site");
  if (!robots.includes(`Sitemap: ${SITE}/sitemap.xml`)) fail("robots.txt", "no Sitemap line");
  if (/Disallow:\s*\/assets/.test(robots)) fail("robots.txt", "blocks CSS/JS needed for rendering");

  // staging must stay hidden
  if (existsSync(join(ROOT, "CNAME")) && /^staging\./.test((await readFile(join(ROOT, "CNAME"), "utf8")).trim()) && !/^Disallow:\s*\/\s*$/m.test(await readFile(join(ROOT, "robots.txt"), "utf8"))) fail("robots.txt", "test site is not hidden from Google");

  console.log(`Checked ${pages.size} pages and ${sitemapEntries.length} sitemap URLs.`);
} finally {
  await rm(out, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\nSEO check FAILED (${failures.length}):\n- ` + failures.join("\n- "));
  process.exit(1);
}
console.log("SEO check passed.");
