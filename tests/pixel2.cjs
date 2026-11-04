const { chromium } = require("playwright");
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.route("**/connect.facebook.net/**", (r) => r.abort());
  await p.goto("http://localhost:8000/#/"); await p.waitForSelector("#ads-consent");
  await p.click("#ads-consent [data-c=yes]"); await p.waitForTimeout(300);
  await p.evaluate(() => { const orig = window.fbq; window.__log = []; window.fbq = function (...a) { if (a[0] === "track") window.__log.push(a[1] + " @ " + (location.hash || "#/")); return orig.apply(this, a); }; });
  for (const h of ["#/job/abc", "#/chat/job_uid123", "#/messages", "#/profile", "#/admin", "#/privacy"]) { await p.evaluate((h) => { location.hash = h; }, h); await p.waitForTimeout(700); }
  console.log(await p.evaluate(() => window.__log)); await b.close(); })();
