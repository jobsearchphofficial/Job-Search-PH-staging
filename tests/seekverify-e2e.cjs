const { chromium } = require("playwright");
const FS = "http://127.0.0.1:8085/v1/projects/demo-jsph/databases/(default)/documents";
const H = { authorization: "Bearer owner", "content-type": "application/json" };
const getDoc = async (path) => (await fetch(`${FS}/${path}`, { headers: H })).json();
const V = (p) => p.evaluate(() => [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
  const p = await ctx.newPage(); p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await p.goto("http://localhost:8000/?emu#/"); await p.waitForTimeout(2000);
  const email = `seekv${Date.now()}@example.com`;
  const uid = await p.evaluate(async ({ v, email }) => { const m = await import(`/assets/store.js?v=${v}`); await m.store.signUpEmail(email, "secret123", "Ana"); await new Promise((r) => setTimeout(r, 1200)); await m.store.saveProfile({ role: "jobseeker", fullName: "Ana Reyes", phone: "09170000002", city: "Bacolod City", birthDate: "1995-01-01", jobCategories: ["Yaya / Nanny"], jobTypes: [] }); return m.getAuthState().user.uid; }, { v: await V(p), email });
  // 1. email-settings link
  await p.goto("http://localhost:8000/?emu#/profile/emails"); await p.reload(); await p.waitForSelector("#pf-emails", { timeout: 15000 }); await p.waitForTimeout(1200);
  const inView = await p.evaluate(() => { const r = document.querySelector("#pf-emails").getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; });
  console.log("emails link: section in view:", inView, "| legend:", await p.locator("#pf-emails legend").textContent(), "| hash now:", await p.evaluate(() => location.hash));
  await p.screenshot({ path: "../emails-focus.png" });
  // 2. verify card + page
  await p.waitForSelector("#verify-card a", { timeout: 15000 });
  console.log("card:", (await p.locator("#verify-card strong").first().textContent()), "->", await p.locator("#verify-card a").getAttribute("href"));
  await p.click("#verify-card a"); await p.waitForSelector("#vp-form", { timeout: 15000 });
  console.log("page:", await p.locator(".vp-head h1").textContent());
  await p.click(".vp-id:has-text('PhilSys National ID')");
  await p.setInputFiles("[name=idPhoto]", "test-photo.png"); await p.setInputFiles("[name=selfie]", "test-photo.png");
  await p.waitForSelector('[data-drop="selfie"].has', { timeout: 10000 });
  await p.locator("[name=consent]").check({ force: true });
  await p.screenshot({ path: "../seek-verify.png", fullPage: true });
  await p.getByRole("button", { name: "Send for checking" }).click(); await p.waitForSelector(".vp-track", { timeout: 15000 });
  console.log("after send:", await p.locator(".vp-head h1").textContent(), "|", (await p.locator(".vp-track li span").allTextContents()).at(-1));
  console.log("saved:", (await getDoc(`verifyRequests/${uid}`)).fields.status.stringValue);
  console.log("UID", uid);
  await b.close();
})();
