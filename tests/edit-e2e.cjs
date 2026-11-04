const { chromium } = require("playwright");
const FS = "http://127.0.0.1:8085/v1/projects/demo-jsph/databases/(default)/documents";
const H = { authorization: "Bearer owner", "content-type": "application/json" };
const getDoc = async (path) => (await fetch(`${FS}/${path}`, { headers: H })).json();
const patch = async (path, fields) => fetch(`${FS}/${path}?${Object.keys(fields).map((k) => "updateMask.fieldPaths=" + k).join("&")}`, { method: "PATCH", headers: H, body: JSON.stringify({ fields }) });
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  await p.exposeFunction("__confirmEmails", async () => { const c = await (await fetch("http://127.0.0.1:9099/emulator/v1/projects/demo-jsph/oobCodes")).json(); for (const x of (c.oobCodes || []).filter((x) => x.requestType === "VERIFY_EMAIL")) await fetch(x.oobLink); });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8000/?emu#/"); await p.waitForTimeout(2500);
  const V = await p.evaluate(() => [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]);
  const { uid, id } = await p.evaluate(async (v) => {
    const m = await import(`/assets/store.js?v=${v}`);
    await m.store.signUpEmail("emp@example.com", "secret123", "Rea"); await new Promise((r) => setTimeout(r, 1200)); await window.__confirmEmails(); await m.store.refreshVerified();
    await m.store.saveProfile({ role: "employer", fullName: "Rea Alvarez", phone: "09171234567", city: "Bacolod City", companyName: "Alvarez family", fbUrl: "", bizReg: "" });
    const { id } = await m.store.createJob({ title: "Live-in Yaya", category: "Yaya / Nanny", employerName: "Alvarez family", city: "Bacolod City", area: "Mandalagan", workplace: "household", arrangement: "Live-in", schedule: "Full-time", employmentType: "Live-in",
      salaryMin: 10000, salaryMax: 12000, salaryPeriod: "month", hours: "", daysOff: 4, daysOffPer: "month", openings: 1, startDate: "", benefits: ["SSS", "PhilHealth", "Free meals"], reqExperience: 5, reqEducation: "High school", reqList: ["Can cook"],
      requirements: "", description: "Dapat palagi malinis ang bahay. Care for one baby and light cleaning." }, { contactMethod: "messenger", contactValue: "Rhea" });
    return { uid: m.getAuthState().user.uid, id };
  }, V);
  // admin approves it (as if 2 hours ago, expiring in 28 days)
  const approvedAt = new Date(Date.now() - 7200000).toISOString(), expiresAt = new Date(Date.now() + 28 * 86400000).toISOString();
  await patch(`jobs/${id}`, { status: { stringValue: "approved" }, approvedAt: { timestampValue: approvedAt }, expiresAt: { timestampValue: expiresAt } });
  await p.goto("http://localhost:8000/?emu#/my"); await p.waitForTimeout(2500);
  console.log("Edit button on My posts:", await p.locator(`a[href="#/post/edit/${id}"]`).isVisible());
  await p.click(`a[href="#/post/edit/${id}"]`); await p.waitForTimeout(2500);
  const pre = await p.evaluate(() => { const f = document.querySelector("#post-form"); const v = (n) => f.querySelector(`[name=${n}]:checked`)?.value; return { title: f.title.value, area: f.area.value, salaryMin: f.salaryMin.value, salaryMax: f.salaryMax.value, workplace: v("workplace"), category: v("category"), arrangement: v("arrangement"), exp: v("reqExperience"), edu: v("reqEducation"), contact: [...f.querySelectorAll(".crow")].map((r) => r.querySelector("select").value + ":" + r.querySelector("input").value).join(","), benefits: [...f.querySelectorAll("[name=benefits]:checked")].map((i) => i.value).join(","), req: [...f.querySelectorAll("[name=reqList]:checked")].map((i) => i.value).join(","), desc: f.description.value.slice(0, 20), button: f.querySelector("button[type=submit]").textContent }; });
  console.log("prefilled:", JSON.stringify(pre));
  console.log("heading:", await p.locator(".page-head h1").textContent(), "|", (await p.locator(".page-head .muted").textContent()).slice(0, 70));
  await p.screenshot({ path: "../edit-form.png" });
  await p.fill("[name=salaryMin]", "11000");
  for (const n of ["agreeWage", "agreeFee", "agreeAge", "agreeTerms"]) await p.check(`[name=${n}]`);
  await p.click("#post-form button[type=submit]"); await p.waitForTimeout(2500);
  console.log("after save:", await p.locator("h1").first().textContent());
  const d = (await getDoc(`jobs/${id}`)).fields;
  console.log("doc:", JSON.stringify({ status: d.status.stringValue, salaryMin: d.salaryMin.integerValue || d.salaryMin.doubleValue, editedAt: !!d.editedAt, approvedAtSame: d.approvedAt.timestampValue.slice(0, 19) === approvedAt.slice(0, 19), expiresSame: d.expiresAt.timestampValue.slice(0, 19) === expiresAt.slice(0, 19), area: d.area?.stringValue, benefits: d.benefits.arrayValue.values.map((x) => x.stringValue).join(",") }));
  const c = (await getDoc(`jobs/${id}/private/contact`)).fields;
  console.log("contact:", c.contactMethod.stringValue, c.contactValue.stringValue);
  // admin re-approves: expiry and posting date should stay
  await patch(`admins/${uid}`, { name: { stringValue: "Mark" } });
  console.log("admin doc:", JSON.stringify(await getDoc(`admins/${uid}`)).slice(0, 120));
  await p.goto("http://localhost:8000/?emu#/admin/pending"); await p.reload(); await p.waitForTimeout(4000);
  console.log("state isAdmin:", await p.evaluate(async (v) => { const m = await import(`/assets/store.js?v=${v}`); return m.getAuthState().isAdmin; }, V));
  await p.waitForSelector(".badge:has-text('Edited')", { timeout: 15000 }).catch(() => {});
  console.log("admin badge:", (await p.locator(".badge", { hasText: "Edited" }).first().textContent().catch(() => "none")));
  console.log("admin page start:", (await p.locator("#app").innerText()).slice(0, 160).replace(/\s+/g, " "));
  await p.locator(".badge", { hasText: "Edited" }).first().scrollIntoViewIfNeeded().catch(() => {}); await p.screenshot({ path: "../admin-edited.png" });
  await p.evaluate(async ({ v, id }) => { const m = await import(`/assets/store.js?v=${v}`); const j = await m.store.getJob(id); await m.store.approve(id, j); }, { v: V, id });
  const d2 = (await getDoc(`jobs/${id}`)).fields;
  console.log("after re-approve:", JSON.stringify({ status: d2.status.stringValue, approvedAtSame: d2.approvedAt.timestampValue.slice(0, 19) === approvedAt.slice(0, 19), expiresSame: d2.expiresAt.timestampValue.slice(0, 19) === expiresAt.slice(0, 19) }));
  console.log("errors:", errs);
  await b.close();
})();
