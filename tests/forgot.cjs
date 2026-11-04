const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 860 } }); p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  let calls = 0; p.on("request", (r) => { if (r.url().includes("/email/reset")) calls++; });
  await p.goto("http://localhost:8000/?emu#/signin"); await p.waitForSelector("#forgot");
  await p.fill("#s-email", `nobody${Date.now()}@example.com`); await p.click("#forgot"); await p.waitForSelector(".dlg-backdrop");
  console.log("dialog:", (await p.locator(".dlg-backdrop").innerText()).replace(/\s+/g, " ").slice(0, 160), "| sent before confirm:", calls);
  await p.screenshot({ path: "../forgot-dialog.png" });
  await p.getByRole("button", { name: "Cancel" }).click(); await p.waitForTimeout(500); console.log("after cancel, sent:", calls);
  await p.click("#forgot"); await p.getByRole("button", { name: "Send reset link" }).click(); await p.waitForTimeout(1500); console.log("after confirm, sent:", calls);
  await p.click("#forgot"); await p.getByRole("button", { name: "Send reset link" }).click(); await p.waitForTimeout(1500);
  console.log("second within a minute:", await p.locator("#auth-error").innerText());
  await b.close();
})();
