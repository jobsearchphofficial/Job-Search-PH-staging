const { chromium } = require("playwright");
const FS = "http://127.0.0.1:8085/v1/projects/demo-jsph/databases/(default)/documents";
const H = { authorization: "Bearer owner", "content-type": "application/json" };
const put = (path, f) => fetch(`${FS}/${path}`, { method: "PATCH", headers: H, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === "number" ? { integerValue: v } : v instanceof Date ? { timestampValue: v.toISOString() } : Array.isArray(v) ? { arrayValue: { values: v.map((x) => ({ stringValue: x })) } } : { stringValue: v }])) }) });
async function confirmEmails() { const codes = await (await fetch("http://127.0.0.1:9099/emulator/v1/projects/demo-jsph/oobCodes")).json(); for (const c of codes.oobCodes.filter((c) => c.requestType === "VERIFY_EMAIL")) await fetch(c.oobLink); }
const ver = (p) => p.evaluate(() => [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]);
(async () => {
  const b = await chromium.launch(); const t = Date.now();
  // jobseeker with a "new" application
  const s = await (await b.newContext({ viewport: { width: 420, height: 860 } })).newPage(); s.on("pageerror", (e) => console.log("PAGE ERROR seeker", e.message));
  await s.goto("http://localhost:8000/?emu#/"); await s.waitForTimeout(1500);
  const sv = await ver(s);
  const suid = await s.evaluate(async ({ sv, t }) => { const m = await import(`/assets/store.js?v=${sv}`); await m.store.signUpEmail(`seek${t}@example.com`, "secret123", "Joy Dela Cruz"); await new Promise((r) => setTimeout(r, 800)); return m.getAuthState().user.uid; }, { sv, t });
  await confirmEmails();
  await s.evaluate(async ({ sv }) => { const m = await import(`/assets/store.js?v=${sv}`); await m.store.refreshVerified(); await m.store.saveProfile({ role: "jobseeker", fullName: "Joy Dela Cruz", phone: "09175550000", city: "Bacolod City", birthDate: "1996-02-02" }); }, { sv });
  const appId = `job${t}_${suid}`;
  await put(`applications/${appId}`, { jobId: `job${t}`, applicantUid: suid, employerUid: "empX", status: "new", jobTitle: "Live-in Kasambahay", employerName: "BaseOps", createdAt: new Date() });
  await s.goto(`http://localhost:8000/?emu#/chat/${appId}`); await s.reload(); await s.waitForSelector("#chat-banner .locked, .chat-banner.locked", { timeout: 15000 });
  console.log("seeker (new): banner:", (await s.locator(".chat-banner.locked").innerText()).slice(0, 90), "| input disabled:", await s.locator("#chat-input").isDisabled(), "| placeholder:", await s.getAttribute("#chat-input", "placeholder"));
  await s.screenshot({ path: "../chat-locked.png" });
  await put(`applications/${appId}?updateMask.fieldPaths=status`, { status: "shortlisted" });
  await s.reload(); await s.waitForSelector("#chat-input"); await s.waitForTimeout(1500);
  console.log("seeker (shortlisted): input disabled:", await s.locator("#chat-input").isDisabled(), "| locked banner:", await s.locator(".chat-banner.locked").count());
  // admin with queue items
  for (let i = 0; i < 2; i++) await put(`flags/f${t}${i}`, { appId, text: i ? "Gcash" : "Bank transfer", fromName: "Mark Christian Jalando-on", fromRole: "jobseeker", fromUid: suid, jobTitle: "Live-in Kasambahay", types: ["money"], createdAt: new Date() });
  await put(`reports/r${t}`, { jobId: "nojob", reason: "fee", details: "They asked for a placement fee", createdAt: new Date() });
  const a = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); a.on("pageerror", (e) => console.log("PAGE ERROR admin", e.message));
  await a.goto("http://localhost:8000/?emu#/"); await a.waitForTimeout(1500);
  const av = await ver(a);
  const auid = await a.evaluate(async ({ av, t }) => { const m = await import(`/assets/store.js?v=${av}`); await m.store.signUpEmail(`boss${t}@example.com`, "secret123", "Mark Admin"); await new Promise((r) => setTimeout(r, 1000)); await m.store.saveProfile({ role: "employer", fullName: "Mark Admin", phone: "09170001111", city: "Bacolod City" }); return m.getAuthState().user.uid; }, { av, t });
  await fetch(`${FS}/admins/${auid}`, { method: "PATCH", headers: H, body: JSON.stringify({ fields: { name: { stringValue: "Mark" } } }) });
  await a.goto("http://localhost:8000/?emu#/admin/flags"); await a.reload(); await a.waitForSelector(".adm-card", { timeout: 20000 }); await a.waitForTimeout(2000);
  console.log("admin sidebar:", (await a.locator(".adm-side").innerText()).replace(/\s+/g, " "));
  console.log("flag cards:", await a.locator(".adm-card").count());
  await a.screenshot({ path: "../admin-flags.png" });
  await a.click(".adm-link[data-tab=reports]"); await a.waitForSelector(".adm-card"); await a.waitForTimeout(500);
  console.log("reports ->", a.url().split("#")[1], "| head:", await a.locator(".adm-head h1").innerText());
  await a.screenshot({ path: "../admin-reports.png" });
  await a.click(".adm-link[data-tab=verify]"); await a.waitForTimeout(1500); await a.screenshot({ path: "../admin-verify.png" });
  await a.click(".adm-link[data-tab=analytics]"); await a.waitForTimeout(3000); await a.screenshot({ path: "../admin-analytics.png" });
  await a.click(".adm-link[data-tab=users]"); await a.waitForTimeout(2000); await a.screenshot({ path: "../admin-users.png" });
  await a.setViewportSize({ width: 390, height: 860 }); await a.click(".adm-link[data-tab=flags]"); await a.waitForSelector(".adm-card"); await a.waitForTimeout(800); await a.screenshot({ path: "../admin-mobile.png" });
  await b.close();
})();
