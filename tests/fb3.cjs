const { chromium } = require("playwright");
const V = async (p) => p.evaluate(() => [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8000/?emu#/signin"); await p.waitForTimeout(2500);
  console.log("fb button:", await p.locator("#facebook").isVisible());
  await p.screenshot({ path: "../signin-fb.png" });
  await p.evaluate(async (v) => { const m = await import(`/assets/store.js?v=${v}`); await m.store.signUpEmail("pw@example.com", "secret123", "Pw User"); await new Promise((r) => setTimeout(r, 1200)); await m.store.saveProfile({ role: "employer", fullName: "Pw User", phone: "09171234567", city: "Bacolod City", companyName: "", fbUrl: "", bizReg: "" }); }, await V(p));
  await p.goto("http://localhost:8000/?emu#/profile"); await p.waitForTimeout(2500);
  console.log("profile fb row:", (await p.locator(".fb-link").textContent()).replace(/\s+/g, " ").trim());
  await p.locator(".fb-link").scrollIntoViewIfNeeded(); await p.screenshot({ path: "../profile-fb.png" });
  const r = await p.evaluate(async (v) => { const m = await import(`/assets/store.js?v=${v}`); try { await m.store.unlinkFacebook(); return "no error"; } catch (e) { return e.code; } }, await V(p));
  console.log("unlink with one method ->", r);
  console.log("errors:", errs);
  await b.close();
})();
