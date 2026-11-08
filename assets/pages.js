// Shared words for the public pages. Used by the app (assets/app.js) and by the page
// builder for search engines (scripts/build-job-pages.mjs), so both always say the same thing.
// No browser-only code in here: Node imports this file too.

export const IDENTITY = {
  area: "Negros Occidental",
  // One line that says what we are, used in headlines, footers and search descriptions.
  line: "The local job board for Negros Occidental.",
  footer: "Job Search PH is the local job board for Negros Occidental. We list jobs; we do not recruit, screen or place workers, and we never charge jobseekers.",
  homeTitle: "Job Search PH — Local jobs in Negros Occidental",
  homeDescription: "The local job board for Negros Occidental. Find household, service and local jobs in Bacolod and nearby towns, or post a job and get local applicants in one inbox.",
  employersTitle: "Hire locally in Negros Occidental | Job Search PH",
  employersDescription: "Post a job on the local job board for Negros Occidental. Reach jobseekers in Bacolod and nearby towns, see local candidates, and manage every applicant in one inbox.",
  safetyTitle: "Safety tips & FAQs | Job Search PH",
  safetyDescription: "How to stay safe when looking for work or hiring on Job Search PH, plus answers to common questions.",
};

// Employer prices in pesos. The payments rule in firestore.rules checks the same numbers.
export const PRICES = { post: 199, monthly: 499 };

// What employers get. Keep these three in this order everywhere.
export const EMPLOYER_BENEFITS = [
  { key: "reach", title: "Reach", text: "Your job goes on the board people in Bacolod and nearby towns check for local work. Share its link in your Facebook groups too." },
  { key: "local", title: "Local candidates", text: "Every applicant shows their city and barangay, so you can see who lives near the job before you reply." },
  { key: "inbox", title: "An applicant inbox", text: "All applicants in one place, with their full profile. Sort by best fit, shortlist, and message them here. No lost DMs." },
];

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// The /employers page. `cta` is the button's attributes, which differ for signed-in employers and visitors.
export function employersHtml(cta = 'href="/#/join/employer"') {
  return `
    <section class="emp-hero">
      <p class="emp-kicker">For employers</p>
      <h1>Hire locally in ${esc(IDENTITY.area)}</h1>
      <p class="emp-sub">Job Search PH is the local job board for ${esc(IDENTITY.area)}. Post your job, and people nearby apply with their full profile.</p>
      <p class="emp-cta"><a class="btn btn-primary" ${cta}>Post a job</a><span class="muted small">Your first post is free. <a href="/pricing/">See prices</a></span></p>
    </section>
    <section class="emp-benefits" aria-label="What employers get">
      ${EMPLOYER_BENEFITS.map((b, i) => `<div class="emp-benefit"><span class="emp-num">${i + 1}</span><h2>${esc(b.title)}</h2><p>${esc(b.text)}</p></div>`).join("")}
    </section>
    <section class="emp-how">
      <h2>How it works</h2>
      <ol><li><strong>Describe the job and the pay.</strong> It takes a few minutes.</li><li><strong>We check it,</strong> usually within a day, so jobseekers can trust what they see.</li><li><strong>Applicants come to your inbox.</strong> Shortlist the ones you like and message them.</li></ol>
      <p class="emp-cta"><a class="btn btn-primary" ${cta}>Post a job</a> <a class="btn btn-ghost" href="/pricing/">See prices</a></p>
      <p class="muted small">Job Search PH is a job board. We don't recruit, screen or place workers, and you choose who to hire.</p>
    </section>`;
}

// The /pricing page (link for ads). `cta` = attributes of the "Post a job" buttons; `talk` = the Enterprise button.
export const PRICING_TITLE = "Prices for employers | Job Search PH";
export const PRICING_DESCRIPTION = `Your first job post is free. Pro post ₱${PRICES.post}: unlimited applicants and top of the list for 30 days. Pro monthly ₱${PRICES.monthly}. Enterprise for bigger teams. Always free for jobseekers.`;
export function pricingHtml(cta = 'href="/#/join/employer"', talk = 'href="/#/support"') {
  const tick = (t) => `<li>${t}</li>`;
  const plan = (cls, name, price, per, sub, items, btn) => `<div class="price-card ${cls}">
      ${cls.includes("best") ? `<span class="price-flag">Most popular</span>` : ""}
      <h2>${name}</h2><p class="price">${price}${per ? `<span>${per}</span>` : ""}</p><p class="price-sub">${sub}</p>
      <ul>${items.map(tick).join("")}</ul>${btn}</div>`;
  return `
    <section class="emp-hero price-hero">
      <p class="emp-kicker">Prices for employers</p>
      <h1>Hire faster in ${esc(IDENTITY.area)}</h1>
      <p class="emp-sub">Try your first post free. Go Pro when you want more applicants and a spot at the top.</p>
    </section>
    <section class="price-grid" aria-label="Plans">
      ${plan("", "Free", "₱0", "", "Your first post", ["1 job post", "Up to 5 applicants, then it stops taking applications", "Up to 3 openings", "Live for 30 days"], `<a class="btn btn-ghost btn-block" ${cta}>Start free</a>`)}
      ${plan("best", "Pro post", `₱${PRICES.post}`, " / post", "For hiring once, like a kasambahay or yaya", ["Unlimited applicants", "Shown at the top of the job list for 30 days", "Up to 10 openings", "\u201cPost a similar job\u201d in one tap"], `<a class="btn btn-primary btn-block" ${cta}>Post a job</a>`)}
      ${plan("", "Pro monthly", `₱${PRICES.monthly}`, " / month", "For businesses that hire often", ["Everything in Pro post", "Up to 5 Pro posts a month", "Every post at the top of the list", "Best value from 3 posts a month"], `<a class="btn btn-ghost btn-block" ${cta}>Post a job</a>`)}
      ${plan("ent", "Enterprise", "Let\u2019s talk", "", "For bigger businesses and many branches", ["Up to 30 posts a month", "We can write and post jobs for you", "Faster review and a monthly report", "Verified business badge after we check your permit"], `<a class="btn btn-ghost btn-block" ${talk}>Talk to us</a>`)}
    </section>
    <section class="emp-how price-faq">
      <h2>Good to know</h2>
      <ul>
        <li><strong>How do I pay?</strong> With GCash, Maya or any bank app, by scanning our InstaPay QR. We confirm it, usually within a few hours.</li>
        <li><strong>Is it free for jobseekers?</strong> Yes, always. Jobseekers never pay to apply, and employers must never charge them anything.</li>
        <li><strong>What if my post isn't approved?</strong> Fix it and we check it again. If we can't approve it, we refund your payment.</li>
        <li><strong>Do you take a fee when I hire?</strong> No. You pay only for the job post. Job Search PH is a job board: we don't recruit or place workers, and you choose who to hire.</li>
      </ul>
    </section>`;
}
