const { chromium } = require("playwright");
const FS = "http://127.0.0.1:8085/v1/projects/demo-jsph/databases/(default)/documents";
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
  const p = await ctx.newPage(); p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  let dry = {}; p.on("response", async (r) => { const u = r.url(); if (u.includes(":8787/email/")) { try { const j = await r.json(); dry[u.split("/").pop()] = j.dryUrl; console.log("  helper", u.split(":8787")[1], r.status(), j.dryUrl ? "(link ok)" : JSON.stringify(j)); } catch {} } });
  const email = `acct${Date.now()}@example.com`;
  await p.goto("http://localhost:8000/?emu#/signin"); await p.waitForSelector("#toggle");
  await p.click("#toggle"); await p.fill("#s-name", "Ana"); await p.fill("#s-email", email); await p.fill("#s-pw", "secret123");
  await p.click("#email-form button[type=submit]"); await p.waitForTimeout(500);
  console.log("one-word name:", await p.locator("#auth-error").innerText());
  await p.fill("#s-name", "Ana Reyes"); await p.click("#email-form button[type=submit]");
  await p.waitForSelector(".ce-card [data-ce=check]", { timeout: 15000 });
  console.log("gate:", await p.locator(".ce-card h1").innerText(), "|", (await p.locator(".ce-card p.muted").innerText()).slice(0, 60));
  await p.screenshot({ path: "../confirm-gate.png" });
  await p.evaluate(() => { location.hash = "#/messages"; }); await p.waitForTimeout(800);
  console.log("other page still gated:", await p.locator(".ce-card").count() === 1);
  await p.click("[data-ce=check]"); await p.waitForTimeout(1200);
  console.log("check before click:", await p.locator("#ce-msg").innerText());
  await p.waitForTimeout(500);
  console.log("verify link:", dry.verify?.replace(/oobCode=[^&]+/, "oobCode=…"));
  await p.goto(dry.verify + "&emu"); await p.waitForTimeout(3500);
  console.log("after link:", await p.evaluate(() => location.href), "|", await p.locator("h1").first().innerText());
  // profile with one-word name refused
  await p.screenshot({ path: "../confirmed.png" });
  await p.click(".ce-actions a"); await p.waitForSelector("#profile-form, [data-role], .role-pick, .profile-wrap", { timeout: 15000 });
  console.log("continue ->", await p.evaluate(() => location.hash));
  // finish profile normally
  const v = await p.evaluate(() => [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]);
  await p.evaluate(async ({ v }) => { const m = await import(`/assets/store.js?v=${v}`); await m.store.saveProfile({ role: "jobseeker", fullName: "Ana Reyes", phone: "09170000002", city: "Bacolod City", birthDate: "1995-01-01", jobCategories: ["Yaya / Nanny"], jobTypes: [] }); }, { v });
  const uid = await p.evaluate(async ({ v }) => (await import(`/assets/store.js?v=${v}`)).getAuthState().user.uid, { v });
  // rules: one-word name rejected on change
  const ruleRes = await p.evaluate(async ({ v }) => { const m = await import(`/assets/store.js?v=${v}`); try { await m.store.saveProfile({ fullName: "Ana" }); return "saved (bad)"; } catch (e) { return e.code; } }, { v });
  console.log("rules, rename to one word:", ruleRes);
  // simulate an old one-word profile
  await fetch(`${FS}/users/${uid}?updateMask.fieldPaths=fullName`, { method: "PATCH", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ fields: { fullName: { stringValue: "Ana" } } }) });
  await p.goto("http://localhost:8000/?emu#/messages"); await p.reload(); await p.waitForTimeout(3000);
  console.log("old one-word profile ->", await p.evaluate(() => location.hash), "| notice:", await p.locator("#name-needed").count());
  await p.screenshot({ path: "../name-needed.png" });
  await p.fill("[name=fullName]", "Ana"); await p.getByRole("button", { name: /Save/ }).first().click(); await p.waitForTimeout(800);
  console.log("save one word:", (await p.locator(".error:visible").first().innerText().catch(() => "")).slice(0, 80));
  await p.fill("[name=fullName]", "Ana Reyes"); await p.getByRole("button", { name: /Save/ }).first().click(); await p.waitForTimeout(2500);
  console.log("after full name ->", await p.evaluate(() => location.hash));
  // password reset
  await p.evaluate(async ({ v }) => (await import(`/assets/store.js?v=${v}`)).store.signOut(), { v }); await p.waitForTimeout(800);
  await p.goto("http://localhost:8000/?emu#/signin"); await p.waitForSelector("#forgot");
  await p.fill("#s-email", "nobody@example.com"); await p.click("#forgot"); await p.waitForTimeout(1500);
  await p.waitForTimeout(61000);
  await p.fill("#s-email", email); await p.click("#forgot"); await p.waitForTimeout(1500);
  console.log("reset link:", dry.reset?.replace(/oobCode=[^&]+/, "oobCode=…"));
  await p.goto(dry.reset + "&emu"); await p.waitForSelector("#rp-form", { timeout: 15000 });
  await p.screenshot({ path: "../reset-page.png" });
  await p.fill("#rp1", "newpass99"); await p.fill("#rp2", "newpass99"); await p.click("#rp-form button"); await p.waitForTimeout(3000);
  console.log("after reset:", await p.evaluate(async ({ v }) => (await import(`/assets/store.js?v=${v}`)).getAuthState().user?.email, { v }) === email ? "signed in with new password" : "NOT signed in");
  await b.close();
})();
