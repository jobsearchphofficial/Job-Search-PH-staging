const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 420, height: 860 } })).newPage(); p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await p.goto("http://localhost:8000/?emu#/"); await p.waitForTimeout(2000);
  const v = await p.evaluate(() => [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]);
  await p.evaluate(async ({ v }) => { const m = await import(`/assets/store.js?v=${v}`); await m.store.signUpEmail(`so${Date.now()}@example.com`, "secret123", "Ana Reyes"); await new Promise((r) => setTimeout(r, 1200)); await m.store.saveProfile({ role: "jobseeker", fullName: "Ana Reyes", phone: "09170000002", city: "Bacolod City", birthDate: "1995-01-01", jobCategories: ["Yaya / Nanny"], jobTypes: [] }); }, { v });
  const codes = await (await fetch("http://127.0.0.1:9099/emulator/v1/projects/demo-jsph/oobCodes")).json();
  for (const c of codes.oobCodes.filter((c) => c.requestType === "VERIFY_EMAIL")) await fetch(c.oobLink);
  await p.evaluate(async ({ v }) => (await import(`/assets/store.js?v=${v}`)).store.refreshVerified(), { v });
  await p.goto("http://localhost:8000/?emu#/messages"); await p.waitForTimeout(2500);
  let loads = 0; p.on("load", () => loads++);
  await p.click("#gear-btn, .gear-btn, [aria-label*=Settings]").catch(() => {});
  await p.waitForTimeout(500);
  await p.click("[data-action=signout]"); await p.waitForTimeout(3500);
  console.log("full reload:", loads >= 1, "| url:", await p.evaluate(() => location.hash), "| h1:", await p.locator("h1").first().innerText());
  await p.screenshot({ path: "../signed-out.png" });
  await b.close();
})();
