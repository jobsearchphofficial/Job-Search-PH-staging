const { chromium } = require("playwright");
const FS = "http://127.0.0.1:8085/v1/projects/demo-jsph/databases/(default)/documents";
const H = { authorization: "Bearer owner", "content-type": "application/json" };
const put = (path, f) => fetch(`${FS}/${path}`, { method: "PATCH", headers: H, body: JSON.stringify({ fields: f }) });
const getDoc = async (path) => { const r = await fetch(`${FS}/${path}`, { headers: H }); return r.status === 404 ? null : (await r.json()).fields; };
const S = (v) => ({ stringValue: v }), T = (d) => ({ timestampValue: d.toISOString() });
async function confirmEmails() { const codes = await (await fetch("http://127.0.0.1:9099/emulator/v1/projects/demo-jsph/oobCodes")).json(); for (const c of codes.oobCodes.filter((c) => c.requestType === "VERIFY_EMAIL")) await fetch(c.oobLink); }
async function user(b, email, profile) {
  const p = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage(); p.on("pageerror", (e) => console.log("PAGE ERROR", email, e.message));
  await p.goto("http://localhost:8000/?emu#/"); await p.waitForTimeout(1500);
  const v = await p.evaluate(() => [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]);
  const uid = await p.evaluate(async ({ v, email, profile }) => { const m = await import(`/assets/store.js?v=${v}`); await m.store.signUpEmail(email, "secret123", profile.fullName); await new Promise((r) => setTimeout(r, 1000)); await m.store.saveProfile(profile); return m.getAuthState().user.uid; }, { v, email, profile });
  await confirmEmails(); await p.evaluate(async ({ v }) => (await import(`/assets/store.js?v=${v}`)).store.refreshVerified(), { v });
  return { p, uid, v };
}
(async () => {
  const b = await chromium.launch(); const t = Date.now();
  const emp = await user(b, `de${t}@example.com`, { role: "employer", fullName: "Rea Alvarez", phone: "09171234567", city: "Bacolod City", companyName: "Alvarez family", fbUrl: "", bizReg: "" });
  const sk = await user(b, `ds${t}@example.com`, { role: "jobseeker", fullName: "Ana Reyes", phone: "09170000002", city: "Bacolod City", birthDate: "1995-01-01", jobCategories: ["Yaya / Nanny"], jobTypes: [] });
  const now = new Date();
  for (const id of ["dj1", "dj2"]) await put(`jobs/${id}${t}`, { title: S("Yaya " + id), status: S("approved"), ownerUid: S(emp.uid), city: S("Bacolod City"), category: S("Yaya / Nanny"), employerName: S("Alvarez family"), createdAt: T(now), approvedAt: T(now) });
  await put(`jobs/dj1${t}/private/contact`, { contactMethod: S("phone"), contactValue: S("09171234567") });
  const app1 = `dj1${t}_${sk.uid}`, app2 = `dj2${t}_${sk.uid}`;
  const base = (j) => ({ jobId: S(j + t), employerUid: S(emp.uid), applicantUid: S(sk.uid), status: S("new"), createdAt: T(now), jobTitle: S("Yaya"), employerName: S("Alvarez family"), applicant: { mapValue: { fields: { fullName: S("Ana Reyes"), phone: S("09170000002") } } } });
  await put(`applications/${app1}`, { ...base("dj1"), lastMessageAt: T(now), lastMessageFrom: S(sk.uid) });
  await put(`applications/${app1}/messages/m1`, { fromUid: S(sk.uid), text: S("Hello po"), createdAt: T(now) });
  await put(`applications/${app2}`, base("dj2"));
  // jobseeker deletes account
  await sk.p.goto("http://localhost:8000/?emu#/profile"); await sk.p.waitForSelector("a[href='#/delete-account']", { timeout: 15000 });
  await sk.p.click("a[href='#/delete-account']"); await sk.p.waitForSelector("#da-form");
  await sk.p.screenshot({ path: "../delete-page.png", fullPage: true });
  await sk.p.fill("#da-pw", "secret123"); await sk.p.fill("#da-confirm", "nope");
  await sk.p.click("#da-form button"); await sk.p.waitForTimeout(500);
  console.log("not typed:", await sk.p.locator("#da-msg").innerText());
  await sk.p.fill("#da-pw", "wrongpw1"); await sk.p.fill("#da-confirm", "DELETE"); await sk.p.click("#da-form button"); await sk.p.waitForTimeout(1500);
  console.log("wrong password:", await sk.p.locator("#da-msg").innerText());
  await sk.p.fill("#da-pw", "secret123"); await sk.p.click("#da-form button"); await sk.p.waitForTimeout(5000);
  console.log("after delete:", await sk.p.evaluate(() => location.hash), "|", await sk.p.locator("h1").first().innerText());
  const a1 = await getDoc(`applications/${app1}`), a2 = await getDoc(`applications/${app2}`);
  console.log("chatted app:", a1 ? `kept, applicant=${a1.applicant.mapValue.fields.fullName.stringValue}, applicantDeleted=${a1.applicantDeleted?.booleanValue}` : "gone", "| no-chat app:", a2 ? "kept (bad)" : "deleted");
  console.log("seeker profile:", (await getDoc(`users/${sk.uid}`)) ? "still there (bad)" : "deleted");
  await sk.p.evaluate((e) => { window.__em = e; }, `ds${t}@example.com`);
  const login = await sk.p.evaluate(async () => { const m = await import(`/assets/store.js?v=${[...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]}`); try { await m.store.signInEmail(window.__em, "secret123"); return "signed in (bad)"; } catch (e) { return e.code; } });
  console.log("sign in again:", login);
  // employer sees closed chat
  await emp.p.goto(`http://localhost:8000/?emu#/chat/${app1}`); await emp.p.reload(); await emp.p.waitForTimeout(3000);
  console.log("employer chat banner:", await emp.p.locator("#chat-banner").innerText().catch(() => "?"));
  const send = await emp.p.evaluate(async ({ v, app1 }) => { const fs = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"); try { await fs.addDoc(fs.collection(fs.getFirestore(), "applications", app1, "messages"), { fromUid: (await import(`/assets/store.js?v=${v}`)).getAuthState().user.uid, text: "hi", createdAt: fs.serverTimestamp() }); return "sent (bad)"; } catch (e) { return e.code; } }, { v: emp.v, app1 });
  console.log("employer can still send:", send);
  // employer deletes account
  await emp.p.goto("http://localhost:8000/?emu#/delete-account"); await emp.p.waitForSelector("#da-form");
  await emp.p.fill("#da-pw", "secret123"); await emp.p.fill("#da-confirm", "DELETE"); await emp.p.click("#da-form button"); await emp.p.waitForTimeout(6000);
  console.log("employer after delete:", await emp.p.locator("h1").first().innerText());
  console.log("jobs:", (await getDoc(`jobs/dj1${t}`)) || (await getDoc(`jobs/dj2${t}`)) ? "still there (bad)" : "deleted", "| contact:", (await getDoc(`jobs/dj1${t}/private/contact`)) ? "still there (bad)" : "deleted");
  const a1b = await getDoc(`applications/${app1}`);
  console.log("app now:", a1b?.employerName?.stringValue, a1b?.employerDeleted?.booleanValue);
  await emp.p.screenshot({ path: "../deleted.png" });
  console.log("APP1", app1);
  await b.close();
})();
