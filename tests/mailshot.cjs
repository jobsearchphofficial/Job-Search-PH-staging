const { chromium } = require("playwright"); const fs = require("fs");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 760, height: 900 } });
  for (const [f, out] of process.argv.slice(2).map((x) => x.split("="))) {
    await p.goto("file://" + f); await p.waitForTimeout(500); await p.screenshot({ path: out, fullPage: true });
  }
  await b.close();
})();
