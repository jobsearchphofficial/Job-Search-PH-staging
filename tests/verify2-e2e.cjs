const { chromium } = require("playwright");
const FS = "http://127.0.0.1:8085/v1/projects/demo-jsph/databases/(default)/documents";
const H = { authorization: "Bearer owner", "content-type": "application/json" };
const getDoc = async (path) => (await fetch(`${FS}/${path}`, { headers: H })).json();
const V = (p) => p.evaluate(() => [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]);
async function signUp(ctx, email, name, profile, w) {
  const p = await ctx.newPage(); p.on("pageerror", (e) => console.log("PAGE ERROR", email, e.message));
  await p.goto("http://localhost:8000/?emu#/"); await p.waitForTimeout(2000);
  const uid = await p.evaluate(async ({ v, email, name, profile }) => { const m = await import(`/assets/store.js?v=${v}`); await m.store.signUpEmail(email, "secret123", name); await new Promise((r) => setTimeout(r, 1200)); await m.store.saveProfile(profile); return m.getAuthState().user.uid; }, { v: await V(p), email, name, profile });
  return { p, uid };
}
(async () => {
  const b = await chromium.launch();
  const emp = await signUp(await b.newContext({ viewport: { width: 1200, height: 1000 } }), "emp@example.com", "Rea", { role: "employer", fullName: "Rea Alvarez", phone: "09171234567", city: "Bacolod City", companyName: "Alvarez family", fbUrl: "https://facebook.com/rea.alvarez", bizReg: "" });
  await emp.p.goto("http://localhost:8000/?emu#/profile"); await emp.p.reload(); await emp.p.waitForSelector("#verify-card a", { timeout: 15000 });
  console.log("profile card button:", await emp.p.locator("#verify-card a").textContent(), "->", await emp.p.locator("#verify-card a").getAttribute("href"));
  await emp.p.click("#verify-card a"); await emp.p.waitForSelector("#vp-form", { timeout: 15000 });
  console.log("page:", await emp.p.locator(".vp-head h1").textContent(), "| ID choices:", await emp.p.locator(".vp-id").count());
  await emp.p.getByRole("button", { name: "Send for checking" }).click(); await emp.p.waitForTimeout(500);
  console.log("empty submit:", await emp.p.locator("#vp-error").textContent());
  await emp.p.click(".vp-id:has-text('PhilSys National ID')");
  await emp.p.setInputFiles("[name=idPhoto]", "test-photo.png"); await emp.p.setInputFiles("[name=selfie]", "test-photo.png");
  await emp.p.waitForSelector('[data-drop="selfie"].has', { timeout: 10000 });
  await emp.p.screenshot({ path: "../verify-page.png", fullPage: true });
  // watermark check: the stamped photo differs from the plain shrink of the same file
  const stamped = await emp.p.locator('[data-drop="idPhoto"] img').getAttribute("src");
  console.log("photo stamped & re-encoded:", stamped.startsWith("data:image/jpeg;base64,"), "| retake shown:", await emp.p.locator('[data-drop="idPhoto"] .vp-retake').isVisible());
  await emp.p.locator("[name=consent]").check({ force: true });
  await emp.p.getByRole("button", { name: "Send for checking" }).click(); await emp.p.waitForSelector(".vp-track", { timeout: 15000 });
  console.log("after send:", await emp.p.locator(".vp-head h1").textContent(), "| steps:", (await emp.p.locator(".vp-track li strong").allTextContents()).join(" > "));
  await emp.p.screenshot({ path: "../verify-status.png" });
  const r = (await getDoc(`verifyRequests/${emp.uid}`)).fields;
  console.log("saved:", r.status.stringValue, r.idType.stringValue);
  await b.close();
})();
