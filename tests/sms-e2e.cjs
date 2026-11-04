const { chromium } = require("playwright");
const V = (p) => p.evaluate(() => [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]);
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage(); p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  let dry = null; p.on("response", async (r) => { if (r.url().endsWith("/send")) { try { const j = await r.json(); dry = j.dryCode; console.log("  /send ->", r.status(), JSON.stringify({ ...j, dryCode: j.dryCode ? "******" : undefined })); } catch {} } });
  await p.goto("http://localhost:8000/?emu#/"); await p.waitForTimeout(2000);
  const v = await V(p);
  // employer with email confirmed: use Google-like? signUpEmail needs confirm; mark verified via emulator
  const uid = await p.evaluate(async ({ v }) => { const m = await import(`/assets/store.js?v=${v}`); await m.store.signUpEmail(`sms${Date.now()}@example.com`, "secret123", "Rea"); await new Promise((r) => setTimeout(r, 1200)); await m.store.saveProfile({ role: "employer", fullName: "Rea Alvarez", phone: "0917 123 4567", city: "Bacolod City", companyName: "Alvarez family", fbUrl: "", bizReg: "" }); return m.getAuthState().user.uid; }, { v });
  // confirm email in auth emulator
  const codes = await (await fetch("http://127.0.0.1:9099/emulator/v1/projects/demo-jsph/oobCodes")).json();
  for (const c of codes.oobCodes.filter((c) => c.requestType === "VERIFY_EMAIL")) await fetch(c.oobLink);
  // client can't fake it
  const fake = await p.evaluate(async ({ v }) => { const m = await import(`/assets/store.js?v=${v}`); const fs = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"); try { await fs.setDoc(fs.doc(fs.getFirestore(), "phoneVerified", m.getAuthState().user.uid), { phone: "+639171234567" }); return "WROTE (bad)"; } catch (e) { return e.code; } }, { v });
  console.log("client writes phoneVerified:", fake);
  await p.goto("http://localhost:8000/?emu#/post"); await p.reload(); await p.waitForTimeout(2500);
  if (await p.locator("[data-confirm=check]").count()) { await p.click("[data-confirm=check]"); await p.waitForTimeout(2500); }
  await p.waitForSelector("#phone-gate [data-pc-send]", { timeout: 15000 });
  console.log("gate:", (await p.locator("#phone-gate").innerText()).replace(/\s+/g, " ").slice(0, 160));
  await p.screenshot({ path: "../sms-gate.png" });
  await p.click("[data-pc-send]"); await p.waitForSelector(".pc-form", { timeout: 10000 });
  await p.fill("[name=code]", "000000"); await p.waitForTimeout(1500);
  console.log("wrong code:", await p.locator("[data-pc-err]").innerText());
  console.log("resend:", await p.locator("[data-pc-wait]").innerText());
  await p.screenshot({ path: "../sms-code.png" });
  await p.fill("[name=code]", dry); await p.waitForSelector("#post-form, form.post-form, [name=title]", { timeout: 15000 });
  console.log("after right code: post form shown");
  await p.goto("http://localhost:8000/?emu#/profile"); await p.waitForSelector("#phone-card.ok", { timeout: 15000 });
  console.log("profile:", (await p.locator("#phone-card").innerText()).replace(/\s+/g, " "));
  // send again -> already
  const again = await p.evaluate(async ({ v }) => { const m = await import(`/assets/store.js?v=${v}`); return m.store.sms("send"); }, { v });
  console.log("send again:", JSON.stringify(again));
  await b.close();
})();
