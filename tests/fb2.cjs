const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.goto("http://localhost:8000/?emu#/signin"); await p.waitForTimeout(2500);
  const [pop] = await Promise.all([ctx.waitForEvent("page"), p.click("#facebook")]);
  await pop.waitForTimeout(3000);
  console.log("URL:", pop.url().slice(0,120));
  console.log((await pop.locator("body").innerText()).slice(0, 600));
  console.log(await pop.locator("button, a, input").evaluateAll((els) => els.map((e) => e.tagName + ":" + (e.id || "") + ":" + (e.innerText || e.value || "").slice(0, 40)).join(" | ")));
  await b.close();
})();
