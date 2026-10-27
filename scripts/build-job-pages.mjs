// Builds one static page per live job at /jobs/<id>/ so Google can index it,
// with JobPosting structured data for Google for Jobs. Also rewrites sitemap.xml.
//
// The app itself uses #/job/<id> links, which search engines treat as the home page.
// These static pages give every job its own real URL.
//
// Run:   node scripts/build-job-pages.mjs
// Test:  node scripts/build-job-pages.mjs --fixture scripts/sample-jobs.json
// No dependencies. Reads only approved jobs, which are public under firestore.rules.

import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://jobsearchph.com";
const JOBS_DIR = join(ROOT, "jobs");

/* ---------- Load jobs ---------- */

async function readConfig() {
  const src = await readFile(join(ROOT, "assets/firebase-config.js"), "utf8");
  const pick = (k) => src.match(new RegExp(`${k}:\\s*"([^"]+)"`))?.[1];
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

/* ---------- Helpers ---------- */

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const peso = (n) => "₱" + Number(n).toLocaleString("en-PH");
const PERIODS = { month: "/ month", day: "/ day", hour: "/ hour" };
const UNIT = { month: "MONTH", day: "DAY", hour: "HOUR" };
const iso = (ms) => new Date(ms).toISOString();
const isLive = (j, now) => j.status === "approved" && (!j.expiresAt || j.expiresAt > now);
const safeId = (id) => /^[A-Za-z0-9_-]{1,64}$/.test(id);
const lines = (s) => String(s || "").split("\n").map((r) => r.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

function salaryText(j) {
  if (!j.salaryMin && !j.salaryMax) return "Salary negotiable";
  const per = PERIODS[j.salaryPeriod] || "";
  if (j.salaryMin && j.salaryMax && j.salaryMax !== j.salaryMin) return `${peso(j.salaryMin)}–${peso(j.salaryMax)} ${per}`;
  return `${peso(j.salaryMin || j.salaryMax)} ${per}`;
}

function employmentTypes(j) {
  const s = j.schedule || j.employmentType || "";
  if (s === "Part-time") return ["PART_TIME"];
  if (s === "Project-based") return ["CONTRACTOR"];
  return ["FULL_TIME"];
}

function conditions(j) {
  const rows = [];
  rows.push(["Arrangement", j.employmentType]);
  if (j.workplace === "household" && j.schedule) rows.push(["Schedule", j.schedule]);
  if (j.workplace) rows.push(["Workplace", j.workplace === "household" ? "Private household" : "Business"]);
  if (j.hours) rows.push(["Working hours", j.hours]);
  if (j.daysOff != null && j.daysOff !== "") rows.push(["Days off", `${j.daysOff} day${Number(j.daysOff) === 1 ? "" : "s"} per ${j.daysOffPer === "month" ? "month" : "week"}`]);
  if (j.openings > 1) rows.push(["Openings", `${j.openings} people`]);
  if (j.startDate) rows.push(["Start date", new Date(j.startDate + "T00:00:00").toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })]);
  return rows.filter(([, v]) => v);
}

function requirements(j) {
  const out = [];
  const exp = Number(j.reqExperience || 0);
  if (exp > 0) out.push(`${exp}+ year${exp === 1 ? "" : "s"} of experience`);
  if (j.reqEducation && j.reqEducation !== "Any") out.push(j.reqEducation);
  return out.concat(j.reqList || [], lines(j.requirements));
}

/* ---------- Privacy ---------- */
// Private households often enter a family name. Public, indexed pages never show it:
// households appear as "Private household in <city>". Businesses keep their name and street address.
const isHousehold = (j) => j.workplace === "household";
const publicName = (j) => (isHousehold(j) ? `Private household in ${j.city || "Negros Occidental"}` : j.employerName || "Private employer");
const publicCategory = (j) => (j.category === "Other" && j.categoryOther ? j.categoryOther : j.category);

/* ---------- Structured data ---------- */

function jobPosting(j) {
  // Google renders this description, so it carries the full post.
  const desc = [
    `<p>${esc(j.description).replace(/\n/g, "<br>")}</p>`,
    conditions(j).length ? `<p><strong>Work conditions</strong></p><ul>${conditions(j).map(([k, v]) => `<li>${esc(k)}: ${esc(v)}</li>`).join("")}</ul>` : "",
    (j.benefits || []).length ? `<p><strong>Benefits</strong></p><ul>${j.benefits.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "",
    requirements(j).length ? `<p><strong>Requirements</strong></p><ul>${requirements(j).map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : "",
  ].join("");

  const address = {
    "@type": "PostalAddress",
    addressLocality: j.city,
    addressRegion: "Negros Occidental",
    addressCountry: "PH",
  };
  const street = isHousehold(j) ? "" : [j.address, j.area].filter(Boolean).join(", ");
  if (street) address.streetAddress = street;

  const data = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: j.title,
    description: desc,
    identifier: { "@type": "PropertyValue", name: "Job Search PH", value: j.id },
    datePosted: iso(j.approvedAt || j.createdAt || Date.now()),
    employmentType: employmentTypes(j),
    hiringOrganization: { "@type": "Organization", name: publicName(j) },
    jobLocation: { "@type": "Place", address },
    directApply: false,
    url: `${SITE}/jobs/${j.id}/`,
  };
  if (j.expiresAt) data.validThrough = iso(j.expiresAt);
  if (j.category) data.occupationalCategory = publicCategory(j);
  if (j.openings > 1) data.totalJobOpenings = j.openings;
  if (j.salaryMin || j.salaryMax) {
    const value = { "@type": "QuantitativeValue", unitText: UNIT[j.salaryPeriod] || "MONTH" };
    if (j.salaryMin && j.salaryMax && j.salaryMax !== j.salaryMin) Object.assign(value, { minValue: j.salaryMin, maxValue: j.salaryMax });
    else value.value = j.salaryMin || j.salaryMax;
    data.baseSalary = { "@type": "MonetaryAmount", currency: "PHP", value };
  }
  // Escape "<" so text can't close the script tag.
  return JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
}

/* ---------- HTML ---------- */

const ASSET_V = "1793025560";

function shell({ title, description, canonical, body, head = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#3d4fd6">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${SITE}/assets/img/logo-512.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script>try{var t=localStorage.getItem("jsph-theme")||"light";if(t!=="system")document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="light";}</script>
  <link rel="stylesheet" href="/assets/styles.css?v=${ASSET_V}">
  <link rel="icon" href="/favicon.ico?v=${ASSET_V}" sizes="any">
  <link rel="apple-touch-icon" href="/assets/img/icon-circle-192.png?v=${ASSET_V}">
${head}
</head>
<body>
  <header class="site-header">
    <div class="wrap header-inner">
      <a href="/" class="brand" aria-label="Job Search PH home">
        <img class="brand-mark" src="/assets/img/icon-circle-64.png?v=${ASSET_V}" alt="" width="38" height="38">
        <span>Job Search PH</span>
      </a>
    </div>
  </header>
  <main class="wrap">
${body}
  </main>
  <footer class="site-footer">
    <div class="wrap footer-inner">
      <p><strong>Job Search PH</strong> is a job listing board. We do not recruit, screen or place workers, and we never charge jobseekers.</p>
      <p><a href="/#/safety">Safety tips &amp; FAQs</a> · <a href="/#/support">Contact support</a> · <a href="/#/terms">Terms</a> · <a href="/#/privacy">Privacy</a></p>
    </div>
  </footer>
</body>
</html>
`;
}

function jobPage(j) {
  const where = [j.area, j.city].filter(Boolean).join(", ");
  const title = `${j.title} — ${j.city} | Job Search PH`;
  const description = `${j.title} in ${where}. ${salaryText(j)}. ${j.employmentType || ""}. Apply free on Job Search PH.`.replace(/\s+/g, " ").replace(/\. \./g, ".");
  const appLink = `/#/job/${encodeURIComponent(j.id)}`;
  const conds = conditions(j);
  const reqs = requirements(j);
  const body = `    <p><a href="/jobs/" class="back">← All jobs</a></p>
    <article class="job">
      <div class="job-main">
        <h1>${esc(j.title)}</h1>
        <p class="employer">${esc(publicName(j))}</p>
        <p class="loc"><span>${esc(where)}</span></p>
        <ul class="meta"><li>${esc(j.employmentType)}</li>${j.category ? `<li>${esc(publicCategory(j))}</li>` : ""}<li>Posted ${new Date(j.approvedAt || j.createdAt || Date.now()).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</li></ul>
        <div class="pay-box"><span class="salary salary-lg">${esc(salaryText(j))}</span></div>
        <h2>About the job</h2><p>${esc(j.description).replace(/\n/g, "<br>")}</p>
        ${conds.length ? `<h2>Work conditions</h2><dl class="conds">${conds.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
        ${(j.benefits || []).length ? `<h3 class="sub">Benefits</h3><ul class="benefits">${j.benefits.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
        ${reqs.length ? `<h2>Requirements</h2><ul class="reqs">${reqs.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
      </div>
      <aside class="job-side">
        <div class="panel">
          <strong>Interested?</strong>
          <p>Apply for free on Job Search PH and message the employer directly.</p>
          <a class="btn btn-primary" href="${appLink}">Apply on Job Search PH</a>
        </div>
        <div class="panel panel-warn">
          <strong>Never pay to get a job.</strong>
          <p>If the employer asks for a fee, deposit or your ID before an interview, stop and report the post.</p>
        </div>
      </aside>
    </article>`;
  return shell({
    title, description, canonical: `${SITE}/jobs/${j.id}/`, body,
    head: `  <script type="application/ld+json">\n${jobPosting(j)}\n  </script>`,
  });
}

function indexPage(jobs) {
  const body = `    <h1>Jobs in Negros Occidental</h1>
    <p class="muted">${jobs.length} open job${jobs.length === 1 ? "" : "s"}. <a href="/">Search and filter on Job Search PH</a></p>
    ${jobs.length ? `<div class="cards">${jobs.map((j) => `
      <a class="card" href="/jobs/${j.id}/">
        <h3>${esc(j.title)}</h3>
        <p class="muted">${esc(publicName(j))} · ${esc([j.area, j.city].filter(Boolean).join(", "))}</p>
        <p class="salary">${esc(salaryText(j))}</p>
      </a>`).join("")}
    </div>` : `<p>No open jobs right now. <a href="/">Check Job Search PH</a> for new posts.</p>`}`;
  return shell({
    title: "Jobs in Negros Occidental | Job Search PH",
    description: "Open kasambahay, yaya, caregiver, driver, cook and local jobs in Bacolod and Negros Occidental. Free for jobseekers.",
    canonical: `${SITE}/jobs/`, body,
  });
}

function sitemap(jobs) {
  const urls = [
    `  <url><loc>${SITE}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `  <url><loc>${SITE}/jobs/</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`,
    ...jobs.map((j) => `  <url><loc>${SITE}/jobs/${j.id}/</loc><lastmod>${iso(j.updatedAt || j.approvedAt || j.createdAt || Date.now()).slice(0, 10)}</lastmod></url>`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

/* ---------- Write ---------- */

async function main() {
  const i = process.argv.indexOf("--fixture");
  const raw = i > 0 ? JSON.parse(await readFile(process.argv[i + 1], "utf8")) : await fetchJobs();
  const now = Date.now();
  const jobs = raw.filter((j) => safeId(j.id) && isLive(j, now) && j.title && j.city)
    .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.approvedAt || 0) - (a.approvedAt || 0));

  await mkdir(JOBS_DIR, { recursive: true });
  const keep = new Set(jobs.map((j) => j.id));
  for (const d of await readdir(JOBS_DIR, { withFileTypes: true })) {
    if (d.isDirectory() && !keep.has(d.name)) await rm(join(JOBS_DIR, d.name), { recursive: true, force: true });
  }
  for (const j of jobs) {
    await mkdir(join(JOBS_DIR, j.id), { recursive: true });
    await writeFile(join(JOBS_DIR, j.id, "index.html"), jobPage(j));
  }
  await writeFile(join(JOBS_DIR, "index.html"), indexPage(jobs));
  await writeFile(join(ROOT, "sitemap.xml"), sitemap(jobs));
  console.log(`Built ${jobs.length} job page(s).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
