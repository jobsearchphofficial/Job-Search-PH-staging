const { chromium } = require("playwright");
(async () => { const b = await chromium.launch();
  for (const [w, h, tag] of [[1280, 900, "desk"], [390, 860, "mob"]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto("http://localhost:8000/#/"); await p.waitForSelector(".jrow, .jlist .empty", { timeout: 20000 }); await p.waitForTimeout(2500);
    await p.screenshot({ path: `${process.argv[2]}/rd-${tag}.png`, fullPage: true });
    console.log(tag, "errors:", errs.length ? errs : "none"); await p.close();
  } await b.close(); })();
