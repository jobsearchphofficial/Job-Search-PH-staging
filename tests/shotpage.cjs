const { chromium } = require("playwright");
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
  for (const u of ["privacy", "data-deletion"]) { const r = await p.goto(`http://localhost:8000/${u}/`); console.log(u, r.status(), await p.locator("h1").first().innerText()); await p.screenshot({ path: `${process.argv[2]}/static-${u}.png` }); }
  await b.close(); })();
