// Shared page content: used by the app (hash routes like #/terms) and by the static page
// builder (scripts/build-job-pages.mjs → /terms/, /privacy/, /safety/, /faq/).
// Keep it free of browser APIs so Node can import it. L(name) turns a page name into a link.
export const SUPPORT_EMAIL = "jobsearchph.official@gmail.com";
export const SUPPORT_MESSENGER = "https://m.me/thejobsearchph";
export const SUPPORT_FACEBOOK = "https://www.facebook.com/thejobsearchph/";
export const UPDATED = "October 26, 2026";
export function legalPage(L, title, intro, sections) {
  return `
    <article class="prose legal">
      <p class="kicker">Job Search PH</p>
      <h1>${title}</h1>
      <p class="muted">${intro}</p>
      <p class="legal-meta"><span>Last updated: ${UPDATED}</span><span>Republic of the Philippines</span></p>
      <nav class="toc" aria-label="Contents"><strong>Contents</strong><ol>${sections.map(([h], i) => `<li><a href="#" data-sec="s${i + 1}">${h}</a></li>`).join("")}</ol></nav>
      ${sections.map(([h, body], i) => `<section id="s${i + 1}"><h2><span class="sec-n">${String(i + 1).padStart(2, "0")}</span>${h}</h2>${body}</section>`).join("")}
      <div class="legal-contact"><strong>Questions?</strong> Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>, message us on <a href="${SUPPORT_MESSENGER}" target="_blank" rel="noopener">Messenger</a> (<a href="${SUPPORT_FACEBOOK}" target="_blank" rel="noopener">facebook.com/thejobsearchph</a>), or use <a href="${L("support")}">Contact support</a>. We're based in Bacolod City and serve Negros Occidental.</div>
    </article>`;
}
export const faqEl = (q, a) => `<details class="faq"><summary>${q}</summary><div>${a}</div></details>`;
export const SAFETY_INTRO = (titleHtml) => `
      <article class="prose legal">
        <p class="kicker">Stay safe</p>
        ${titleHtml}
        <p class="muted">Most people on Job Search PH are honest. These simple habits keep it that way for everyone.</p>
`;
export const SAFETY_GRID = ({ showWage = true } = {}) => `
        <div class="tip-grid">
          <section class="tip-card">
            <h2>For jobseekers</h2>
            <ul class="tips">
              <li><strong>Never pay to get a job.</strong> No real employer asks for a processing, training, medical, uniform or "reservation" fee. Under the Kasambahay Law, household workers can't be charged placement fees.</li>
              <li><strong>Keep your IDs and money safe.</strong> Don't send ID photos, bank, GCash or OTP codes before an interview, and never send money to an employer.</li>
              ${showWage
                ? `<li><strong>Check the pay.</strong> Every job here must pay at least the legal minimum. In Negros Occidental, that's ₱6,500 a month for household workers.</li>`
                : `<li><strong>Check the pay.</strong> Every job here must pay at least the legal minimum. Ask the employer how pay is computed and when it is paid.</li>`}
              <li><strong>Talk here first.</strong> Use the chat on Job Search PH until you trust the employer. It keeps a record if something goes wrong.</li>
              <li><strong>Meet safely.</strong> Go to the first interview in daytime, tell family the address, or bring someone you trust.</li>
              <li><strong>Get it in writing.</strong> Ask for a written contract with pay, hours, days off and benefits (SSS, PhilHealth, Pag-IBIG once covered).</li>
              <li><strong>Be suspicious of offers that are too good.</strong> Very high pay, "start today, no interview", or jobs abroad from someone without a DMW license are red flags.</li>
              <li><strong>Show up or say so.</strong> If you can't make an interview, message the employer as early as you can. It protects your reputation on the site.</li>
            </ul>
          </section>
          <section class="tip-card">
            <h2>For employers</h2>
            <ul class="tips">
              <li><strong>Meet before you hire.</strong> Interview in person or by video call, and check references from past employers.</li>
              <li><strong>Check documents yourself.</strong> Ask for a valid ID and barangay or NBI clearance during the interview, not by chat to strangers.</li>
              <li><strong>Never ask applicants for money</strong> or deductions to apply or be hired. It's against our rules and the Kasambahay Law.</li>
              <li><strong>Be clear and honest.</strong> Post the real pay, hours, days off and duties. Changing them after people apply wastes everyone's time.</li>
              <li><strong>Follow the law.</strong> Pay at least the minimum wage, give a weekly rest day, register household workers with SSS, PhilHealth and Pag-IBIG, and give a written contract.</li>
              <li><strong>Keep applicants' details private.</strong> Use them only for hiring and don't share them.</li>
              <li><strong>Reply to applicants.</strong> Even a quick "not this time" helps people move on.</li>
              <li><strong>Close the post when it's filled</strong> so jobseekers don't keep applying.</li>
            </ul>
          </section>
        </div>
`;
export const DANGER_NOTICE = `
        <div class="notice"><strong>In danger or being forced to work?</strong> Call <strong>911</strong> or the PNP right away. For labor complaints, contact DOLE Negros Occidental, or the DOLE hotline <strong>1349</strong>.</div>
`;
// [question, answer, {appOnly}]: appOnly items are not copied to the public /faq/ page.
export const FAQS = [
  ["Is Job Search PH free?", "Yes. Creating a profile, searching and applying are free for jobseekers, always. Posting a job is free for employers.",],
  ["Is Job Search PH a recruitment agency?", "No. We're an online job listing board. Employers post their own jobs and hire directly. We don't recruit, screen, place or employ anyone, and we never charge placement fees.",],
  ["How do I know a job is real?", "Every post is reviewed before it goes live and must meet the legal minimum wage. Still, trust your instincts: if an employer asks for money, pushes you to leave the site quickly, or the details keep changing, stop and report the post.",],
  ["Why can't I see the employer's phone number?", "To protect both sides from spam and scams, you talk to employers through Messages here on Job Search PH. The employer's own contact is shared with you once you accept their job offer.",],
  ["Someone asked me for money. What do I do?", "Don't pay. Tap <strong>Report this post</strong> on the job, or contact support with the details. We'll review it and may remove the post or restrict the account.",],
  ["How many jobs can I apply to?", "Up to 10 a day. Employers can post up to 5 jobs a month. These limits stop spam and keep the site fair.",],
  ["Why did my chat close?", "If an employer chooses other applicants, the chat stays open for 48 hours so you can say goodbye or ask questions, then it closes. You can still read old messages.",],
  ["How does hiring work?", "When an employer picks you, they send a <strong>job offer</strong>. You'll get a notification and can <strong>Accept</strong> or <strong>Decline</strong> it from the job page, My applications, or the chat. You're only marked as hired once you accept. If you decline, the employer is told and the chat closes after 48 hours.",],
  ["How do I leave a job I got here?", "Go to <strong>My applications</strong> and tap <strong>Leave this job</strong>. Your employer confirms, and then you can apply to full-time jobs again. Employers can also start this from the applicant card.",],
  ["What's the minimum pay for a kasambahay?", "In Negros Occidental (Western Visayas), it's ₱6,500 a month, effective November 19, 2025. Employers must also give a weekly rest day and 13th month pay.", { appOnly: true }],
  ["How do I change or delete my profile?", "Open the gear menu → <strong>My profile</strong>. You can edit everything there, or tap <strong>Delete my profile</strong>. To delete your whole account, email us.",],
  ["I'm under 18. Can I use the site?", "Not yet. Job Search PH is only for people 18 and older.",],
];
export const SAFETY_CONTACT = (L) => `
        <div class="legal-contact"><strong>Still need help?</strong> Message us on <a href="${SUPPORT_MESSENGER}" target="_blank" rel="noopener">Messenger</a>, email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>, or <a href="${L("support")}">contact support</a>.</div>
`;
export const TERMS_TITLE = "Terms of use";
export const TERMS_INTRO = (L) => `Please read these terms before using Job Search PH. By creating an account or using the site, you agree to them and to our <a href="${L("privacy")}">Privacy policy</a>.`;
export const termsSections = (L) => [
        ["What Job Search PH is", `<p>Job Search PH ("JSPH", "we", "us") is an online job listing board that connects employers and jobseekers in Negros Occidental, Philippines. Employers post jobs, jobseekers apply with their profiles, and both sides talk directly.</p>
          <div class="callout"><strong>We are not an agency or an employer.</strong> We don't recruit, screen, endorse, place, employ, supervise or manage anyone, and we're not a party to any job agreement made between users.</div>`],
        ["Free to use", `<ul><li>Searching and applying for jobs is free for jobseekers. <strong>We never charge jobseekers</strong>, in line with the Domestic Workers Act (RA 10361).</li><li>Posting a job is currently free for employers.</li><li>If we add optional paid features for employers later (for example, featured posts), the price will be shown clearly before you pay, and nothing already free will become paid without notice.</li><li>We don't charge placement fees.</li></ul>`],
        ["Your account", `<ul><li>You must be at least 18 years old.</li><li>Give true, current information. Use your real name and a mobile number you can be reached on.</li><li>Use one account per person. Don't create accounts to get around limits or restrictions.</li><li>Keep your password safe. You're responsible for what happens on your account.</li></ul>`],
        ["Job post rules", `<p>Employers agree that every post:</p><ul><li>Is a real, current job they will hire for directly;</li><li>Pays at least the legal minimum wage and states the pay honestly;</li><li>Never asks applicants for any fee, deposit or deduction to apply or be hired;</li><li>Is only for workers aged 18 and older;</li><li>Has accurate duties, hours, days off and benefits, and isn't changed in a misleading way after people apply;</li><li>Doesn't include discriminatory requirements, such as age limits (Anti-Age Discrimination Act, RA 10911);</li><li>Isn't posted on behalf of a recruitment agency or for work abroad unless the agency is licensed by DOLE or DMW and the license number is included.</li></ul><p>Posts are reviewed before going live and stay up for 30 days. We may reject, edit, close or remove any post.</p>`],
        ["Employer responsibilities", `<ul><li>Interview applicants and make your own hiring decisions;</li><li>Follow Philippine labor law, including the Kasambahay Law: minimum wage, weekly rest day, 13th month pay, a written contract, and SSS, PhilHealth and Pag-IBIG registration;</li><li>Provide safe, humane and respectful working conditions;</li><li>Use applicants' personal details only to consider them for your job, and don't share them.</li></ul><p>JSPH isn't responsible for employer decisions, pay disputes, working conditions or private agreements.</p>`],
        ["Jobseeker responsibilities", `<ul><li>Give truthful information in your profile and applications;</li><li>Apply only to jobs you're genuinely interested in;</li><li>Communicate politely and honor interviews and job commitments, or tell the employer early if you can't;</li><li>Use "Leave this job" when a job ends so records stay accurate.</li></ul><p>JSPH isn't responsible for false information given by jobseekers or for their behavior or work performance.</p>`],
        ["Messages and conduct", `<ul><li>Keep chats about the job. No harassment, threats, hate speech, sexual content, or requests for money or sensitive personal data.</li><li>Chats with applicants who weren't selected close 48 hours after the decision.</li><li>To prevent spam, there are daily limits on applications, posts, messages and reports.</li><li>We may review chats when investigating a report.</li></ul>`],
        ["Reviews, reports and moderation", `<p>We review job posts and look into reports, but we can't check every user or guarantee anything they say. We may warn, restrict, suspend or remove accounts and posts for fraud, misrepresentation, abuse, spam or breaking these terms. If you think we made a mistake, <a href="${L("support")}">contact support</a> to appeal.</p>`],
        ["Safety and risk", `<p>We don't supervise or control users. By using JSPH, you agree that:</p><ul><li>JSPH isn't liable for theft, loss, damage, injury, harassment, abuse or misconduct by any user;</li><li>Any job arrangement is made at your own risk;</li><li>Employers should do their own checks, and jobseekers should judge whether an employer is safe and legitimate.</li></ul><div class="callout">JSPH isn't a party to any relationship or agreement between an employer and a jobseeker, and accepts no liability for any dispute, loss or harm between them, on or off the platform.</div><p>Read our <a href="${L("safety")}">Safety tips</a>.</p>`],
        ["No guarantee", `<ul><li>We don't guarantee that jobseekers will be hired or that employers will find workers.</li><li>We don't guarantee any user's identity, behavior, reliability or performance.</li></ul>`],
        ["Off-platform communication", `<p>Anything arranged outside Job Search PH, such as calls, texts, Messenger or meetings, is the responsibility of the people involved.</p>`],
        ["Limitation of liability", `<p>To the fullest extent the law allows, JSPH isn't liable for employment disputes, financial losses, damages caused by users, or job performance. If we are found liable, our total liability is limited to the amount you paid JSPH in the 12 months before the claim, if any.</p>`],
        ["Service availability", `<p>We try to keep the site running, but we don't guarantee it will always be available or error-free. We're not liable for delays or failures caused by events beyond our control, such as natural disasters, power or internet outages.</p>`],
        ["Intellectual property", `<p>The Job Search PH name, logo, design and site content belong to Job Search PH. Don't copy or use them without permission. You keep ownership of what you post, and you let us display it on the site to run the service.</p>`],
        ["Changes to these terms", `<p>We may update these terms. We'll announce important changes on the site. Continuing to use JSPH after changes take effect means you accept them.</p>`],
        ["Governing law", `<p>These terms are governed by the laws of the Republic of the Philippines. Disputes will be brought before the proper courts of Negros Occidental.</p>`],
];
export const PRIVACY_TITLE = "Privacy policy";
export const PRIVACY_INTRO = "How Job Search PH collects, uses and protects your personal data, in line with the Data Privacy Act of 2012 (RA 10173) and the rules of the National Privacy Commission.";
export const privacySections = (L) => [
        ["Data we collect", `<ul><li><strong>Account:</strong> your email and sign-in method (Google, Facebook, or email and password). If you use Facebook, we only receive your name, email and profile picture, and we never post to your Facebook.</li><li><strong>Jobseeker profile:</strong> name, photo (optional), birthdate (we show employers your age, not your birthdate), gender, mobile number, city, Messenger, jobs wanted, experience, skills, work history, education and resume link.</li><li><strong>Employer profile:</strong> name, photo (optional), household or business name, mobile number, city and Messenger.</li><li><strong>Activity on the site:</strong> job posts, applications, chat messages, interview and hiring status, notifications, reports and support messages.</li><li><strong>Get Verified (optional, for employers and jobseekers):</strong> a photo of your ID and a selfie holding it. They're stamped "Job Search PH · verification only" on your device before sending, and their location and camera details are removed. Only Job Search PH admins see them, only to confirm you're a real person. They're deleted as soon as we approve or reject, or after 14 days if we haven't. We keep only that you were verified, the type of ID and the date.</li><li><strong>Anti-spam counters:</strong> how many applications, posts, messages and reports you sent today.</li><li><strong>On your device only:</strong> your light or dark mode choice.</li></ul><p>We don't use advertising trackers, and we don't sell your data.</p>`],
        ["Why we use it", `<ul><li>To run your account and show your posts, applications and messages;</li><li>To share your profile with employers you apply to, and employer contact details with the worker they hire;</li><li>To review job posts, prevent spam, fraud and abuse, and handle reports and appeals;</li><li>To reply to support requests and improve the site;</li><li>If you turn on job alerts, to email you new jobs that match the jobs and city on your profile. Emails are sent through our email provider, Resend. Unsubscribe with the link in any email or in My profile.</li></ul>`],
        ["Who can see it", `<ul><li><strong>Everyone:</strong> live job posts (title, employer or household name, area, pay and details). Employer contact details are not public.</li><li><strong>Employers you apply to:</strong> your profile, photo, age, contact details, message, experience and resume.</li><li><strong>The worker you hire:</strong> the employer contact you entered on the post, once they accept your job offer.</li><li><strong>The person you're chatting with:</strong> your messages.</li><li><strong>Job Search PH admins:</strong> all data, only to run and keep the site safe.</li><li><strong>Service provider:</strong> the site runs on Google Firebase, which stores data for us under its own security and privacy terms.</li></ul><p>We may also disclose data when the law requires it, such as a lawful order from the authorities.</p>`],
        ["How long we keep it", `<ul><li>Your profile stays until you delete it.</li><li>Job posts expire after 30 days and stay in your account until removed.</li><li>Applications and chats stay so both sides can refer back to them. Chats with declined applicants close after 48 hours but remain readable.</li><li>Reports and safety records are kept as long as needed to protect users, then deleted.</li></ul>`],
        ["How we protect it", `<p>Data is stored on Google Firebase with access rules that let each person see only what they're allowed to. Admin access is limited to authorized Job Search PH staff. No system is perfectly secure, so please use a strong password and keep it private.</p>`],
        ["Your rights", `<p>Under the Data Privacy Act, you can:</p><ul><li>Ask what data we have about you and get a copy;</li><li>Correct wrong information (most of it you can edit in My profile);</li><li>Delete your profile (My profile → Delete my profile) or ask us to delete your whole account;</li><li>Object to how we use your data, or withdraw consent;</li><li>File a complaint with the National Privacy Commission (privacy.gov.ph).</li></ul><p>To make a request, email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>`],
        ["Age limit", `<p>Job Search PH is for people 18 and older. We don't knowingly collect data from anyone younger. If you think a minor has an account, tell us and we'll remove it.</p>`],
        ["Changes to this policy", `<p>We may update this policy. We'll post the new version here with a new date, and announce important changes on the site.</p>`],
];

// The three pages the app has always had (#/safety, #/terms, #/privacy), unchanged.
export function appPages(L) {
  const faq = faqEl;
  return {
    safety: {
      title: "Safety tips & FAQs",
      html: SAFETY_INTRO("<h1>Safety tips &amp; FAQs</h1>") + SAFETY_GRID({ showWage: true }) + DANGER_NOTICE +
        `\n        <h2 class="faq-h">Frequently asked questions</h2>\n` + FAQS.map(([q, a]) => `        ${faq(q, a)}`).join("\n") + `\n` + SAFETY_CONTACT(L) + `</article>`,
    },
    terms: { title: TERMS_TITLE, html: legalPage(L, TERMS_TITLE, TERMS_INTRO(L), termsSections(L)) },
    privacy: { title: PRIVACY_TITLE, html: legalPage(L, PRIVACY_TITLE, PRIVACY_INTRO, privacySections(L)) },
  };
}
