const { chromium } = require("playwright");
(async () => { const b = await chromium.launch();
  for (const [w, h, tag] of [[1280, 1000, "desk"], [390, 900, "mob"]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto("http://localhost:8000/#/"); await p.waitForSelector(".msel", { timeout: 20000 }); await p.waitForTimeout(3500);
    await p.screenshot({ path: `${process.argv[2]}/home-${tag}.png`, fullPage: tag === "mob" });
    await p.click('[data-msel="minPay"] .msel-btn'); await p.waitForTimeout(300);
    if (tag === "desk") await p.screenshot({ path: `${process.argv[2]}/home-pay-open.png`, clip: { x: 600, y: 700, width: 680, height: 300 } });
    await p.click('[data-msel="minPay"] .msel-opt[data-v="10000"]'); await p.waitForTimeout(400);
    console.log(tag, "| stats:", await p.locator(".hero-stats").innerText(), "| pay btn:", await p.locator('[data-msel="minPay"] .msel-btn').innerText(), "| count:", await p.locator("#count").innerText(), "| chips:", await p.locator("#active-filters").innerText(), "| errors:", errs.length ? errs : "none");
    await p.close();
  } await b.close(); })();
