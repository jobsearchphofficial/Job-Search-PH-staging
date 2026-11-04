const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 420, height: 900 } }); const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type()==="error"||m.type()==="warning") errs.push(m.text().slice(0,200)); });
  await p.goto("http://localhost:8000/?emu#/signin"); await p.waitForTimeout(2500);
  await p.screenshot({ path: "../signin-fb.png" });
  const [pop] = await Promise.all([ctx.waitForEvent("page"), p.click("#facebook")]);
  await pop.waitForLoadState(); await pop.waitForTimeout(1500);
  // emulator fake IdP page
  await pop.click("button:has-text('Add new account')"); await pop.waitForTimeout(800);
  await pop.click("#autogen-button"); await pop.waitForTimeout(500);
  console.log("form before:", await pop.locator("#email-input").inputValue(), await pop.locator("#display-name-input").inputValue());
  console.log("disabled:", await pop.locator("#sign-in").isDisabled()); await pop.locator("#sign-in").evaluate((b) => b.click()); await pop.waitForTimeout(4000);
  if (!pop.isClosed()) { console.log("popup url now:", pop.url().slice(0,150)); console.log("popup text:", (await pop.locator("body").innerText()).slice(0,300).replace(/\s+/g," ")); }
  await p.waitForTimeout(6000);
  console.log("auth-error:", await p.locator("#auth-error").textContent().catch(()=>"-"), "| popup closed:", pop.isClosed());
  const st = await p.evaluate(async () => { const v = [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]; const m = await import(`/assets/store.js?v=${v}`); return { user: !!m.getAuthState().user, providers: m.store.providers(), hash: location.hash }; });
  console.log("after facebook sign-in:", JSON.stringify(st));
  // make a profile, then check the profile page shows Connected
  await p.evaluate(async () => { const v = [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]; const m = await import(`/assets/store.js?v=${v}`); await m.store.saveProfile({ role: "employer", fullName: "Fb Tester", phone: "09171234567", city: "Bacolod City", companyName: "", fbUrl: "", bizReg: "" }); });
  await p.goto("http://localhost:8000/?emu#/profile"); await p.waitForTimeout(2500);
  console.log("profile fb row:", (await p.locator(".fb-link").textContent()).replace(/\s+/g, " ").trim());
  const sv = await p.evaluate(async () => { const v = [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]; const m = await import(`/assets/store.js?v=${v}`); return m.getAuthState().profile.signIn; });
  console.log("profile.signIn saved as:", sv);
  await p.locator(".fb-link").scrollIntoViewIfNeeded(); await p.screenshot({ path: "../profile-fb.png" });
  // remove should be refused: it's the only method
  await p.click("#fb-link"); await p.click("#fb-link"); await p.waitForTimeout(1000);
  console.log("toast:", await p.locator(".toast").last().textContent().catch(() => "none"));
  console.log("errors:", errs);
  await b.close();
})();
