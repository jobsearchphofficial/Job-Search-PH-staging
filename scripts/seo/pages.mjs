// Trust and information pages: About, How it works, Employers, Safety, FAQ, Contact, Terms, Privacy.
// Written once by scripts/build-static-pages.mjs and committed. Every claim here must match what the
// site actually does (see README.md). Terms, privacy, safety and FAQ text comes from assets/content.js,
// the same file the app uses, so the two can't drift apart.
import { shell, breadcrumbs, esc, ORGANIZATION } from "./layout.mjs";
import {
  SUPPORT_EMAIL, SUPPORT_MESSENGER, SUPPORT_FACEBOOK, FAQS, faqEl, SAFETY_INTRO, SAFETY_GRID, DANGER_NOTICE,
  legalPage, TERMS_TITLE, TERMS_INTRO, termsSections, PRIVACY_TITLE, PRIVACY_INTRO, privacySections, UPDATED,
} from "../../assets/content.js";
import { TRUST_PAGES } from "./config.mjs";

// Page names used in shared text → real URLs on the static site.
const L = (name) => ({ safety: "/safety/", terms: "/terms/", privacy: "/privacy/", support: "/contact/" }[name] || "/");

const page = ({ path, title, description, crumbName, article, schema = [] }) => {
  const crumbs = breadcrumbs([[crumbName]]);
  return {
    path,
    html: shell({ title, description, path, body: `    ${crumbs.html}\n${article}`, schema: [...schema, crumbs.ld] }),
  };
};

const prose = (kicker, h1, lead, inner) => `    <article class="prose legal">
      <p class="kicker">${esc(kicker)}</p>
      <h1>${h1}</h1>
      <p class="muted">${lead}</p>
${inner}
    </article>`;

const cta = (html) => `      <p class="page-cta">${html}</p>`;
const contactBox = `      <div class="legal-contact"><strong>Questions?</strong> Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>, message us on <a href="${SUPPORT_MESSENGER}" target="_blank" rel="noopener">Messenger</a>, or see our <a href="/contact/">contact page</a>.</div>`;

const about = page({
  path: "/about/", crumbName: "About",
  title: "About Job Search PH",
  description: "Job Search PH is a free online job board for household, service and local jobs in Bacolod City and Negros Occidental. Here is what we do, and what we don't.",
  schema: [ORGANIZATION],
  article: prose("About us", "About Job Search PH", "A free job board for Bacolod City and Negros Occidental.", `
      <h2>What Job Search PH is</h2>
      <p>Job Search PH is an online job listing board based in Bacolod City. Employers post household, service and local jobs, jobseekers create a free profile and apply, and the two can talk to each other in the app. We currently list jobs in Negros Occidental only, and the site is in beta.</p>
      <h2>What we are not</h2>
      <p>We are a listing board, not an employer and not a recruitment agency. We don't recruit, screen, place or employ anyone, and we are not a party to any job agreement between an employer and a jobseeker. Employers hire directly. <strong>We never charge jobseekers.</strong></p>
      <h2>How we try to keep listings trustworthy</h2>
      <ul>
        <li>Every job post is reviewed by our team before it goes live, and posts must state honest pay that meets the legal minimum.</li>
        <li>Posts stay up for 30 days, and employers can mark a job filled so people stop applying.</li>
        <li>Every job has a <strong>Report this post</strong> button, and we look into each report.</li>
        <li>Employers and jobseekers can choose to <strong>Get Verified</strong> by sending an ID photo and a selfie. We check them, show a Verified badge if they pass, and delete the photos right after our decision.</li>
        <li>Employer contact details are not shown publicly. Jobseekers message employers in the app, and the employer's own contact is shared once a job offer is accepted.</li>
        <li>Chat messages that look like requests for money, fees or one-time codes are flagged with a warning.</li>
      </ul>
      <p>None of this guarantees that any user is honest, so please read our <a href="/safety/">safety tips</a>.</p>
      <h2>Who it is for</h2>
      <p><strong>Jobseekers</strong> looking for work such as kasambahay, yaya, caregiver, cook, driver, retail, food service and office jobs can browse <a href="/jobs/">open jobs</a>. <strong>Employers</strong>, whether a family or a small business, can <a href="/employers/">post a job for free</a>.</p>
      <h2>Contact</h2>
      <p>Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>, message us on <a href="${SUPPORT_MESSENGER}" target="_blank" rel="noopener">Messenger</a>, or visit our <a href="${SUPPORT_FACEBOOK}" target="_blank" rel="noopener">Facebook page</a>. More ways to reach us are on the <a href="/contact/">contact page</a>.</p>`),
});

const how = page({
  path: "/how-it-works/", crumbName: "How it works",
  title: "How Job Search PH Works for Jobseekers and Employers",
  description: "How to find a job or post one on Job Search PH: create a free profile, apply, chat with the employer, and accept a job offer. Free for jobseekers.",
  article: prose("Step by step", "How Job Search PH works", "Free for jobseekers. Free for employers to post.", `
      <h2>For jobseekers</h2>
      <ol>
        <li><strong>Browse jobs.</strong> Search by job title or place, or browse <a href="/jobs/">all open jobs</a>.</li>
        <li><strong>Create a free profile.</strong> Add your contact details, the jobs you want, your experience and skills. You can apply to up to 10 jobs a day.</li>
        <li><strong>Apply.</strong> The employer sees your profile. Applying is always free.</li>
        <li><strong>Chat in the app.</strong> You and the employer message each other on Job Search PH, so neither side has to share a phone number first.</li>
        <li><strong>Accept a job offer.</strong> When an employer picks you, they send a job offer. You are only marked as hired once you accept it, and the employer's own contact is shared with you then.</li>
      </ol>
      <p>Want to hear about new jobs? Turn on <strong>Job alerts by email</strong> in your profile.</p>
      ${cta('<a class="btn btn-primary" href="/#/profile">Create a free profile</a> <a class="btn btn-ghost" href="/jobs/">Browse jobs</a>')}
      <h2>For employers</h2>
      <ol>
        <li><strong>Create a free employer account</strong> and confirm your email.</li>
        <li><strong>Post your job.</strong> Describe the duties, pay, hours and days off. You can post up to 5 jobs a month.</li>
        <li><strong>We review it.</strong> New and edited posts are checked before they go live. A live post stays up for 30 days.</li>
        <li><strong>Review applicants.</strong> Each applicant gets a fit score based on your post, and you can sort by best fit or newest.</li>
        <li><strong>Chat, then send an offer.</strong> Talk to applicants in the app, meet them, and send a job offer to the person you choose.</li>
        <li><strong>Close the post</strong> when the job is filled.</li>
      </ol>
      ${cta('<a class="btn btn-primary" href="/employers/">Post a job for free</a>')}
      <h2>What Job Search PH does not do</h2>
      <p>We don't recruit, screen, place or employ workers, and we never charge placement fees. Hiring decisions, contracts and pay are between the employer and the worker. See our <a href="/terms/">Terms of use</a>.</p>
${contactBox}`),
});

const employers = page({
  path: "/employers/", crumbName: "For employers",
  title: "Post a Job for Free in Bacolod and Negros Occidental",
  description: "Post a job for free and find applicants in Bacolod City and Negros Occidental: kasambahay, yaya, caregiver, driver, cook and more. Posts are reviewed before they go live.",
  article: prose("For employers", "Post a job for free in Bacolod and Negros Occidental", "Families and small businesses use Job Search PH to find household, service and local workers.", `
      ${cta('<a class="btn btn-primary" href="/#/post">Post a job</a> <a class="btn btn-ghost" href="/how-it-works/">How it works</a>')}
      <h2>What you get</h2>
      <ul>
        <li><strong>Free posting.</strong> Post up to 5 jobs a month at no cost. If we add paid options later, the price will be shown before you pay, and nothing already free will become paid without notice.</li>
        <li><strong>Applicants in one place.</strong> See each applicant's profile, with a fit score and the reasons behind it, and sort by best fit or newest.</li>
        <li><strong>Private by default.</strong> Your phone number is not shown publicly. You chat with applicants in the app, and your own contact is shared with the worker you hire once they accept your offer.</li>
        <li><strong>Reviewed posts.</strong> Every post is checked before it goes live, which helps honest employers stand out from scams.</li>
        <li><strong>A Verified badge (optional).</strong> Send an ID photo and a selfie from your profile. If we approve them, a green Verified badge appears on all your posts. We delete the photos right after our decision.</li>
      </ul>
      <h2>Employer guidelines</h2>
      <p>Posts that break these rules are rejected or removed.</p>
      <ul>
        <li>Post only real jobs you will hire for directly.</li>
        <li>State honest pay that meets the legal minimum wage, and never ask applicants for a fee, deposit or deduction.</li>
        <li>Describe the real duties, hours, days off and benefits, and don't change them in a misleading way after people apply.</li>
        <li>Workers must be 18 or older, and requirements must not discriminate (for example by age).</li>
        <li>Do not post for a recruitment agency or for work abroad unless the agency is licensed and shows its license number.</li>
        <li>Follow Philippine labor law. For household workers, the Kasambahay Law (RA 10361) covers a written contract, a weekly rest day, 13th month pay, and SSS, PhilHealth and Pag-IBIG coverage.</li>
        <li>Use applicants' details only for hiring, and keep them private.</li>
      </ul>
      <h2>Tips for a better job post</h2>
      <ul>
        <li><strong>Use a clear title</strong> such as "Live-in yaya for two children" instead of "Hiring".</li>
        <li><strong>Say where and when:</strong> the barangay or area, the schedule, the start date and the days off.</li>
        <li><strong>Be specific about duties</strong> so applicants can decide if the job fits them.</li>
        <li><strong>Show the pay and benefits</strong> up front. Posts with clear pay get more relevant applicants.</li>
        <li><strong>Reply to applicants,</strong> even with a quick "not this time", and close the post when it is filled.</li>
      </ul>
      <p>Read the full <a href="/safety/">safety tips for employers</a> and the <a href="/terms/">Terms of use</a>.</p>
      <h2>Looking for someone specific?</h2>
      <p>See how we help with <a href="/jobs/kasambahay/">kasambahay</a>, <a href="/jobs/yaya/">yaya and nanny</a>, <a href="/jobs/caregiver/">caregiver</a>, <a href="/jobs/cook/">cook</a> and <a href="/jobs/driver/">driver</a> jobs, or browse <a href="/jobs/in/bacolod-city/">jobs in Bacolod City</a>.</p>
${contactBox}`),
});

const safety = page({
  path: "/safety/", crumbName: "Safety tips",
  title: "Jobseeker and Employer Safety Tips",
  description: "Simple safety tips for jobseekers and employers in the Philippines: never pay to get a job, protect your ID, meet safely, and report suspicious posts.",
  article: SAFETY_INTRO("<h1>Safety tips for jobseekers and employers</h1>") + SAFETY_GRID({ showWage: false }) + DANGER_NOTICE.replace(/\n$/, "") +
    `\n        <h2 class="faq-h">Report a suspicious post or message</h2>
        <p>Open the job and tap <strong>Report this post</strong>, or <a href="/contact/">contact us</a> with the details. We review every report and may remove the post or restrict the account. Read more answers in the <a href="/faq/">FAQ</a>.</p>
        <div class="legal-contact"><strong>Need help?</strong> Message us on <a href="${SUPPORT_MESSENGER}" target="_blank" rel="noopener">Messenger</a>, email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>, or use the <a href="/contact/">contact page</a>.</div>
      </article>`,
});

const faqPage = page({
  path: "/faq/", crumbName: "FAQ",
  title: "Frequently Asked Questions",
  description: "Answers about Job Search PH: is it free, is it an agency, how to tell if a job is real, how hiring works, and how to change or delete your profile.",
  article: `    <article class="prose legal">
      <p class="kicker">Help</p>
      <h1>Frequently asked questions</h1>
      <p class="muted">Quick answers for jobseekers and employers. Can't find yours? <a href="/contact/">Contact us</a>.</p>
${FAQS.filter(([, , o]) => !o?.appOnly).map(([q, a]) => `      ${faqEl(q, a)}`).join("\n")}
${contactBox}
    </article>`,
});

const contact = page({
  path: "/contact/", crumbName: "Contact",
  title: "Contact Job Search PH",
  description: "Contact Job Search PH by email or Messenger, report a suspicious job post, or ask for help with your account. Based in Bacolod City, Negros Occidental.",
  article: prose("Contact", "Contact Job Search PH", "We're based in Bacolod City and serve Negros Occidental.", `
      <div class="contact-cards">
        <a class="ccard" href="mailto:${SUPPORT_EMAIL}"><strong>Email us</strong><span>${SUPPORT_EMAIL}</span></a>
        <a class="ccard" href="${SUPPORT_MESSENGER}" target="_blank" rel="noopener"><strong>Message us on Messenger</strong><span>m.me/thejobsearchph</span></a>
        <a class="ccard" href="${SUPPORT_FACEBOOK}" target="_blank" rel="noopener"><strong>Visit our Facebook page</strong><span>facebook.com/thejobsearchph</span></a>
        <a class="ccard" href="/#/support"><strong>Send a message in the app</strong><span>Sign in to send a support request</span></a>
      </div>
      <h2>Report a suspicious job post</h2>
      <p>Open the job and tap <strong>Report this post</strong>. Or email us the link to the job and what looked wrong. Read our <a href="/safety/">safety tips</a> first if someone asked you for money.</p>
      <h2>Privacy requests</h2>
      <p>To see, correct or delete your data, email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>. Details are in our <a href="/privacy/">Privacy policy</a>.</p>
      <div class="notice"><strong>Please don't send</strong> passwords, one-time codes or ID numbers in a message to us. We will never ask for them.</div>`),
});

// Same pages the app shows at #/terms and #/privacy, but at real addresses so they can be linked (for example from a Facebook app).
const hashToAnchor = (html) => html.replace(/href="#" data-sec="(s\d+)"/g, 'href="#$1"');
const terms = page({
  path: "/terms/", crumbName: "Terms",
  title: "Terms of Use",
  description: "The terms for using Job Search PH: a free job listing board that is not an agency or employer. Rules for job posts, accounts, messages and safety.",
  article: hashToAnchor(legalPage(L, TERMS_TITLE, TERMS_INTRO(L), termsSections(L))),
});
const privacy = page({
  path: "/privacy/", crumbName: "Privacy",
  title: "Privacy Policy",
  description: "How Job Search PH collects, uses and protects personal data under the Data Privacy Act of 2012 (RA 10173), who can see it, and how to delete it.",
  article: hashToAnchor(legalPage(L, PRIVACY_TITLE, PRIVACY_INTRO, privacySections(L))),
});

// GitHub Pages serves this for any address that doesn't exist, with a real 404 status. It must stay noindex.
// A job page that was removed (filled, closed or expired) lands here, so say so plainly instead of redirecting home.
const notFound = {
  path: "/404.html",
  html: shell({
    title: "Page not found", description: "This page isn't available. Browse open jobs on Job Search PH.", path: "/404.html", robots: "noindex", canonical: false,
    body: `    <div class="empty empty-hero" id="nf">
      <h1 id="nf-h">Page not found</h1>
      <p class="muted" id="nf-p">We couldn't find that page. It may have moved or never existed.</p>
      <p class="empty-actions"><a class="btn btn-primary" href="/jobs/">Browse open jobs</a> <a class="btn btn-ghost" href="/">Go to Job Search PH</a></p>
      <p class="small muted">Popular: <a href="/jobs/kasambahay/">Kasambahay jobs</a> · <a href="/jobs/yaya/">Yaya jobs</a> · <a href="/jobs/in/bacolod-city/">Jobs in Bacolod City</a> · <a href="/employers/">Post a job</a></p>
    </div>
    <script>if(location.pathname.indexOf("/jobs/")===0){document.title="This job is no longer available | Job Search PH";document.getElementById("nf-h").textContent="This job is no longer available";document.getElementById("nf-p").textContent="The position may have been filled, or the listing period ended. Here are other ways to find work."}</script>`,
  }),
};
export const trustPages = () => [about, how, employers, safety, faqPage, contact, terms, privacy, notFound];
export { UPDATED, TRUST_PAGES };
