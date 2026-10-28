// Page shell, header/footer, breadcrumbs and JSON-LD helpers shared by every static page.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, BRAND, OG_IMAGE, OG_IMAGE_SIZE, FACEBOOK_PAGE } from "./config.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Same cache-busting number index.html uses, so static pages load the same CSS the app does.
export const ASSET_V = (() => {
  try { return readFileSync(join(ROOT, "index.html"), "utf8").match(/styles\.css\?v=(\d+)/)?.[1] || "1"; } catch { return "1"; }
})();

// Schema.org JSON-LD. "<" is escaped so text can never close the script tag.
export const jsonLd = (obj) => `  <script type="application/ld+json">\n${JSON.stringify(obj, null, 2).replace(/</g, "\\u003c")}\n  </script>`;

export const abs = (path) => `${SITE}${path}`;

export function breadcrumbs(trail) {
  // trail: [[name, path], ...] ending with the current page (its path may be omitted)
  const items = [["Home", "/"], ...trail];
  const html = `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items
    .map(([n, p], i) => (i === items.length - 1 ? `<li aria-current="page">${esc(n)}</li>` : `<li><a href="${p}">${esc(n)}</a></li>`))
    .join("")}</ol></nav>`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([n, p], i) => ({ "@type": "ListItem", position: i + 1, name: n, ...(p ? { item: abs(p) } : {}) })),
  };
  return { html, ld };
}

const NAV = [
  ["/", "Find jobs"],
  ["/jobs/", "Browse all jobs"],
  ["/employers/", "Post a job"],
  ["/how-it-works/", "How it works"],
];

export function header() {
  return `  <header class="site-header">
    <div class="wrap header-inner">
      <a href="/" class="brand" aria-label="Job Search PH home">
        <img class="brand-mark" src="/assets/img/icon-circle-64.png?v=${ASSET_V}" alt="" width="38" height="38">
        <span>Job Search PH</span>
      </a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav" aria-label="Menu" onclick="var n=document.getElementById('nav');var o=n.classList.toggle('open');this.setAttribute('aria-expanded',o)">Menu</button>
      <nav id="nav" class="nav" aria-label="Main">
${NAV.map(([h, l]) => `        <a href="${h}">${l}</a>`).join("\n")}
        <a class="btn btn-primary btn-sm nav-cta" href="/#/signin">Sign in</a>
      </nav>
    </div>
  </header>`;
}

// Crawlable links shown on every page (and mirrored by hand in index.html). Keep to pages that always exist.
export const FOOTER_GROUPS = [
  ["Find work", [["/jobs/", "All jobs"], ["/jobs/kasambahay/", "Kasambahay jobs"], ["/jobs/yaya/", "Yaya and nanny jobs"], ["/jobs/in/bacolod-city/", "Jobs in Bacolod City"], ["/jobs/in/negros-occidental/", "Jobs in Negros Occidental"]]],
  ["Hiring", [["/employers/", "Post a job for free"], ["/safety/", "Safety tips"], ["/how-it-works/", "How it works"]]],
  ["Job Search PH", [["/about/", "About"], ["/faq/", "FAQ"], ["/contact/", "Contact"], ["/terms/", "Terms"], ["/privacy/", "Privacy"]]],
];

export function footer() {
  return `  <footer class="site-footer">
    <div class="wrap footer-inner">
      <div class="foot-cols">
${FOOTER_GROUPS.map(([h, links]) => `        <nav aria-label="${esc(h)}"><strong>${esc(h)}</strong><ul>${links.map(([p, n]) => `<li><a href="${p}">${esc(n)}</a></li>`).join("")}</ul></nav>`).join("\n")}
      </div>
      <p><strong>Job Search PH</strong> is a job listing board. We do not recruit, screen or place workers, and we never charge jobseekers.</p>
    </div>
  </footer>`;
}

/**
 * Wraps page content in the full HTML document.
 * robots: "index" (default) or "noindex". schema: array of JSON-LD objects.
 */
export function shell({ title, description, path, body, robots = "index", schema = [], ogType = "website", extraHead = "", canonical }) {
  const url = canonical === false ? "" : canonical || abs(path);
  const full = title.includes(BRAND) ? title : `${title} | ${BRAND}`;
  const robotsContent = robots === "noindex" ? "noindex,follow" : "index,follow,max-snippet:-1,max-image-preview:large";
  const img = abs(OG_IMAGE);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#3d4fd6">
  <title>${esc(full)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="${robotsContent}">
${url ? `  <link rel="canonical" href="${url}">\n` : ""}  <meta property="og:site_name" content="${BRAND}">
  <meta property="og:locale" content="en_PH">
  <meta property="og:type" content="${ogType}">
${url ? `  <meta property="og:url" content="${url}">\n` : ""}  <meta property="og:title" content="${esc(full)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${img}">
  <meta property="og:image:width" content="${OG_IMAGE_SIZE[0]}">
  <meta property="og:image:height" content="${OG_IMAGE_SIZE[1]}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(full)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${img}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script>try{var t=localStorage.getItem("jsph-theme")||"light";if(t!=="system")document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="light";}</script>
  <link rel="stylesheet" href="/assets/styles.css?v=${ASSET_V}">
  <link rel="icon" href="/favicon.ico?v=${ASSET_V}" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/img/icon-circle-32.png?v=${ASSET_V}">
  <link rel="apple-touch-icon" href="/assets/img/icon-circle-192.png?v=${ASSET_V}">
${schema.map(jsonLd).join("\n")}${extraHead ? "\n" + extraHead : ""}
</head>
<body>
${header()}
  <main class="wrap">
${body}
  </main>
${footer()}
</body>
</html>
`;
}

export const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: BRAND,
  url: `${SITE}/`,
  logo: `${SITE}/assets/img/logo-512.png`,
  sameAs: [FACEBOOK_PAGE],
  contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", email: "jobsearchph.official@gmail.com", areaServed: "PH", availableLanguage: ["English", "Filipino"] }],
};

export const WEBSITE = { "@context": "https://schema.org", "@type": "WebSite", name: BRAND, url: `${SITE}/` };
