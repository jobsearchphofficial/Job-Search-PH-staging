// Builds the pages search engines index, from the live jobs:
//   /jobs/                          all open jobs (paginated)
//   /jobs/<title>-<city>-<id>/      one page per job, with JobPosting structured data (Google for Jobs)
//   /jobs/<category>/               category pages          /jobs/in/<place>/   location pages
//   /jobs/<category>/in/<place>/    only when there are enough jobs to be useful
//   /sitemap.xml and /robots.txt
// The app itself uses #/job/<id> links, which search engines treat as the home page, so these static
// pages give every job and every useful listing its own real URL.
//
// Run:   node scripts/build-job-pages.mjs
// Test:  node scripts/build-job-pages.mjs --fixture scripts/sample-jobs.json --out /tmp/site
// No dependencies. Reads only approved jobs, which are public under firestore.rules.
// Trust pages (About, FAQ, Terms...) are not built here: see scripts/build-static-pages.mjs.

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, TRUST_PAGES, catByName } from "./seo/config.mjs";
import { isLive, holdReason, jobPath, jobPage, legacyStub, safeId, validThrough } from "./seo/jobs.mjs";
import { buildListings } from "./seo/listings.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ---------- Load jobs ---------- */

async function readConfig() {
  const src = await readFile(join(ROOT, "assets/firebase-config.js"), "utf8");
  // The live project is the one the real site uses (the file also holds the test project's keys).
  const live = src.slice(src.indexOf("LIVE_CONFIG"));
  const pick = (k) => live.match(new RegExp(`${k}:\\s*"([^"]+)"`))?.[1];
  return { apiKey: pick("apiKey"), projectId: pick("projectId") };
}

// Firestore REST values → plain JS.
function fromValue(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return Date.parse(v.timestampValue);
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromValue);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromValue(x)]));
  return null;
}

async function fetchJobs() {
  const { apiKey, projectId } = await readConfig();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery?key=${apiKey}`;
  const body = { structuredQuery: { from: [{ collectionId: "jobs" }], where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "approved" } } }, limit: 1000 } };
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Firestore query failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows.filter((r) => r.document).map((r) => ({
    id: r.document.name.split("/").pop(),
    ...Object.fromEntries(Object.entries(r.document.fields || {}).map(([k, v]) => [k, fromValue(v)])),
  }));
}

// Fixture times like "-5h" or "720h" mean "hours from now", so test data never goes stale.
function fixtureJobs(raw, now) {
  const t = (v) => (typeof v === "string" && /^-?\d+h$/.test(v) ? now + parseInt(v, 10) * 3600000 : v);
  return raw.jobs.map((j) => ({ ...j, ...Object.fromEntries(["approvedAt", "createdAt", "updatedAt", "expiresAt"].filter((k) => k in j).map((k) => [k, t(j[k])])) }));
}

/* ---------- Sitemap and robots ---------- */

const day = (ms) => new Date(ms).toISOString().slice(0, 10);
function sitemap(entries) {
  const rows = entries.map(([path, lastmod]) => `  <url><loc>${SITE}${path}</loc>${lastmod ? `<lastmod>${day(lastmod)}</lastmod>` : ""}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;
}

const robots = () => `User-agent: *
Allow: /
Disallow: /__/
Disallow: /firestore.rules
Disallow: /storage.rules

Sitemap: ${SITE}/sitemap.xml
`;

/* ---------- Build ---------- */

export async function build({ jobs: input, out = ROOT, now = Date.now(), writeRobots = true, log = console.log } = {}) {
  const held = [];
  const jobs = input
    .filter((j) => safeId(j.id) && isLive(j, now))
    .filter((j) => { const why = holdReason(j); if (why) held.push(`${j.id} (${why})`); return !why; })
    .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.approvedAt || 0) - (a.approvedAt || 0));

  const files = new Map(); // path (ending in /) -> html
  const sitemapEntries = [["/", null]];
  for (const p of TRUST_PAGES) sitemapEntries.push([p.path, null]);

  for (const j of jobs) {
    const related = jobs.filter((x) => x.id !== j.id && x.category === j.category).sort((a, b) => (b.city === j.city) - (a.city === j.city)).slice(0, 3);
    files.set(jobPath(j), jobPage(j, related));
    files.set(`/jobs/${j.id}/`, legacyStub(j));
    sitemapEntries.push([jobPath(j), j.updatedAt || j.approvedAt || j.createdAt]);
  }
  const lastmodFor = (path, list) => list.length ? Math.max(...list.map((j) => j.updatedAt || j.approvedAt || j.createdAt || 0)) : null;
  for (const p of buildListings(jobs)) {
    files.set(p.path, p.html);
    if (p.indexable && !/\/page\/\d+\/$/.test(p.path)) sitemapEntries.push([p.path, p.path === "/jobs/" ? lastmodFor(p.path, jobs) : null]);
  }

  // Write everything only after it has all been built, so a failure never leaves a half-empty site.
  await rm(join(out, "jobs"), { recursive: true, force: true });
  for (const [path, html] of files) {
    await mkdir(join(out, path), { recursive: true });
    await writeFile(join(out, path, "index.html"), html);
  }
  await writeFile(join(out, "sitemap.xml"), sitemap(sitemapEntries));
  if (writeRobots) await writeFile(join(out, "robots.txt"), robots());

  log(`Built ${jobs.length} job page(s), ${files.size - jobs.length * 2} listing page(s), ${sitemapEntries.length} sitemap URL(s).`);
  if (held.length) log(`Held back from search engines (${held.length}): ${held.join("; ")}`);
  return { jobs, files, sitemapEntries, held };
}

async function main() {
  const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
  const now = Date.now();
  const fixture = arg("--fixture");
  const jobs = fixture ? fixtureJobs(JSON.parse(await readFile(fixture, "utf8")), now) : await fetchJobs();
  // Never overwrite the test site's "keep out of Google" robots.txt.
  const cname = existsSync(join(ROOT, "CNAME")) ? (await readFile(join(ROOT, "CNAME"), "utf8")).trim() : "";
  const out = arg("--out") || ROOT;
  const writeRobots = !process.argv.includes("--no-robots") && !(out === ROOT && /^staging\./.test(cname));
  await build({ jobs, out, now, writeRobots });
}

import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e); process.exit(1); });
