const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8000/?emu#/"); await p.waitForTimeout(2500);
  await p.evaluate(async () => {
    const v = [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1];
    const { store } = await import(`/assets/store.js?v=${v}`);
    await store.signUpEmail("ana@example.com", "secret123", "Ana");
    await new Promise((r) => setTimeout(r, 1200));
    await store.saveProfile({ role: "jobseeker", fullName: "Ana Reyes", phone: "09171234567", city: "Bacolod City", birthDate: "1995-01-01", jobCategories: ["Cook"], jobTypes: [] });
    window.__store = store;
  });
  await p.goto("http://localhost:8000/?emu#/profile"); await p.waitForTimeout(2500);
  console.log("scope hidden before:", await p.locator("#alerts-scope").isHidden());
  await p.check("[name=alerts]");
  console.log("scope hidden after tick:", await p.locator("#alerts-scope").isHidden());
  await p.selectOption("[name=alertsScope]", "all");
  await p.locator("#alerts-scope").scrollIntoViewIfNeeded(); await p.screenshot({ path: "../profile-alerts.png" });
  await p.check("[name=consent]");
  await p.click("#profile-form button[type=submit]"); await p.waitForTimeout(2500);
  const prof = await p.evaluate(() => { const { profile } = window.__store ? {} : {}; return null; });
  const st = await p.evaluate(async () => { const v = [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]; const m = await import(`/assets/store.js?v=${v}`); const pr = m.getAuthState().profile; return { alerts: pr.alerts, scope: pr.alertsScope, token: pr.alertsToken }; });
  console.log("saved:", JSON.stringify(st));
  await p.goto(`http://localhost:8000/?emu#/unsubscribe/${st.token}`); await p.waitForTimeout(2500);
  console.log("unsub page:", await p.locator("h1").first().textContent());
  await p.screenshot({ path: "../unsub.png" });
  const after = await p.evaluate(async () => { const v = [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]; const m = await import(`/assets/store.js?v=${v}`); return m.getAuthState().profile.alerts; });
  console.log("alerts after unsubscribe (signed in):", after);
  await p.goto("http://localhost:8000/?emu#/unsubscribe/garbage"); await p.waitForTimeout(1500);
  console.log("bad link page:", await p.locator("h1").first().textContent());
  // signed out
  await p.evaluate(() => window.__store.signOut()).catch(()=>{});
  const ctx2 = await b.newContext(); const p2 = await ctx2.newPage();
  await p2.goto(`http://localhost:8000/?emu#/unsubscribe/${"Z".repeat(32)}`); await p2.waitForTimeout(2500);
  console.log("signed-out unsub page:", await p2.locator("h1").first().textContent());
  console.log("page errors:", errs);
  await b.close();
})();
