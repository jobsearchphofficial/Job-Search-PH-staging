const { chromium } = require("playwright");
async function confirmEmails() { const codes = await (await fetch("http://127.0.0.1:9099/emulator/v1/projects/demo-jsph/oobCodes")).json(); for (const c of codes.oobCodes.filter((c) => c.requestType === "VERIFY_EMAIL")) await fetch(c.oobLink); }
(async () => { const b = await chromium.launch(); const S = process.argv[2];
  for (const role of ["employer", "jobseeker"]) {
    const ctx = await b.newContext({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on("pageerror", (e) => console.log("ERR", e.message));
    await p.goto(`http://localhost:8000/?emu#/join/${role}`); await p.waitForSelector("#s-email");
    console.log(role, "name boxes on sign-up:", await p.locator("[name=firstName]").count(), "birth:", await p.locator("#s-birth").count());
    await p.screenshot({ path: `${S}/short-signup-${role}.png`, fullPage: true });
    await p.fill("#s-email", `sh${role}${Date.now()}@example.com`); await p.fill("#s-pw", "secret123"); await p.fill("#s-pw2", "secret123");
    await p.click("#email-form button[type=submit]"); await p.waitForTimeout(2500);
    await confirmEmails(); await p.goto("http://localhost:8000/?emu#/profile"); await p.reload(); await p.waitForTimeout(2500);
    if (role === "employer") { await p.click(".ob-opt:has([value=household])"); await p.click(".ob-next"); await p.waitForTimeout(400);
      console.log("step 2 h1:", await p.locator("#app h1, #app h2").first().innerText()); }
    else console.log("profile name boxes:", await p.locator("[name=firstName]:visible").count(), "birth:", await p.locator("[name=birthDate]:visible").count(), "known-row:", await p.locator("#known-row").count());
    await p.screenshot({ path: `${S}/short-after-${role}.png`, fullPage: role !== "employer" });
    await ctx.close(); }
  await b.close(); })();
