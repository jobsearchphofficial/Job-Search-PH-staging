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
// Built on common, well-tested pricing-page patterns: outcome headline, 3 plans with the middle one highlighted,
// price framed per day/per post, what Free lacks shown plainly, risk reversal (refund), FAQ, and one last call to action.
// Only true claims: no invented numbers, reviews or countdowns.
export const PRICING_TITLE = "Prices for employers | Job Search PH";
export const PRICING_DESCRIPTION = `Your first job post is free. Pro post ₱${PRICES.post}: unlimited applicants and top of the list for 30 days. Pro monthly ₱${PRICES.monthly}. Enterprise for bigger teams. Always free for jobseekers.`;
export function pricingHtml(cta = 'href="/#/join/employer"', talk = 'href="/#/support"') {
  const yes = (t) => `<li class="y">${t}</li>`, no = (t) => `<li class="n">${t}</li>`;
  const perDay = Math.round(PRICES.monthly / 30);
  const row = (label, f, p, m) => `<tr><th scope="row">${label}</th><td>${f}</td><td class="hl">${p}</td><td>${m}</td></tr>`;
  const ok = `<span class="ck" aria-label="Yes">✓</span>`, x = `<span class="xx" aria-label="No">—</span>`;
  return `
    <section class="pr-hero">
      <p class="emp-kicker">For employers in ${esc(IDENTITY.area)}</p>
      <h1>Find the right person faster.<br><span>Pay only for the job post.</span></h1>
      <p class="pr-sub">Local applicants with their full profile, city and barangay, all in one inbox. Try your first post free, then go Pro when you want more people to choose from.</p>
      <div class="pr-hero-cta"><a class="btn btn-primary btn-lg" ${cta}>Post your first job free</a></div>
      <ul class="pr-trust"><li>No card needed</li><li>Pay with GCash, Maya or any bank</li><li>Refund if we can't approve your post</li></ul>
    </section>

    <section class="pr-grid" aria-label="Plans">
      <div class="pr-card">
        <h2>Free</h2><p class="pr-for">Try it once</p>
        <p class="pr-price">₱0</p><p class="pr-note">Your first post only</p>
        <a class="btn btn-ghost btn-block" ${cta}>Start free</a>
        <ul>${yes("1 job post, live for 30 days")}${yes("Up to 5 applicants")}${yes("Up to 3 openings")}${no("Stops taking applications at 5")}${no("Normal place in the job list")}</ul>
      </div>
      <div class="pr-card best">
        <span class="pr-flag">Recommended</span>
        <h2>Pro post</h2><p class="pr-for">Hiring a kasambahay, yaya, driver or cook</p>
        <p class="pr-price">₱${PRICES.post}<span> / post</span></p><p class="pr-note">One payment. Less than half a day's minimum wage.</p>
        <a class="btn btn-primary btn-block" ${cta}>Post a Pro job</a>
        <ul>${yes("<strong>Unlimited applicants</strong>")}${yes("<strong>Top of the job list</strong> for 30 days")}${yes("Up to 10 openings")}${yes("“Post a similar job” in one tap")}${yes("Everything in Free")}</ul>
      </div>
      <div class="pr-card">
        <span class="pr-flag alt">Best value</span>
        <h2>Pro monthly</h2><p class="pr-for">Businesses that hire often</p>
        <p class="pr-price">₱${PRICES.monthly}<span> / month</span></p><p class="pr-note">About ₱${perDay} a day. Up to 5 Pro posts: from ₱${Math.round(PRICES.monthly / 5)} each.</p>
        <a class="btn btn-ghost btn-block" ${cta}>Get Pro monthly</a>
        <ul>${yes("<strong>Every post is Pro</strong>")}${yes("Up to 5 posts a month")}${yes("Unlimited applicants on all of them")}${yes("Top of the job list")}${yes("Pays for itself from your 3rd post")}</ul>
      </div>
    </section>

    <section class="pr-ent">
      <div><h2>Enterprise</h2><p>Hiring for many branches or 10+ people a month? Up to 30 posts a month, we can write and post your jobs for you, faster review, a monthly report, and a Verified business badge after we check your permit.</p></div>
      <a class="btn btn-ghost" ${talk}>Talk to us</a>
    </section>

    <section class="pr-compare">
      <h2>Compare plans</h2>
      <div class="pr-table-wrap"><table class="pr-table">
        <thead><tr><th></th><th>Free</th><th class="hl">Pro post</th><th>Pro monthly</th></tr></thead>
        <tbody>
          ${row("Price", "₱0, first post", `₱${PRICES.post} per post`, `₱${PRICES.monthly} per month`)}
          ${row("Applicants", "Up to 5", "Unlimited", "Unlimited")}
          ${row("Place in the job list", "Normal", "Top, 30 days", "Top, 30 days")}
          ${row("Openings per post", "Up to 3", "Up to 10", "Up to 10")}
          ${row("Posts", "1", "1 per payment", "Up to 5 a month")}
          ${row("“Post a similar job”", x, ok, ok)}
          ${row("Applicant inbox, fit score, messages", ok, ok, ok)}
          ${row("We check every post", ok, ok, ok)}
        </tbody>
      </table></div>
    </section>

    <section class="pr-steps">
      <h2>How Pro works</h2>
      <ol><li><strong>Write your post.</strong> About 5 minutes. Pick Pro at the end.</li><li><strong>Pay with GCash, Maya or your bank.</strong> Scan our InstaPay QR and type the reference number.</li><li><strong>Get applicants.</strong> We confirm, usually within a few hours, and your post goes to the top.</li></ol>
    </section>

    <section class="pr-faq">
      <h2>Questions</h2>
      <details><summary>Why pay when the first post is free?</summary><p>A free post stops at 5 applicants. Pro keeps taking applications and shows your post at the top, so more people see it and you have more to choose from.</p></details>
      <details><summary>Is there a fee when I hire someone?</summary><p>No. You pay only for the job post. Job Search PH is a job board: we don't recruit or place workers, and you choose who to hire.</p></details>
      <details><summary>What if my post isn't approved?</summary><p>We tell you what to fix and check it again. If we still can't approve it, we refund your payment.</p></details>
      <details><summary>Does Pro monthly renew by itself?</summary><p>No. Nothing is charged automatically. When your 30 days end, you can pay again if you want to.</p></details>
      <details><summary>Is it free for jobseekers?</summary><p>Yes, always. Jobseekers never pay to apply, and employers must never charge them anything.</p></details>
      <details><summary>Can I see my plan and receipts?</summary><p>Yes. Sign in and open <strong>My plan &amp; payments</strong> from the settings menu.</p></details>
    </section>

    <section class="pr-final">
      <h2>Your next hire could apply today.</h2>
      <a class="btn btn-primary btn-lg" ${cta}>Post your first job free</a>
      <p class="muted small">Job Search PH is a job board. We don't recruit, screen or place workers, and you choose who to hire.</p>
    </section>`;
}
