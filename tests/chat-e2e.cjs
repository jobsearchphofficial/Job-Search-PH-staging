const { chromium } = require("playwright");
const FS = "http://127.0.0.1:8085/v1/projects/demo-jsph/databases/(default)/documents";
const H = { authorization: "Bearer owner", "content-type": "application/json" };
const val = (v) => v === null ? { nullValue: null } : Array.isArray(v) ? { arrayValue: { values: v.map(val) } } : typeof v === "number" ? { integerValue: String(v) } : typeof v === "boolean" ? { booleanValue: v } : v instanceof Date ? { timestampValue: v.toISOString() } : { stringValue: String(v) };
const put = (path, obj) => fetch(`${FS}/${path}`, { method: "PATCH", headers: H, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, val(v)])) }) });
const V = (p) => p.evaluate(() => [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]);
async function signUp(ctx, email, name, profile) {
  const p = await ctx.newPage(); p.on("pageerror", (e) => console.log("PAGE ERROR", email, e.message));
  await p.goto("http://localhost:8000/?emu#/"); await p.waitForTimeout(2000);
  const uid = await p.evaluate(async ({ v, email, name, profile }) => { const m = await import(`/assets/store.js?v=${v}`); await m.store.signUpEmail(email, "secret123", name); await new Promise((r) => setTimeout(r, 1200)); await m.store.saveProfile(profile); return m.getAuthState().user.uid; }, { v: await V(p), email, name, profile });
  return { p, uid };
}
(async () => {
  const b = await chromium.launch();
  const emp = await signUp(await b.newContext({ viewport: { width: 420, height: 860 } }), "emp@example.com", "Rea", { role: "employer", fullName: "Rea Alvarez", phone: "09171234567", city: "Bacolod City", companyName: "Alvarez family", fbUrl: "", bizReg: "" });
  await put("jobs/j1", { title: "Live-in Yaya", category: "Yaya / Nanny", employerName: "Alvarez family", city: "Bacolod City", employmentType: "Live-in", salaryMin: 10000, salaryPeriod: "month", description: "Care for one baby and light cleaning, family of four.", requirements: "", ownerUid: emp.uid, status: "approved", featured: false, createdAt: new Date(), approvedAt: new Date(), expiresAt: new Date(Date.now() + 30 * 864e5) });
  const seek = await signUp(await b.newContext({ viewport: { width: 420, height: 860 } }), "seek@example.com", "Ana", { role: "jobseeker", fullName: "Ana Reyes", phone: "09170000002", city: "Bacolod City", birthDate: "1995-01-01", jobCategories: ["Yaya / Nanny"], jobTypes: [] });
  await seek.p.evaluate(async ({ v }) => { const m = await import(`/assets/store.js?v=${v}`); const j = await m.store.getJob("j1"); await m.store.apply(j, "Hello po, interested ako."); }, { v: await V(seek.p) });
  const appId = `j1_${seek.uid}`;
  // jobseeker sends a photo
  await seek.p.goto(`http://localhost:8000/?emu#/chat/${appId}`); await seek.p.waitForSelector("#chat-photo", { state: "attached", timeout: 15000 }); await seek.p.waitForTimeout(800);
  await seek.p.setInputFiles("#chat-photo", "test-photo.png"); await seek.p.waitForSelector(".photo-preview", { timeout: 10000 });
  const size = await seek.p.evaluate(() => document.querySelector(".photo-preview").src.length);
  seek.p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("SEEKER CONSOLE:", m.text().slice(0, 300)); });
  console.log("dialog buttons:", await seek.p.$$eval("button", (bs) => bs.filter((x) => x.offsetParent).map((x) => x.textContent.trim()).join(" | ")));
  await seek.p.getByRole("button", { name: "Send photo" }).click(); await seek.p.waitForTimeout(3000);
  console.log("dialog still open:", await seek.p.locator(".photo-preview").count());
  const msgs = await (await fetch(`${FS}/applications/${appId}/messages`, { headers: H })).json(); console.log("messages in db:", (msgs.documents || []).length, (msgs.documents || []).map((d) => Object.keys(d.fields).join("+")).join(" ; "));
  console.log("toast:", await seek.p.locator(".toast").last().textContent().catch(() => "-"), "| photos:", await seek.p.locator(".msg-photo").count());
  await seek.p.waitForSelector(".msg-photo", { timeout: 15000 });
  console.log("photo sent, size:", size, "chars | shown in chat:", await seek.p.locator(".msg.mine .msg-photo").count());
  // employer tries a scam-looking message
  await emp.p.goto(`http://localhost:8000/?emu#/chat/${appId}`); await emp.p.waitForSelector("#chat-input", { timeout: 15000 }); await emp.p.waitForTimeout(1500);
  console.log("employer sees the photo:", await emp.p.locator(".msg.theirs .msg-photo").count());
  await emp.p.fill("#chat-input", "Ok. Pls send 500 sa GCash ko para sa training fee bago start."); await emp.p.click("#chat-form button[type=submit]");
  await emp.p.waitForTimeout(800);
  console.log("employer warning dialog:", await emp.p.locator("text=Asking for money isn't allowed").count() ? "shown" : "NOT shown");
  await emp.p.screenshot({ path: "../chat-warning.png" });
  await emp.p.getByRole("button", { name: "Send anyway" }).click(); await emp.p.waitForTimeout(3000);
  await seek.p.waitForSelector(".msg-warn", { timeout: 15000 });
  console.log("jobseeker sees warning:", (await seek.p.locator(".msg-warn").first().textContent()).slice(0, 90));
  await seek.p.screenshot({ path: "../chat-seeker.png" });
  const app = await (await fetch(`${FS}/applications/${appId}`, { headers: H })).json();
  console.log("inbox preview text:", app.fields.lastMessageText.stringValue.slice(0, 50));
  // admin (a third person) reads the chat
  const adm = await signUp(await b.newContext({ viewport: { width: 420, height: 860 } }), "boss@example.com", "Mark", { role: "employer", fullName: "Mark J", phone: "09179999999", city: "Bacolod City", companyName: "", fbUrl: "", bizReg: "" });
  await put(`admins/${adm.uid}`, { name: "Mark" });
  await adm.p.goto(`http://localhost:8000/?emu#/chat/${appId}`); await adm.p.reload(); await adm.p.waitForSelector(".msg", { timeout: 15000 });
  console.log("admin chat view: messages", await adm.p.locator(".msg").count(), "| send form:", await adm.p.locator("#chat-form").count(), "| offer buttons:", await adm.p.locator("[data-offer]").count(), "| note:", (await adm.p.locator(".chat-note").textContent()).slice(0, 30));
  await b.close();
})();
