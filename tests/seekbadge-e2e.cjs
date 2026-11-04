const { chromium } = require("playwright");
const FS = "http://127.0.0.1:8085/v1/projects/demo-jsph/databases/(default)/documents";
const H = { authorization: "Bearer owner", "content-type": "application/json" };
const SEEK = "Xg6kvRXuxwqUpPk8wcSniaW8JuQg";
const V = (p) => p.evaluate(() => [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]);
const put = (path, f) => fetch(`${FS}/${path}`, { method: "PATCH", headers: H, body: JSON.stringify({ fields: f }) });
const S = (v) => ({ stringValue: v }), T = (d) => ({ timestampValue: d.toISOString() });
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1100, height: 1000 } })).newPage(); p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await p.goto("http://localhost:8000/?emu#/"); await p.waitForTimeout(2000);
  const uid = await p.evaluate(async ({ v }) => { const m = await import(`/assets/store.js?v=${v}`); await m.store.signUpEmail(`empb${Date.now()}@example.com`, "secret123", "Rea"); await new Promise((r) => setTimeout(r, 1200)); await m.store.saveProfile({ role: "employer", fullName: "Rea Alvarez", phone: "09171234567", city: "Bacolod City", companyName: "Alvarez family", fbUrl: "", bizReg: "" }); return m.getAuthState().user.uid; }, { v: await V(p) });
  const now = new Date();
  await put("jobs/jb1", { title: S("Yaya"), status: S("approved"), ownerUid: S(uid), city: S("Bacolod City"), category: S("Yaya / Nanny"), employerName: S("Alvarez family"), createdAt: T(now), approvedAt: T(now) });
  await put("applications/ap1", { jobId: S("jb1"), employerUid: S(uid), applicantUid: S(SEEK), status: S("new"), createdAt: T(now), jobTitle: S("Yaya"),
    applicant: { mapValue: { fields: { fullName: S("Ana Reyes"), city: S("Bacolod City"), phone: S("09170000002") } } } });
  await p.goto("http://localhost:8000/?emu#/applicants/jb1"); await p.reload(); await p.waitForSelector(".applicant", { timeout: 15000 });
  console.log("applicant badges:", await p.locator(".applicant .ap-badges").first().innerText());
  await p.locator(".applicant").first().screenshot({ path: "../seek-badge.png" });
  await b.close();
})();
