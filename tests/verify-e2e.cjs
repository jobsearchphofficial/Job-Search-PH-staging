const { chromium } = require("playwright");
const FS = "http://127.0.0.1:8085/v1/projects/demo-jsph/databases/(default)/documents";
const H = { authorization: "Bearer owner", "content-type": "application/json" };
const getDoc = async (path) => (await fetch(`${FS}/${path}`, { headers: H })).json();
const V = (p) => p.evaluate(() => [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]);
async function signUp(ctx, email, name, profile) {
  const p = await ctx.newPage(); p.on("pageerror", (e) => console.log("PAGE ERROR", email, e.message));
  await p.goto("http://localhost:8000/?emu#/"); await p.waitForTimeout(2000);
  const uid = await p.evaluate(async ({ v, email, name, profile }) => { const m = await import(`/assets/store.js?v=${v}`); await m.store.signUpEmail(email, "secret123", name); await new Promise((r) => setTimeout(r, 1200)); await m.store.saveProfile(profile); return m.getAuthState().user.uid; }, { v: await V(p), email, name, profile });
  return { p, uid };
}
(async () => {
  const b = await chromium.launch();
  const emp = await signUp(await b.newContext({ viewport: { width: 760, height: 1000 } }), "emp@example.com", "Rea", { role: "employer", fullName: "Rea Alvarez", phone: "09171234567", city: "Bacolod City", companyName: "Alvarez family", fbUrl: "https://facebook.com/rea.alvarez", bizReg: "" });
  await emp.p.goto("http://localhost:8000/?emu#/profile"); await emp.p.reload(); await emp.p.waitForSelector("#vc-open", { timeout: 15000 });
  console.log("profile card:", (await emp.p.locator("#verify-card strong").first().textContent()));
  await emp.p.click("#vc-open");
  await emp.p.selectOption("#vc-form [name=idType]", "Driver's license");
  await emp.p.setInputFiles("#vc-form [name=idPhoto]", "test-photo.png"); await emp.p.setInputFiles("#vc-form [name=selfie]", "test-photo.png");
  await emp.p.waitForTimeout(1200);
  await emp.p.locator("#vc-form button[type=submit]").click(); await emp.p.waitForTimeout(800);
  console.log("without consent:", await emp.p.locator("#vc-error").textContent());
  await emp.p.locator("#vc-form [name=consent]").check({ force: true });
  await emp.p.locator("#verify-card").screenshot({ path: "../verify-form.png" });
  await emp.p.locator("#vc-form button[type=submit]").click(); await emp.p.waitForTimeout(2500);
  console.log("after sending:", (await emp.p.locator("#verify-card strong").first().textContent()));
  const r1 = (await getDoc(`verifyRequests/${emp.uid}`)).fields;
  console.log("saved:", r1.status.stringValue, r1.idType.stringValue, "| id photo chars:", r1.idPhoto.stringValue.length, "| selfie chars:", r1.selfie.stringValue.length);
  // admin approves
  const adm = await signUp(await b.newContext({ viewport: { width: 1000, height: 1000 } }), "boss@example.com", "Mark", { role: "employer", fullName: "Mark J", phone: "09179999999", city: "Bacolod City", companyName: "", fbUrl: "", bizReg: "" });
  await fetch(`${FS}/admins/${adm.uid}`, { method: "PATCH", headers: H, body: JSON.stringify({ fields: { name: { stringValue: "Mark" } } }) });
  await adm.p.goto("http://localhost:8000/?emu#/admin/verify"); await adm.p.reload(); await adm.p.waitForSelector(".vr-item, #admin-body .empty", { timeout: 15000 });
  console.log("admin sees requests:", await adm.p.locator(".vr-item").count(), "| images:", await adm.p.locator(".vr-img").count());
  await adm.p.screenshot({ path: "../admin-verify.png" });
  await adm.p.click(`[data-vr-ok="${emp.uid}"]`); await adm.p.waitForTimeout(2500);
  const r2 = (await getDoc(`verifyRequests/${emp.uid}`)).fields;
  console.log("after approve:", r2.status.stringValue, "| photos left:", "idPhoto" in r2 || "selfie" in r2, "| badge doc:", !!(await getDoc(`verified/${emp.uid}`)).fields);
  await emp.p.reload(); await emp.p.waitForSelector("#verify-card .vc-done, #verify-card strong", { timeout: 15000 }); await emp.p.waitForTimeout(800);
  console.log("employer profile now:", (await emp.p.locator("#verify-card").innerText()).replace(/\s+/g, " "));
  await b.close();
})();
