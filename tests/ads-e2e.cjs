const { chromium } = require("playwright");
const FS = "http://127.0.0.1:8085/v1/projects/demo-jsph/databases/(default)/documents";
const H = { authorization: "Bearer owner", "content-type": "application/json" };
async function confirmEmails() { const codes = await (await fetch("http://127.0.0.1:9099/emulator/v1/projects/demo-jsph/oobCodes")).json(); for (const c of codes.oobCodes.filter((c) => c.requestType === "VERIFY_EMAIL")) await fetch(c.oobLink); }
(async () => {
  const b = await chromium.launch(); const t = Date.now();
  // a visitor from an ad, twice (counted once), and one signs up as employer through #/join/employer
  const v = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage(); v.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await v.goto(`http://localhost:8000/?emu&utm_source=facebook&utm_campaign=FBAD-Employers-Nov&utm_content=ad1#/join/employer`); await v.waitForTimeout(2500);
  console.log("join link ->", await v.evaluate(() => location.href), "| form:", await v.locator(".auth-card h1").innerText());
  await v.waitForSelector("#s-name", { timeout: 10000 });
  await v.fill("#s-name", "Rea Alvarez"); await v.fill("#s-email", `ad${t}@example.com`); await v.fill("#s-pw", "secret123"); await v.click("#email-form button[type=submit]");
  await v.waitForSelector(".ce-card", { timeout: 15000 }); await confirmEmails(); await v.click("[data-ce=check]"); await v.waitForTimeout(2500);
  console.log("after confirm ->", await v.evaluate(() => location.hash), "| employer preselected:", await v.locator(".role-card.on, [aria-checked=true], input[value=employer]:checked").count());
  const vv = await v.evaluate(() => [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]);
  await v.evaluate(async ({ vv }) => { const m = await import(`/assets/store.js?v=${vv}`); await m.store.saveProfile({ role: "employer", fullName: "Rea Alvarez", phone: "09171234567", city: "Bacolod City", companyName: "Alvarez family", fbUrl: "", bizReg: "" }); }, { vv });
  const day = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const visit = await (await fetch(`${FS}/visits/fbad-employers-nov__${day}`, { headers: H })).json();
  console.log("visit counter:", visit.fields?.n?.integerValue);
  // admin
  const a = await (await b.newContext({ viewport: { width: 1200, height: 1000 } })).newPage(); a.on("pageerror", (e) => console.log("PAGE ERROR admin", e.message));
  await a.goto("http://localhost:8000/?emu#/"); await a.waitForTimeout(1500);
  const av = await a.evaluate(() => [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]);
  const auid = await a.evaluate(async ({ av, t }) => { const m = await import(`/assets/store.js?v=${av}`); await m.store.signUpEmail(`boss${t}@example.com`, "secret123", "Mark Admin"); await new Promise((r) => setTimeout(r, 1000)); await m.store.saveProfile({ role: "employer", fullName: "Mark Admin", phone: "09170001111", city: "Bacolod City", companyName: "", fbUrl: "", bizReg: "" }); return m.getAuthState().user.uid; }, { av, t });
  await fetch(`${FS}/admins/${auid}`, { method: "PATCH", headers: H, body: JSON.stringify({ fields: { name: { stringValue: "Mark" } } }) });
  await a.goto("http://localhost:8000/?emu#/admin/analytics"); await a.reload(); await a.waitForSelector(".cmp-list", { timeout: 20000 });
  await a.fill("#src-name", "Flyer Lacson"); await a.selectOption("#src-aud", "jobseekers"); await a.selectOption("#src-ch", "flyer"); await a.fill("#src-spend", "300");
  console.log("link preview:", await a.locator("#src-link").innerText());
  await a.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await a.click("#src-save"); await a.waitForTimeout(1500);
  const row = a.locator(".cmp", { hasText: "fbad-employers-nov" });
  await row.locator("[data-spend]").fill("500"); await row.locator("[data-spend]").dispatchEvent("change"); await a.waitForTimeout(1500);
  console.log("fbad row:", (await a.locator(".cmp", { hasText: "fbad-employers-nov" }).innerText()).replace(/\s+/g, " "));
  console.log("flyer row:", (await a.locator(".cmp", { hasText: "flyer-lacson" }).innerText()).replace(/\s+/g, " "));
  await a.locator("h2.an-h", { hasText: "Ads" }).scrollIntoViewIfNeeded();
  await a.screenshot({ path: "../ads-admin.png", fullPage: false });
  await a.locator(".cmp", { hasText: "flyer-lacson" }).locator("[data-cmp-qr]").click(); await a.waitForTimeout(2500);
  console.log("qr:", await a.locator(".dlg img").count());
  await a.screenshot({ path: "../ads-qr.png" });
  await b.close();
})();
