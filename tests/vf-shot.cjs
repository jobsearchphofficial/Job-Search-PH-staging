const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1000, height: 1300 } });
  await p.exposeFunction("__confirmEmails", async () => { const c = await (await fetch("http://127.0.0.1:9099/emulator/v1/projects/demo-jsph/oobCodes")).json(); for (const x of (c.oobCodes || []).filter((x) => x.requestType === "VERIFY_EMAIL")) await fetch(x.oobLink); });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8000/?emu#/"); await p.waitForTimeout(2500);
  const v = await p.evaluate(() => [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]);
  await p.evaluate(async (v) => { const m = await import(`/assets/store.js?v=${v}`); await m.store.signUpEmail("vf@example.com", "secret123", "Rea"); await new Promise((r) => setTimeout(r, 1200)); await window.__confirmEmails(); await m.store.refreshVerified();
    await m.store.saveProfile({ role: "employer", fullName: "Rea Alvarez", phone: "09171234567", city: "Bacolod City", companyName: "Alvarez family", fbUrl: "https://facebook.com/rea.alvarez", bizReg: "" }); }, v);
  await p.goto("http://localhost:8000/?emu#/profile"); await p.reload(); await p.waitForSelector("#profile-form", { timeout: 15000 }); await p.waitForTimeout(800);
  console.log("employer Messenger field:", await p.locator("#profile-form [name=messenger]").count(), "| Facebook field:", await p.locator("#profile-form [name=fbUrl]").count());
  console.log("hint height:", (await p.locator(".vf-hint").boundingBox()).height);
  await p.screenshot({ path: "../vf-fixed.png" });
  await p.goto("http://localhost:8000/?emu#/post"); await p.waitForSelector(".crow", { timeout: 15000 });
  console.log("post contacts:", (await p.$$eval(".crow", (rs) => rs.map((r) => r.querySelector("select").value + ":" + r.querySelector("input").value))).join(" | "));
  console.log("errors:", errs); await b.close();
})();
