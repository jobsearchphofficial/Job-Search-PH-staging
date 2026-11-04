const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 900 } }); p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await p.goto("http://localhost:8000/?emu#/join/employer"); await p.waitForSelector("#s-pw2");
  await p.fill("[name=firstName]", "Rea"); await p.fill("[name=lastName]", "Alvarez"); await p.fill("#s-email", `pw${Date.now()}@example.com`);
  await p.fill("#s-pw", "secret123"); await p.fill("#s-pw2", "secret12");
  console.log("mismatch:", await p.locator("#pw-match").innerText(), await p.getAttribute("#s-pw2", "class"));
  await p.click("#email-form button[type=submit]"); console.log("submit blocked:", await p.locator("#auth-error").innerText());
  await p.screenshot({ path: "../pw-bad.png", clip: { x: 0, y: 380, width: 420, height: 420 } });
  await p.fill("#s-pw2", "secret123"); console.log("match:", await p.locator("#pw-match").innerText(), await p.getAttribute("#s-pw2", "class"));
  await p.screenshot({ path: "../pw-ok.png", clip: { x: 0, y: 380, width: 420, height: 420 } });
  await p.click("#email-form button[type=submit]"); await p.waitForSelector(".ce-card", { timeout: 15000 }); console.log("created -> confirm screen ok");
  await b.close();
})();
