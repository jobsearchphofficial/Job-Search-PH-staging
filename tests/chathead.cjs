const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 300 } });
  await p.goto("http://localhost:8000/?emu#/"); await p.waitForTimeout(1500);
  await p.evaluate(() => { document.querySelector("#app").innerHTML = `<div class="chat-wrap"><header class="chat-head"><a class="back">←</a><span class="avatar">B</span><div class="chat-who"><span class="chat-name"><strong>BaseOps</strong><span class="vbadge short">✓ Verified</span><span class="fbadge short">★ Founder</span></span><span class="muted small"><a href="#">Live-in Kasambahay</a></span></div><span class="badge">Sent</span></header></div>`; });
  await p.locator(".chat-head").screenshot({ path: "../chathead.png" }); await b.close();
})();
