const { chromium } = require("playwright");
const FS = "http://127.0.0.1:8085/v1/projects/demo-jsph/databases/(default)/documents";
const val = (f) => f && (f.stringValue ?? f.doubleValue ?? f.integerValue ?? f.booleanValue);
(async () => {
  const b = await chromium.launch();
  for (const vp of [{ width: 1280, height: 1000, tag: "desk" }, { width: 390, height: 860, tag: "mob" }]) {
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height } });
    const p = await ctx.newPage(); p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
    let dry = {}; p.on("response", async (r) => { const u = r.url(); if (u.includes(":8787/email/")) { try { const j = await r.json(); dry[u.split("/").pop()] = j.dryUrl; } catch {} } });
    const email = `su${Date.now()}@example.com`;
    await p.goto("http://localhost:8000/?emu#/join/jobseeker"); await p.waitForSelector(".su-role");
    console.log(`[${vp.tag}] role preselected:`, await p.locator("[name=su-role]:checked").getAttribute("value"), "| birthdate box:", await p.locator("#s-birth").count());
    await p.screenshot({ path: `../signup-${vp.tag}.png`, fullPage: true });
    await p.fill("[name=firstName]", "maria"); await p.fill("[name=middleName]", "reyes"); await p.fill("#s-email", email); await p.fill("#s-pw", "secret123");
    await p.click("#email-form button[type=submit]"); console.log("  no last name:", await p.locator("#auth-error").innerText());
    await p.fill("[name=lastName]", "santos"); await p.fill("#s-birth", "2012-01-01");
    await p.click("#email-form button[type=submit]"); console.log("  underage:", await p.locator("#auth-error").innerText());
    await p.fill("#s-birth", "1995-03-04"); console.log("  age pill:", await p.locator("#su-age").innerText());
    // switch to employer and back keeps typed values
    await p.click(".su-opt:has([value=employer])"); console.log("  employer: birthdate box", await p.locator("#s-birth").count(), "| first name kept:", await p.inputValue("[name=firstName]"));
    await p.click(".su-opt:has([value=jobseeker])"); console.log("  back: birth kept:", await p.inputValue("#s-birth"));
    await p.fill("#s-pw", "secret123");
    await p.click("#email-form button[type=submit]");
    await p.waitForSelector(".ce-card", { timeout: 15000 }); await p.waitForTimeout(800);
    await p.goto(dry.verify + "&emu"); await p.waitForTimeout(3000);
    await p.click(".ce-actions a"); await p.waitForSelector("#profile-form", { timeout: 15000 });
    console.log("  profile: role cards", await p.locator(".role-pick").count(), "| known row:", (await p.locator("#known-row").innerText()).replace(/\s+/g, " "));
    console.log("  name boxes hidden:", await p.locator("[name=firstName]").isHidden(), "| birthdate hidden:", await p.locator("[name=birthDate]").isHidden(), "| <select> in form:", await p.locator("#profile-form select").count());
    const order = await p.evaluate(() => { const els = [...document.querySelectorAll("#profile-form > *")]; return [els.findIndex((e) => e.id === "strength"), els.findIndex((e) => e.querySelector?.("[name=consent]")), els.length]; });
    console.log("  strength index / consent index / children:", order.join(" / "));
    await p.fill("[name=phone]", "0917 123 4567");
    await p.click(".picker-btn"); await p.fill(".picker-search", "sil"); 
    console.log("  search 'sil' shows:", (await p.locator(".picker-opt:visible").allInnerTexts()).join(", "));
    await p.screenshot({ path: `../profile-new-${vp.tag}.png`, fullPage: true });
    await p.keyboard.press("Enter"); console.log("  city:", await p.locator(".picker-val").innerText());
    await p.click(".pill:has([name=jobCategories][value='Yaya / Nanny'])").catch(async () => { await p.click("label.chip:has-text('Yaya')"); });
    await p.click("label.pill:has([name=experienceYears][value='0.5'])");
    await p.click("label.pill:has([name=availability][value='Available now'])");
    await p.click("label.pill:has([name=availability][value='Available now'])"); // tap again clears
    console.log("  availability after 2nd tap:", await p.locator("[name=availability]:checked").count());
    await p.click("label.pill:has([name=availability][value='Within 2 weeks'])");
    await p.click("label.pill:has([name=eduLevel][value='College graduate'])").catch(() => console.log("  (no College graduate option)"));
    await p.check("[name=consent]"); await p.click("#profile-form button[type=submit]");
    await p.waitForFunction(() => !location.hash.startsWith("#/profile"), null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(1500);
    const dlg = p.locator(".dlg-backdrop button"); if (await dlg.count()) { await dlg.first().click(); await p.waitForTimeout(1000); }
    console.log("  after save ->", await p.evaluate(() => location.hash));
    const uid = await p.evaluate(async () => { const v = [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]; return (await import(`/assets/store.js?v=${v}`)).getAuthState().user.uid; });
    const doc = await (await fetch(`${FS}/users/${uid}`, { headers: { authorization: "Bearer owner" } })).json();
    const F = doc.fields; console.log("  saved:", ["fullName", "firstName", "middleName", "lastName", "birthDate", "city", "experienceYears", "availability", "education", "role"].map((k) => `${k}=${val(F[k])}`).join(" | "));
    console.log("  signup info cleared:", await p.evaluate(() => localStorage.getItem("jsph:signup")));
    await p.evaluate(() => { location.hash = "#/profile"; }); await p.waitForSelector("#profile-form"); await p.waitForTimeout(500);
    console.log("  edit profile: names", await p.inputValue("[name=firstName]"), "/", await p.inputValue("[name=middleName]"), "/", await p.inputValue("[name=lastName]"), "| visible:", await p.locator("[name=firstName]").isVisible(), "| exp checked:", await p.locator("[name=experienceYears]:checked").getAttribute("value"));
    await p.screenshot({ path: `../profile-edit-${vp.tag}.png`, fullPage: true });
    await ctx.close();
  }
  await b.close();
})();
