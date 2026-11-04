const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8000/?emu#/signin");
  await p.waitForSelector("#facebook", { timeout: 15000 }).catch(() => {});
  console.log("fb button:", await p.locator("#facebook").isVisible());
  await p.waitForTimeout(1500);
  console.log("auth-error shown:", await p.locator("#auth-error").isVisible());
  await p.screenshot({ path: "../signin-fb.png" });
  console.log("errors:", errs); await b.close();
})();
