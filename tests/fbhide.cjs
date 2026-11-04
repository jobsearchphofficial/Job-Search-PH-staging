const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await p.goto("http://localhost:8000/?emu#/join/jobseeker"); await p.waitForSelector(".su-role");
  console.log("facebook button:", await p.locator("#facebook").count(), "| google button:", await p.locator("#google").count(), "| signup form ok:", await p.locator("[name=firstName]").count());
  await p.click("#toggle"); await p.waitForTimeout(300); console.log("sign-in mode facebook button:", await p.locator("#facebook").count());
  await b.close();
})();
