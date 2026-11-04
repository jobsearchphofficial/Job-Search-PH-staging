// Builds plain HTML copies of the Privacy and Terms pages, plus a Data deletion page, for Facebook's app review.
const { chromium } = require("playwright"); const fs = require("fs"); const path = require("path");
const ROOT = "/home/claude/job-search-ph";
const V = fs.readFileSync(`${ROOT}/index.html`, "utf8").match(/styles\.css\?v=(\d+)/)[1];
const page = (slug, title, desc, inner) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#3d4fd6">
  <title>${title} | Job Search PH</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="https://jobsearchph.com/${slug}/">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/styles.css?v=${V}">
  <link rel="icon" href="/favicon.ico?v=${V}" sizes="any">
</head>
<body>
  <header class="site-header"><div class="wrap header-inner">
    <a href="/" class="brand" aria-label="Job Search PH home"><img class="brand-mark" src="/assets/img/icon-circle-64.png?v=${V}" alt="" width="38" height="38"><span>Job Search PH</span></a>
    <nav class="nav" style="display:flex"><a href="/#/">Find jobs</a></nav>
  </div></header>
  <main class="wrap" style="padding-block:28px 56px">
${inner}
  </main>
  <footer class="site-footer"><div class="wrap"><p class="small muted"><strong>Job Search PH</strong> is a job listing board. We do not recruit, screen or place workers, and we never charge jobseekers.</p>
    <p class="small"><a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a> · <a href="/data-deletion/">Delete your data</a> · <a href="/#/support">Contact support</a></p></div></footer>
</body>
</html>
`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  for (const [slug, title, desc] of [["privacy", "Privacy notice", "What Job Search PH collects, why, and how to delete it."], ["terms", "Terms of use", "The rules for using Job Search PH."]]) {
    await p.goto(`http://localhost:8000/#/${slug}`); await p.waitForSelector("#app article, #app .prose", { timeout: 15000 }); await p.waitForTimeout(500);
    let html = await p.locator("#app").innerHTML();
    html = html.replace(/href="#\//g, 'href="/#/').replace(/href="\/#\/privacy"/g, 'href="/privacy/"').replace(/href="\/#\/terms"/g, 'href="/terms/"');
    fs.mkdirSync(`${ROOT}/${slug}`, { recursive: true });
    fs.writeFileSync(`${ROOT}/${slug}/index.html`, page(slug, title, desc, html));
    console.log(slug, html.length);
  }
  fs.mkdirSync(`${ROOT}/data-deletion`, { recursive: true });
  fs.writeFileSync(`${ROOT}/data-deletion/index.html`, page("data-deletion", "Delete your data", "How to delete your Job Search PH account and data, including data from Facebook or Google sign-in.", `
    <article class="prose legal">
      <p class="kicker">Your data</p>
      <h1>Delete your account and data</h1>
      <p class="muted">You can delete your Job Search PH account and the information connected to it at any time. This includes anything we received when you signed in with Facebook or Google (your name, email and profile picture).</p>
      <h2>Delete it yourself (fastest)</h2>
      <ol>
        <li>Go to <a href="https://jobsearchph.com/">jobsearchph.com</a> and sign in.</li>
        <li>Open <strong>My profile</strong>.</li>
        <li>At the bottom, tap <strong>Delete my account</strong>, or go straight to <a href="/#/delete-account">jobsearchph.com/#/delete-account</a>.</li>
        <li>Confirm. Your profile, job posts, applications, notifications and sign-in are deleted right away. Chats are closed and their messages are deleted after 30 days.</li>
      </ol>
      <h2>Ask us to delete it</h2>
      <p>If you can't sign in, email <a href="mailto:support@jobsearchph.com?subject=Delete%20my%20data">support@jobsearchph.com</a> from the email on your account, or message our <a href="https://www.facebook.com/thejobsearchph/">Facebook page</a>. We delete your data within 30 days and reply when it's done.</p>
      <h2>Removing Job Search PH from Facebook</h2>
      <p>To stop Facebook sharing your information with us, open Facebook → <strong>Settings &amp; privacy</strong> → <strong>Settings</strong> → <strong>Apps and websites</strong>, find Job Search PH and tap <strong>Remove</strong>. Then delete your account here as described above.</p>
      <p class="muted small">See also our <a href="/privacy/">Privacy notice</a>.</p>
    </article>`));
  console.log("data-deletion ok");
  await b.close();
})();
