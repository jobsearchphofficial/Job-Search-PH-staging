const { chromium } = require("playwright");
const FS = "http://127.0.0.1:8085/v1/projects/demo-jsph/databases/(default)/documents";
const H = { authorization: "Bearer owner", "content-type": "application/json" };
const val = (v) => v === null ? { nullValue: null } : Array.isArray(v) ? { arrayValue: { values: v.map(val) } } : typeof v === "number" ? { integerValue: String(v) } : typeof v === "boolean" ? { booleanValue: v } : v instanceof Date ? { timestampValue: v.toISOString() } : typeof v === "object" ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } } : { stringValue: String(v) };
const put = (path, obj) => fetch(`${FS}/${path}`, { method: "PATCH", headers: H, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, val(v)])) }) });
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1100, height: 1000 } });
  await p.exposeFunction("__confirmEmails", async () => { const c = await (await fetch("http://127.0.0.1:9099/emulator/v1/projects/demo-jsph/oobCodes")).json(); for (const x of (c.oobCodes || []).filter((x) => x.requestType === "VERIFY_EMAIL")) await fetch(x.oobLink); });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8000/?emu#/"); await p.waitForTimeout(2500);
  const V = await p.evaluate(() => [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]);
  const { uid, id } = await p.evaluate(async (v) => {
    const m = await import(`/assets/store.js?v=${v}`);
    await m.store.signUpEmail("emp2@example.com", "secret123", "Rea"); await new Promise((r) => setTimeout(r, 1200)); await window.__confirmEmails(); await m.store.refreshVerified();
    await m.store.saveProfile({ role: "employer", fullName: "Rea Alvarez", phone: "09171234567", city: "Bacolod City", companyName: "Alvarez family", fbUrl: "", bizReg: "" });
    const { id } = await m.store.createJob({ title: "Live-in Yaya", category: "Yaya / Nanny", employerName: "Alvarez family", city: "Bacolod City", area: "Mandalagan", workplace: "household", arrangement: "Live-in", schedule: "Full-time", employmentType: "Live-in",
      salaryMin: 10000, salaryMax: 12000, salaryPeriod: "month", hours: "", daysOff: 4, daysOffPer: "month", openings: 1, startDate: "", benefits: ["SSS"], reqExperience: 2, reqEducation: "High school", reqList: ["Childcare experience", "Can cook", "Speaks Hiligaynon"],
      requirements: "", description: "Care for one baby and light cleaning. Family of four in Mandalagan." }, { contactMethod: "messenger", contactValue: "Rhea" });
    return { uid: m.getAuthState().user.uid, id };
  }, V);
  await put(`jobs/${id}?updateMask.fieldPaths=status&updateMask.fieldPaths=approvedAt&updateMask.fieldPaths=expiresAt`, { status: "approved", approvedAt: new Date(), expiresAt: new Date(Date.now() + 30 * 864e5) });
  const mk = (n, applicant, mins) => put(`applications/${id}_${n}`, { jobId: id, jobTitle: "Live-in Yaya", jobCity: "Bacolod City", employerName: "Alvarez family", employerUid: uid, applicantUid: n, status: "new", message: "", createdAt: new Date(Date.now() - mins * 60000), applicant });
  await mk("seekerA", { fullName: "Bea Cruz", phone: "09170000001", city: "Talisay City", jobCategories: ["Yaya / Nanny"], jobTypes: ["Stay-out"], experienceYears: 1, education: "High school level", skills: "", availability: "Within a month" }, 5);
  await mk("seekerB", { fullName: "Ana Reyes", phone: "09170000002", city: "Bacolod City", jobCategories: ["Yaya / Nanny", "Cook"], jobTypes: ["Live-in", "Full-time"], experienceYears: 4, education: "High school graduate · BCNHS", skills: "Cooking, caring for babies, Ilonggo", availability: "Available now", age: 29 }, 60);
  await mk("seekerC", { fullName: "Cy Lim", phone: "09170000003", city: "Kabankalan City", jobCategories: ["Driver"], experienceYears: 10, education: "College graduate", availability: "Available now" }, 1);
  await p.goto(`http://localhost:8000/?emu#/applicants/${id}`); await p.waitForSelector(".applicant", { timeout: 15000 });
  const order = await p.$$eval(".applicant", (els) => els.map((e) => e.querySelector("h3").textContent + " " + (e.querySelector(".fit-score")?.textContent || "") + (e.classList.contains("is-top") ? " [TOP]" : "")));
  console.log("best-fit order:", order.join(" | "));
  await p.screenshot({ path: "../applicants-fit.png", fullPage: false });
  await p.click("text=Newest first"); await p.waitForTimeout(800);
  console.log("newest order:", (await p.$$eval(".applicant h3", (els) => els.map((e) => e.textContent))).join(" | "));
  await p.click("text=Best fit first"); await p.waitForTimeout(500);
  // admin view: make this user admin, but look at someone else's post -> use a second employer post owned by "other"
  await put(`admins/${uid}`, { name: "Mark" });
  await put(`jobs/otherjob`, { title: "Cook", category: "Cook", employerName: "Inasal", city: "Bacolod City", employmentType: "Full-time", salaryMin: 500, salaryPeriod: "day", description: "Cook for a busy inasal stall in Bacolod City.", requirements: "", ownerUid: "otherEmp", status: "approved", featured: false, createdAt: new Date(), approvedAt: new Date(), expiresAt: new Date(Date.now() + 30 * 864e5), workplace: "business", schedule: "Full-time" });
  await put(`applications/otherjob_seekerB`, { jobId: "otherjob", jobTitle: "Cook", jobCity: "Bacolod City", employerName: "Inasal", employerUid: "otherEmp", applicantUid: "seekerB", status: "new", message: "", createdAt: new Date(), applicant: { fullName: "Ana Reyes", city: "Bacolod City", jobCategories: ["Cook"], experienceYears: 4 } });
  await put(`users/otherEmp`, { role: "employer", fullName: "Inasal Owner", phone: "09171111111", city: "Bacolod City", consent: true, createdAt: new Date() });
  await p.goto(`http://localhost:8000/?emu#/job/otherjob`); await p.reload(); await p.waitForSelector("#apply-panel h2", { timeout: 15000 }); await p.waitForTimeout(1500);
  console.log("job page admin panel:", (await p.locator("#apply-panel").innerText()).replace(/\s+/g, " ").slice(0, 120));
  await p.click("text=See who applied"); await p.waitForSelector(".applicant", { timeout: 15000 });
  console.log("admin applicants:", await p.locator(".applicant h3").count(), "| action buttons:", await p.locator(".applicant [data-st]").count(), "| note:", (await p.locator(".notice").first().textContent()).slice(0, 40));
  await p.goto(`http://localhost:8000/?emu#/admin/user/otherEmp`); await p.waitForTimeout(3000);
  console.log("user page posts line:", (await p.locator(".au-list li").first().innerText()).replace(/\s+/g, " "));
  console.log("ban form hidden until opened:", !(await p.locator("#au-ban").isVisible()), "| summary:", await p.locator(".au-more summary").textContent());
  await p.screenshot({ path: "../admin-user.png" });
  console.log("errors:", errs);
  await b.close();
})();
