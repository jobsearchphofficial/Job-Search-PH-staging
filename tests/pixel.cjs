const { chromium } = require("playwright");
(async () => { const b = await chromium.launch();
  const run = async (answer) => {
    const ctx = await b.newContext({ viewport: { width: 420, height: 860 } }); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    let fbReq = 0; await p.route("**/connect.facebook.net/**", (r) => { fbReq++; r.abort(); });
    await p.goto("http://localhost:8000/#/"); await p.waitForSelector("#ads-consent", { timeout: 15000 });
    if (answer === "yes") await p.screenshot({ path: `${process.argv[2]}/consent.png` });
    await p.click(`#ads-consent [data-c=${answer}]`); await p.waitForTimeout(500);
    await p.evaluate(() => { location.hash = "#/job/abc"; }); await p.waitForTimeout(300);
    await p.evaluate(() => { location.hash = "#/chat/job_uid123"; }); await p.waitForTimeout(300);
    await p.evaluate(() => { location.hash = "#/profile"; }); await p.waitForTimeout(300);
    const q = await p.evaluate(() => (window.fbq?.queue || []).map((a) => [...a].slice(0, 3).map(String).join(" ")));
    await p.reload(); await p.waitForTimeout(2500);
    console.log(answer, "| script requests:", fbReq, "| fbq calls:", JSON.stringify(q), "| banner after reload:", await p.locator("#ads-consent").count(), "| footer link shown:", await p.locator("#consent-link").isVisible(), "| errors:", errs.length ? errs : "none");
    await ctx.close();
  };
  await run("no"); await run("yes"); await b.close(); })();
