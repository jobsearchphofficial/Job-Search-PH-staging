// Builds the public pages Google can index, each a copy of index.html (so the full app runs on it)
// with its own title, description, canonical address and pre-filled content:
//   /jobs/<id>/  one per live job, with JobPosting structured data for Google for Jobs
//   /jobs/       the list of open jobs
//   /employers/  and /safety/  (no database needed)
// Also rewrites sitemap.xml.
//
// Run:   node scripts/build-job-pages.mjs                 (live: the robot runs this every 2 hours)
//        node scripts/build-job-pages.mjs --static-only   (on every deploy: rebuilds /employers/ and /safety/ only)
// Test:  node scripts/build-job-pages.mjs --fixture scripts/sample-jobs.json
// No dependencies. Reads only approved jobs, which are public under firestore.rules.

import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { IDENTITY, employersHtml, pricingHtml, PRICING_TITLE, PRICING_DESCRIPTION } from "../assets/pages.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://jobsearchph.com";
const JOBS_DIR = join(ROOT, "jobs");

/* ---------- Load jobs ---------- */

async function readConfig() {
  const src = await readFile(join(ROOT, "assets/firebase-config.js"), "utf8");
  // Read the LIVE block only. The file also holds the test site's config, and that one comes first.
  const live = src.match(/LIVE_CONFIG\s*=\s*\{([\s\S]*?)\}/)?.[1];
  if (!live) throw new Error("LIVE_CONFIG not found in assets/firebase-config.js");
  const pick = (k) => live.match(new RegExp(`${k}:\\s*"([^"]+)"`))?.[1];
  const cfg = { apiKey: pick("apiKey"), projectId: pick("projectId") };
  if (cfg.projectId !== "job-search-ph-website") throw new Error(`Refusing to build live job pages from project "${cfg.projectId}"`);
  return cfg;
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
  // The web API key is limited to our websites, so say where this request is for (Google checks the referer).
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", referer: "https://jobsearchph.com/" }, body: JSON.stringify(body) });
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
  if (s === "Flexible schedule") return ["FULL_TIME", "PART_TIME"];
  return ["FULL_TIME"];
}

function conditions(j) {
  const rows = [];
  rows.push(["Arrangement", j.employmentType]);
  if (j.workplace === "household" && j.schedule) rows.push(["Schedule", j.schedule]);
  if (j.workplace) rows.push(["Workplace", j.workplace === "household" ? "Private household" : "Business"]);
  if (j.hours) rows.push(["Working hours", j.hours]);
  if (j.shiftNote) rows.push([j.shiftType === "rotating" ? "Rotating schedule" : "Shifts", j.shiftNote]);
  if (j.daysPerWeek) rows.push(["Days a week", `${j.daysPerWeek} day${Number(j.daysPerWeek) === 1 ? "" : "s"}`]);
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

// Every page is index.html with its own head and pre-filled content, so it always matches the live site.
let TEMPLATE = "";
function shell({ title, description, canonical, body, head = "" }) {
  let h = TEMPLATE;
  const put = (re, val) => { if (!re.test(h)) throw new Error(`index.html is missing ${re}`); h = h.replace(re, () => val); };
  put(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  put(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">`);
  put(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${canonical}">`);
  put(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${canonical}">`);
  put(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`);
  put(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(description)}">`);
  put(/<\/head>/, `${head ? `${head}\n` : ""}</head>`);
  put(/(<main id="app"[^>]*>)[\s\S]*?(<\/main>)/, `<main id="app" class="wrap" tabindex="-1">\n${body}\n  </main>`);
  return h;
}

function jobPage(j) {
  const where = [j.area, j.city].filter(Boolean).join(", ");
  const title = `${j.title} — ${j.city} | Job Search PH`;
  const description = `${j.title} in ${where}. ${salaryText(j)}. ${j.employmentType || ""}. Apply free on Job Search PH.`.replace(/\s+/g, " ").replace(/\. \./g, ".");
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
    <p class="muted">${esc(IDENTITY.line)} ${jobs.length} open job${jobs.length === 1 ? "" : "s"}.</p>
    ${jobs.length ? `<div class="cards">${jobs.map((j) => `
      <a class="card" href="/jobs/${j.id}/">
        <h3>${esc(j.title)}</h3>
        <p class="muted">${esc(publicName(j))} · ${esc([j.area, j.city].filter(Boolean).join(", "))}</p>
        <p class="salary">${esc(salaryText(j))}</p>
      </a>`).join("")}
    </div>` : `<p>No open jobs right now. <a href="/">Check Job Search PH</a> for new posts.</p>`}`;
  return shell({
    title: "Local jobs in Negros Occidental | Job Search PH",
    description: `${IDENTITY.line} Open kasambahay, yaya, caregiver, driver, cook and local jobs in Bacolod and nearby towns. Free for jobseekers.`,
    canonical: `${SITE}/jobs/`, body,
  });
}

function employersPage() {
  return shell({ title: IDENTITY.employersTitle, description: IDENTITY.employersDescription, canonical: `${SITE}/employers/`, body: `<div class="emp-page">${employersHtml()}</div>` });
}
function pricingPage() {
  return shell({ title: PRICING_TITLE, description: PRICING_DESCRIPTION, canonical: `${SITE}/pricing/`, body: `<div class="emp-page">${pricingHtml()}</div>` });
}
function safetyPage() {
  const body = `    <article class="prose legal"><h1>Safety tips &amp; FAQs</h1>
      <p>${esc(IDENTITY.line)} Real employers never ask you to pay to apply, train or get hired. If anyone asks for a fee, a deposit or your ID before an interview, stop and report the post.</p></article>`;
  return shell({ title: IDENTITY.safetyTitle, description: IDENTITY.safetyDescription, canonical: `${SITE}/safety/`, body });
}

function sitemap(jobs) {
  const urls = [
    `  <url><loc>${SITE}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `  <url><loc>${SITE}/jobs/</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`,
    `  <url><loc>${SITE}/employers/</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>`,
    `  <url><loc>${SITE}/pricing/</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>`,
    `  <url><loc>${SITE}/safety/</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`,
    ...jobs.map((j) => `  <url><loc>${SITE}/jobs/${j.id}/</loc><lastmod>${iso(j.updatedAt || j.approvedAt || j.createdAt || Date.now()).slice(0, 10)}</lastmod></url>`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

/* ---------- Write ---------- */

async function main() {
  TEMPLATE = await readFile(join(ROOT, "index.html"), "utf8");
  for (const [dir, html] of [["employers", employersPage()], ["pricing", pricingPage()], ["safety", safetyPage()]]) {
    await mkdir(join(ROOT, dir), { recursive: true });
    await writeFile(join(ROOT, dir, "index.html"), html);
  }
  if (process.argv.includes("--static-only")) { console.log("Built /employers/, /pricing/ and /safety/."); return; }
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
