const { chromium } = require("playwright");
const V = (p) => p.evaluate(() => [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]);
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage(); p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await p.goto("http://localhost:8000/?emu#/"); await p.waitForTimeout(2000);
  await p.evaluate(async ({ v }) => { const m = await import(`/assets/store.js?v=${v}`); await m.store.signUpEmail(`fbf${Date.now()}@example.com`, "secret123", "Ana"); await new Promise((r) => setTimeout(r, 1200)); await m.store.saveProfile({ role: "jobseeker", fullName: "Ana Reyes", phone: "09170000002", city: "Bacolod City", birthDate: "1995-01-01", jobCategories: ["Yaya / Nanny"], jobTypes: [] }); }, { v: await V(p) });
  await p.goto("http://localhost:8000/?emu#/profile"); await p.reload(); await p.waitForSelector("[name=messenger]", { timeout: 15000 });
  console.log("label:", (await p.locator("label:has([name=messenger])").innerText()).split("\n")[0]);
  await p.fill("[name=messenger]", "facebook.com/ana.reyes"); await p.getByRole("button", { name: /Save/ }).first().click(); await p.waitForTimeout(2000);
  console.log("saved:", await p.evaluate(async ({ v }) => (await import(`/assets/store.js?v=${v}`)).getAuthState().profile.messenger, { v: await V(p) }));
  await b.close();
})();
