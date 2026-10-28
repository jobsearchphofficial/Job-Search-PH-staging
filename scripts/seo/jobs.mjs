// Job data helpers, eligibility rules, the job page and its JobPosting structured data.
import { SITE, MIN_DESC_CHARS, LISTING_DAYS, slugify, catByName, cityByName, BRAND } from "./config.mjs";
import { esc, shell, breadcrumbs, abs } from "./layout.mjs";
import { scamFlags } from "../../assets/safety.js";

const DAY = 86400000;
const PERIODS = { month: "/ month", day: "/ day", hour: "/ hour" };
const UNIT = { month: "MONTH", day: "DAY", hour: "HOUR" };
export const peso = (n) => "₱" + Number(n).toLocaleString("en-PH");
export const iso = (ms) => new Date(ms).toISOString();
export const safeId = (id) => /^[A-Za-z0-9_-]{1,64}$/.test(String(id));
const lines = (s) => String(s || "").split("\n").map((r) => r.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
export const dateLabel = (ms) => new Date(ms).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });

/* ---------- Privacy: public pages never show phone numbers or email addresses ---------- */
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?63|0)[\s.-]*9[\d\s.-]{8,13}\d|\b9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
export const redact = (t) => String(t ?? "").replace(EMAIL_RE, "[email hidden]").replace(PHONE_RE, "[number hidden]");

// Private households often enter a family name; indexed pages never show it.
export const isHousehold = (j) => j.workplace === "household";
export const publicName = (j) => (isHousehold(j) ? `Private household in ${j.city || "Negros Occidental"}` : redact(j.employerName) || "Private employer");
export const publicCategory = (j) => (j.category === "Other" && j.categoryOther ? j.categoryOther : j.category);

/* ---------- Lifecycle and quality rules ---------- */
export const validThrough = (j) => j.expiresAt || (j.approvedAt || j.createdAt || 0) + LISTING_DAYS * DAY;
export const postedAt = (j) => j.approvedAt || j.createdAt || Date.now();

// A job is public only when it is approved and not past its end date.
export const isLive = (j, now) => j.status === "approved" && validThrough(j) > now;

// Returns "" when the job may be published, otherwise the reason it is held back.
export function holdReason(j) {
  if (!safeId(j.id)) return "unsafe id";
  if (!j.title || String(j.title).trim().length < 3) return "no title";
  if (!j.city) return "no city";
  if (String(j.description || "").trim().length < MIN_DESC_CHARS) return "description too short";
  const risky = scamFlags(`${j.title}\n${j.description}\n${j.requirements || ""}`).filter((f) => ["money", "fee", "otp", "link"].includes(f.type));
  if (risky.length) return `looks risky (${risky.map((f) => f.type).join(", ")})`;
  return "";
}

/* ---------- Text pieces ---------- */
export function salaryText(j) {
  if (!j.salaryMin && !j.salaryMax) return "Salary negotiable";
  const per = PERIODS[j.salaryPeriod] || "";
  if (j.salaryMin && j.salaryMax && j.salaryMax !== j.salaryMin) return `${peso(j.salaryMin)}–${peso(j.salaryMax)} ${per}`.trim();
  return `${peso(j.salaryMin || j.salaryMax)} ${per}`.trim();
}

export function monthlyEquivalent(j) {
  const v = j.salaryMin || j.salaryMax || 0;
  return j.salaryPeriod === "day" ? v * 26 : j.salaryPeriod === "hour" ? v * 8 * 26 : v;
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
  if (isHousehold(j) && j.schedule) rows.push(["Schedule", j.schedule]);
  if (j.workplace) rows.push(["Workplace", isHousehold(j) ? "Private household" : "Business"]);
  if (j.hours) rows.push(["Working hours", redact(j.hours)]);
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
  return out.concat(j.reqList || [], lines(j.requirements)).map(redact);
}

/* ---------- URLs ---------- */
export function jobSlug(j) {
  const t = slugify(j.title).split("-").slice(0, 7).join("-");
  const c = slugify(j.city);
  const base = t.includes(c) ? t : `${t}-${c}`;
  return `${base}-${j.id}`;
}
export const jobPath = (j) => `/jobs/${jobSlug(j)}/`;

/* ---------- Structured data ---------- */
export function jobPosting(j) {
  const desc = [
    `<p>${esc(redact(j.description)).replace(/\n/g, "<br>")}</p>`,
    conditions(j).length ? `<p><strong>Work conditions</strong></p><ul>${conditions(j).map(([k, v]) => `<li>${esc(k)}: ${esc(v)}</li>`).join("")}</ul>` : "",
    (j.benefits || []).length ? `<p><strong>Benefits</strong></p><ul>${j.benefits.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "",
    requirements(j).length ? `<p><strong>Requirements</strong></p><ul>${requirements(j).map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : "",
  ].join("");

  const address = { "@type": "PostalAddress", addressLocality: j.city, addressRegion: "Negros Occidental", addressCountry: "PH" };
  const street = isHousehold(j) ? "" : redact([j.address, j.area].filter(Boolean).join(", "));
  if (street) address.streetAddress = street;

  const data = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: j.title,
    description: desc,
    identifier: { "@type": "PropertyValue", name: BRAND, value: j.id },
    datePosted: iso(postedAt(j)),
    validThrough: iso(validThrough(j)),
    employmentType: employmentTypes(j),
    hiringOrganization: { "@type": "Organization", name: publicName(j) },
    jobLocation: { "@type": "Place", address },
    directApply: false,
    url: abs(jobPath(j)),
  };
  if (j.category) data.occupationalCategory = publicCategory(j);
  if (j.openings > 1) data.totalJobOpenings = j.openings;
  if (j.salaryMin || j.salaryMax) {
    const value = { "@type": "QuantitativeValue", unitText: UNIT[j.salaryPeriod] || "MONTH" };
    if (j.salaryMin && j.salaryMax && j.salaryMax !== j.salaryMin) Object.assign(value, { minValue: j.salaryMin, maxValue: j.salaryMax });
    else value.value = j.salaryMin || j.salaryMax;
    data.baseSalary = { "@type": "MonetaryAmount", currency: "PHP", value };
  }
  return data;
}

/* ---------- Cards and page ---------- */
export function jobCard(j) {
  const where = [j.area, j.city].filter(Boolean).join(", ");
  return `      <a class="card ${j.featured ? "card-featured" : ""}" href="${jobPath(j)}">
        <span class="cat-tag">${esc(publicCategory(j) || "Job")}</span>
        <h3>${esc(j.title)}</h3>
        <p class="muted">${esc(publicName(j))} · ${esc(where)}</p>
        <p class="salary">${esc(salaryText(j))}</p>
        <ul class="meta"><li>${esc(j.employmentType || j.schedule || "")}</li><li>Posted ${esc(dateLabel(postedAt(j)))}</li></ul>
      </a>`;
}

function clip(s, n) {
  s = String(s).replace(/\s+/g, " ").trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  return cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : n - 1).replace(/[\s,.;:–-]+$/, "") + "…";
}

export function jobMeta(j) {
  const where = [j.area, j.city].filter(Boolean).join(", ");
  const room = 60 - " in  | Job Search PH".length - String(j.city).length;
  const t = j.title.length > room ? clip(j.title, room) : j.title;
  const title = `${t} in ${j.city}`;
  const parts = [`${j.title} in ${where}`, salaryText(j), j.employmentType, `Posted ${dateLabel(postedAt(j))}`, "Apply free on Job Search PH"].filter(Boolean);
  return { title, description: clip(parts.join(". ") + ".", 158) };
}

export function jobPage(j, related = []) {
  const where = [j.area, j.city].filter(Boolean).join(", ");
  const cat = catByName(j.category);
  const city = cityByName(j.city);
  const conds = conditions(j);
  const reqs = requirements(j);
  const meta = jobMeta(j);
  const crumbs = breadcrumbs([["Jobs", "/jobs/"], ...(cat ? [[cat.title, cat.path]] : []), [j.title]]);
  const until = validThrough(j);
  const appLink = `/#/job/${encodeURIComponent(j.id)}`;
  const body = `    ${crumbs.html}
    <article class="job" id="job" data-valid-through="${until}">
      <div class="job-main">
        <h1>${esc(j.title)}</h1>
        <p class="employer">${esc(publicName(j))}</p>
        <p class="loc"><span>${esc(where)}</span></p>
        <ul class="meta"><li>${esc(j.employmentType)}</li>${j.category ? `<li>${cat ? `<a href="${cat.path}">${esc(publicCategory(j))}</a>` : esc(publicCategory(j))}</li>` : ""}<li>Posted ${esc(dateLabel(postedAt(j)))}</li><li>Open until ${esc(dateLabel(until))}</li></ul>
        <p class="job-closed" id="job-closed" hidden><strong>This job has closed.</strong> The listing period ended, so it may already be filled. <a href="/jobs/">See open jobs</a>.</p>
        <div class="pay-box"><span class="salary salary-lg">${esc(salaryText(j))}</span></div>
        <h2>About the job</h2><p>${esc(redact(j.description)).replace(/\n/g, "<br>")}</p>
        ${conds.length ? `<h2>Work conditions</h2><dl class="conds">${conds.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
        ${(j.benefits || []).length ? `<h3 class="sub">Benefits</h3><ul class="benefits">${j.benefits.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
        ${reqs.length ? `<h2>Requirements</h2><ul class="reqs">${reqs.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
        <h2>How to apply</h2>
        <p>Create a free Job Search PH profile, then tap <strong>Apply</strong> on this job. The employer sees your profile and you can message each other in the app. Applying is always free.</p>
      </div>
      <aside class="job-side">
        <div class="panel" id="apply-panel">
          <strong>Interested?</strong>
          <p>Apply for free on Job Search PH and message the employer directly.</p>
          <a class="btn btn-primary" href="${appLink}">Apply on Job Search PH</a>
        </div>
        <div class="panel panel-warn">
          <strong>Never pay to get a job.</strong>
          <p>If the employer asks for a fee, deposit or your ID before an interview, stop and report the post. <a href="/safety/">Read the safety tips</a>.</p>
        </div>
      </aside>
    </article>
    ${related.length ? `<section class="related" aria-labelledby="rel-h"><h2 id="rel-h">More jobs${cat ? ` like this` : ""}</h2><div class="cards">\n${related.map(jobCard).join("\n")}\n    </div></section>` : ""}
    <p class="small muted browse-more">Browse more: ${cat ? `<a href="${cat.path}">${esc(cat.title)}</a> · ` : ""}${city ? `<a href="${city.path}">Jobs in ${esc(city.name)}</a> · ` : ""}<a href="/jobs/in/negros-occidental/">Jobs in Negros Occidental</a> · <a href="/jobs/">All jobs</a></p>
    <script>(function(){var a=document.getElementById("job");if(a&&Date.now()>Number(a.dataset.validThrough)){document.getElementById("job-closed").hidden=false;var p=document.getElementById("apply-panel");if(p)p.hidden=true;}})();</script>`;
  return shell({
    title: meta.title, description: meta.description, path: jobPath(j), body, ogType: "article",
    schema: [jobPosting(j), crumbs.ld],
  });
}

// Old links used /jobs/<id>/. They now forward to the descriptive URL.
export function legacyStub(j) {
  const to = abs(jobPath(j));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(j.title)} | ${BRAND}</title>
<link rel="canonical" href="${to}"><meta http-equiv="refresh" content="0; url=${to}">
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body><p>This job moved to <a href="${to}">${esc(to)}</a>.</p></body></html>
`;
}
