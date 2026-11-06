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
      <p class="emp-cta"><a class="btn btn-primary" ${cta}>Post a job</a><span class="muted small">Posting is free.</span></p>
    </section>
    <section class="emp-benefits" aria-label="What employers get">
      ${EMPLOYER_BENEFITS.map((b, i) => `<div class="emp-benefit"><span class="emp-num">${i + 1}</span><h2>${esc(b.title)}</h2><p>${esc(b.text)}</p></div>`).join("")}
    </section>
    <section class="emp-how">
      <h2>How it works</h2>
      <ol><li><strong>Describe the job and the pay.</strong> It takes a few minutes.</li><li><strong>We check it,</strong> usually within a day, so jobseekers can trust what they see.</li><li><strong>Applicants come to your inbox.</strong> Shortlist the ones you like and message them.</li></ol>
      <p class="emp-cta"><a class="btn btn-primary" ${cta}>Post a job</a></p>
      <p class="muted small">Job Search PH is a job board. We don't recruit, screen or place workers, and you choose who to hire.</p>
    </section>`;
}
