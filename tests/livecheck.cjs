const { chromium } = require("playwright");
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 860 } }); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto("https://jobsearchph.com/#/join/jobseeker"); await p.waitForSelector(".su-role", { timeout: 20000 });
  console.log("signup form:", await p.locator("[name=firstName]").count(), "| confirm pw:", await p.locator("#s-pw2").count(), "| facebook button (should be 0):", await p.locator("#facebook").count());
  await p.goto("https://jobsearchph.com/#/"); await p.waitForTimeout(3000); console.log("home jobs shown:", await p.locator(".job-card, .jcard, article").count());
  console.log("errors:", errs.length ? errs.slice(0, 5) : "none"); await b.close(); })();
