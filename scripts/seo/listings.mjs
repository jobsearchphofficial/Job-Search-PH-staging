// Listing pages: the /jobs/ hub, category pages, location pages and category+location pages.
// Which pages exist and which are indexed is decided by real job counts (see config.mjs).
import { CATEGORIES, CITIES, PROVINCE, BARANGAYS, PAGE_SIZE, MIN_INDEX_JOBS, catByName, cityByName } from "./config.mjs";
import { esc, shell, breadcrumbs } from "./layout.mjs";
import { jobCard, jobPath, monthlyEquivalent, postedAt, peso } from "./jobs.mjs";
import { CATEGORY_COPY, GENERIC_ASK, PLACE_COPY, ALERTS_NOTE } from "./editorial.mjs";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function monthlyRange(jobs) {
  const v = jobs.filter((j) => j.salaryPeriod === "month" && (j.salaryMin || j.salaryMax)).flatMap((j) => [j.salaryMin, j.salaryMax].filter(Boolean));
  if (jobs.filter((j) => j.salaryPeriod === "month").length < 2 || !v.length) return "";
  const lo = Math.min(...v), hi = Math.max(...v);
  return lo === hi ? "" : `Monthly-paid posts currently range from ${peso(lo)} to ${peso(hi)}.`;
}

function browseLinks(counts, { except } = {}) {
  const cats = CATEGORIES.filter((c) => c.path !== except?.cat)
    .map((c) => `<a class="chip-link" href="${c.path}">${esc(c.label)}${counts.cat[c.slug] ? ` <span>${counts.cat[c.slug]}</span>` : ""}</a>`).join("");
  const cities = CITIES.filter((c) => c.core || c.metro || counts.city[c.slug])
    .filter((c) => c.path !== except?.city)
    .map((c) => `<a class="chip-link" href="${c.path}">${esc(c.name)}${counts.city[c.slug] ? ` <span>${counts.city[c.slug]}</span>` : ""}</a>`).join("");
  return `<section class="browse" aria-label="Browse jobs">
      <h2>Browse by category</h2><div class="chip-links">${cats}</div>
      <h2>Browse by location</h2><div class="chip-links"><a class="chip-link" href="${PROVINCE.path}">All of Negros Occidental</a>${cities}</div>
    </section>`;
}

function emptyState(what) {
  return `<div class="empty empty-hero">
      <h2>No open ${esc(what)} right now</h2>
      <p class="muted">New jobs are added regularly and each one is checked first. ${ALERTS_NOTE}</p>
      <p class="empty-actions"><a class="btn btn-primary" href="/#/profile">Create a free profile</a> <a class="btn btn-ghost" href="/jobs/">See all open jobs</a></p>
    </div>`;
}

function pagerHtml(base, page, pages) {
  if (pages < 2) return "";
  const href = (n) => (n === 1 ? base : `${base}page/${n}/`);
  const nums = Array.from({ length: pages }, (_, i) => i + 1)
    .map((n) => (n === page ? `<span class="pg on" aria-current="page">${n}</span>` : `<a class="pg" href="${href(n)}">${n}</a>`)).join("");
  return `<nav class="pager" aria-label="Pages">${page > 1 ? `<a rel="prev" href="${href(page - 1)}">← Previous</a>` : ""}${nums}${page < pages ? `<a rel="next" href="${href(page + 1)}">Next →</a>` : ""}</nav>`;
}

/**
 * def: { path, h1, eyebrow, title, description, crumbs, jobs, intro, sections[], robots, emptyWhat, counts, except, cta }
 * Returns one page per PAGE_SIZE jobs: [{ path, html, indexable }].
 */
function renderListing(def) {
  const pages = Math.max(1, Math.ceil(def.jobs.length / PAGE_SIZE));
  const out = [];
  for (let page = 1; page <= pages; page++) {
    const path = page === 1 ? def.path : `${def.path}page/${page}/`;
    const slice = def.jobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const trail = def.crumbs.length ? def.crumbs : [];
    const last = trail.length ? trail[trail.length - 1] : null;
    const crumbTrail = page === 1 ? trail.map((c, i) => (i === trail.length - 1 ? [c[0]] : c)) : [...trail.slice(0, -1), [last[0], def.path], [`Page ${page}`]];
    const crumbs = breadcrumbs(crumbTrail);
    const count = def.jobs.length;
    const body = `    ${crumbs.html}
    <section class="hero">
      <span class="eyebrow">${esc(def.eyebrow || "Free for jobseekers · No fees, ever")}</span>
      <h1>${esc(def.h1)}${page > 1 ? ` <small>· Page ${page}</small>` : ""}</h1>
      <p>${def.intro}</p>
      <div class="hero-row">
        <a class="btn btn-primary" href="/#/">Search and filter jobs</a>
        <a class="btn btn-ghost" href="/employers/">Post a job for free</a>
        <div class="hero-stats"><span><strong>${count}</strong> open job${count === 1 ? "" : "s"}</span>${monthlyRange(def.jobs) ? `<span>${monthlyRange(def.jobs)}</span>` : ""}</div>
      </div>
    </section>
    ${count ? `<section class="cards" aria-label="Open jobs">\n${slice.map(jobCard).join("\n")}\n    </section>${pagerHtml(def.path, page, pages)}` : emptyState(def.emptyWhat || "jobs")}
    ${page === 1 ? (def.sections || []).join("\n    ") : ""}
    ${browseLinks(def.counts, { except: def.except })}
    <aside class="notice"><strong>Stay safe:</strong> real employers never ask you to pay to apply, train or get hired. <a href="/safety/">Read the safety tips</a>.</aside>`;
    out.push({
      path,
      indexable: def.robots !== "noindex",
      html: shell({
        title: page === 1 ? def.title : `${def.title} (Page ${page})`,
        description: page === 1 ? def.description : `${def.description} Page ${page}.`,
        path, body, robots: def.robots, schema: [crumbs.ld],
      }),
    });
  }
  return out;
}

const guideSections = (c) => {
  const copy = CATEGORY_COPY[c.slug];
  const ask = copy?.ask || GENERIC_ASK;
  return [
    ...(copy ? [`<section class="prose guide"><h2>What to know about ${esc(c.label.toLowerCase())} jobs</h2><ul>${copy.about.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></section>`] : []),
    `<section class="prose guide"><h2>Questions to ask before you accept</h2><ul>${ask.map((a) => `<li>${esc(a)}</li>`).join("")}</ul><p>Read more in our <a href="/safety/">safety tips</a> and <a href="/faq/">FAQ</a>. Never pay anyone to get a job.</p></section>`,
    `<section class="prose guide"><h2>Hiring?</h2><p>${esc(copy?.employer || "Post your job for free, review applicants and chat with them in one place.")} <a href="/employers/">How posting works</a>.</p></section>`,
  ];
};

export function buildListings(jobs) {
  const counts = { cat: {}, city: {} };
  for (const j of jobs) {
    const c = catByName(j.category), t = cityByName(j.city);
    if (c) counts.cat[c.slug] = (counts.cat[c.slug] || 0) + 1;
    if (t) counts.city[t.slug] = (counts.city[t.slug] || 0) + 1;
  }
  const newest = (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || postedAt(b) - postedAt(a);
  const sorted = [...jobs].sort(newest);
  const pages = [];
  const idx = (n, core) => (core || n >= MIN_INDEX_JOBS ? "index" : "noindex");

  // /jobs/ hub
  pages.push(...renderListing({
    path: "/jobs/", h1: "Job vacancies in Bacolod City and Negros Occidental",
    title: "Job Vacancies in Bacolod and Negros Occidental",
    description: sorted.length
      ? `Browse ${plural(sorted.length, "open job", "open jobs")} in Bacolod City and Negros Occidental: kasambahay, yaya, caregiver, driver, cook and more. Free to apply.`
      : "Browse household, service and local jobs in Bacolod City and Negros Occidental. Free to apply, and every post is reviewed before it goes live.",
    crumbs: [["Jobs"]], jobs: sorted, counts, robots: "index", emptyWhat: "jobs",
    intro: "Household, service and local jobs from employers in Bacolod City and across Negros Occidental. Every post is reviewed before it goes live, and applying is free.",
    sections: [`<section class="prose guide"><h2>How to apply</h2><p>Pick a job, create a free profile, and tap <strong>Apply</strong>. The employer sees your profile and you can message each other in the app. <a href="/how-it-works/">See how it works</a>.</p></section>`],
  }));

  // Province
  const nocc = PLACE_COPY["negros-occidental"];
  pages.push(...renderListing({
    path: PROVINCE.path, h1: "Jobs in Negros Occidental", title: "Jobs in Negros Occidental: Latest Vacancies",
    description: sorted.length ? `Browse ${plural(sorted.length, "open job", "open jobs")} in Negros Occidental, from Bacolod City to the province's cities and towns. Free to apply.` : nocc.metaEmpty,
    crumbs: [["Jobs", "/jobs/"], ["Negros Occidental"]], jobs: sorted, counts, robots: "index", emptyWhat: "jobs in Negros Occidental", intro: nocc.intro,
    except: { city: PROVINCE.path },
    sections: [`<section class="prose guide"><h2>Where we list jobs</h2><p>Job Search PH covers Negros Occidental only for now: Bacolod City, Talisay, Silay, Bago, Victorias, Cadiz, Sagay, La Carlota, Kabankalan, San Carlos, Escalante, Himamaylan and Sipalay, and the province's municipalities. Pick a place below to see its jobs.</p></section>`],
  }));

  // Categories (all of them exist so links never break; thin ones stay noindex)
  for (const c of CATEGORIES) {
    const list = sorted.filter((j) => j.category === c.name);
    const copy = CATEGORY_COPY[c.slug];
    const place = c.core ? "Bacolod and Negros Occidental" : "Negros Occidental";
    pages.push(...renderListing({
      path: c.path, h1: `${c.title} in ${c.core ? "Bacolod City and " : ""}Negros Occidental`,
      title: `${c.title} in ${place}`,
      description: list.length
        ? `Browse ${plural(list.length, `open ${c.label.toLowerCase()} job`, `open ${c.label.toLowerCase()} jobs`)} in Bacolod City and Negros Occidental. Free to apply, and every post is reviewed first.`
        : copy?.metaEmpty || `${c.title} in Bacolod City and Negros Occidental: browse open posts, and get alerts when new jobs are posted.`,
      crumbs: [["Jobs", "/jobs/"], [c.title]], jobs: list, counts, robots: idx(list.length, c.core), emptyWhat: `${c.label.toLowerCase()} jobs`,
      except: { cat: c.path },
      intro: copy?.intro || `Browse ${c.label.toLowerCase()} jobs from employers in Bacolod City and across Negros Occidental. Every post is reviewed before it goes live, and applying is always free.`,
      sections: guideSections(c),
    }));
  }

  // Locations: Metro Bacolod always, other places once they have a job
  for (const t of CITIES) {
    const list = sorted.filter((j) => j.city === t.name);
    if (!list.length && !t.metro) continue;
    const copy = PLACE_COPY[t.slug];
    const brgy = BARANGAYS[t.name];
    const where = t.name === "Bacolod City" ? t.name : `${t.name}, Negros Occidental`;
    pages.push(...renderListing({
      path: t.path, h1: `Jobs in ${where}`,
      title: t.core ? "Jobs in Bacolod City: Latest Vacancies" : `Jobs in ${where}`,
      description: list.length ? `Browse ${plural(list.length, "open job", "open jobs")} in ${t.name}: household, service and local work. Free to apply, and every post is reviewed first.` : copy?.metaEmpty || `Jobs in ${t.name}, Negros Occidental: browse open posts and get alerts when new jobs are posted.`,
      crumbs: [["Jobs", "/jobs/"], [PROVINCE.name, PROVINCE.path], [t.name]], jobs: list, counts, robots: idx(list.length, t.core), emptyWhat: `jobs in ${t.name}`,
      except: { city: t.path },
      intro: copy?.intro || `Browse household, service and local jobs from employers in ${t.name}, Negros Occidental. Every post is reviewed before it goes live, and applying is always free.`,
      sections: [
        ...(brgy ? [`<section class="prose guide"><h2>Areas in ${esc(t.name)}</h2><p>Employers often name the barangay in their post. Some of the areas in ${esc(t.name)}: ${brgy.map(esc).join(", ")}.</p></section>`] : []),
        `<section class="prose guide"><h2>Before you accept a job</h2><p>${ALERTS_NOTE} Read the <a href="/safety/">safety tips</a>, and never pay anyone to get a job.</p></section>`,
      ],
    }));
  }

  // Category + location, only where there are enough jobs to be useful
  for (const c of CATEGORIES) for (const t of CITIES) {
    const list = sorted.filter((j) => j.category === c.name && j.city === t.name);
    if (list.length < MIN_INDEX_JOBS) continue;
    pages.push(...renderListing({
      path: `/jobs/${c.slug}/in/${t.slug}/`, h1: `${c.title} in ${t.name}`, title: `${c.title} in ${t.name}`,
      description: `Browse ${plural(list.length, `open ${c.label.toLowerCase()} job`, `open ${c.label.toLowerCase()} jobs`)} in ${t.name}, Negros Occidental. Free to apply, and every post is reviewed first.`,
      crumbs: [["Jobs", "/jobs/"], [c.title, c.path], [t.name]], jobs: list, counts, robots: "index",
      intro: `Open ${c.label.toLowerCase()} jobs in ${t.name}, Negros Occidental. Every post is reviewed before it goes live, and applying is always free.`,
      sections: guideSections(c).slice(1),
    }));
  }
  return pages;
}

export { jobPath };
