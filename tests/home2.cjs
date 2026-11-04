const { chromium } = require("playwright");
(async () => { const b = await chromium.launch();
  for (const [w, h, tag] of [[1280, 900, "desk"], [390, 900, "mob"]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto("http://localhost:8000/#/"); await p.waitForSelector(".msel", { timeout: 20000 }); await p.waitForTimeout(3000);
    await p.click('[data-msel="category"] .msel-btn'); await p.click('[data-msel="category"] .msel-opt[data-v="Driver"]'); await p.waitForTimeout(300);
    const r1 = await p.locator("#count").innerText();
    await p.click('[data-msel="category"] .msel-btn'); await p.click('[data-msel="category"] .msel-opt[data-v="Yaya / Nanny"]'); await p.waitForTimeout(300);
    console.log(tag, "| chips row:", await p.locator(".cat-chips").count(), "| Driver:", r1, "| Yaya:", await p.locator("#count").innerText(), "| errors:", errs.length ? errs : "none");
    await p.click("#active-filters [data-clear=all]"); await p.waitForTimeout(800);
    await p.screenshot({ path: `${process.argv[2]}/home2-${tag}.png`, clip: tag === "desk" ? { x: 0, y: 380, width: 1280, height: 520 } : { x: 0, y: 500, width: 390, height: 400 } });
    await p.close();
  } await b.close(); })();
