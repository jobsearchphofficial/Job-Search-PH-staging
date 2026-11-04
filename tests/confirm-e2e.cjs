const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8000/?emu#/"); await p.waitForTimeout(2500);
  const V = await p.evaluate(() => [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]);
  const uid = await p.evaluate(async (v) => { const m = await import(`/assets/store.js?v=${v}`); await m.store.signUpEmail("newemp@example.com", "secret123", "Nina"); await new Promise((r) => setTimeout(r, 1500));
    await m.store.saveProfile({ role: "employer", fullName: "Nina Cruz", phone: "09171234567", city: "Bacolod City", companyName: "", fbUrl: "", bizReg: "" }); return m.getAuthState().user.uid; }, V);
  const codes = await (await fetch("http://127.0.0.1:9099/emulator/v1/projects/demo-jsph/oobCodes")).json();
  console.log("verification email sent on sign-up:", codes.oobCodes.some((c) => c.email === "newemp@example.com" && c.requestType === "VERIFY_EMAIL"));
  await p.goto("http://localhost:8000/?emu#/post"); await p.reload(); await p.waitForSelector("#confirm-email", { timeout: 15000 });
  console.log("post page shows confirm box:", await p.locator("#confirm-email").isVisible(), "| form hidden:", !(await p.locator("#post-form").count()));
  await p.screenshot({ path: "../confirm-email.png" });
  await p.click("[data-confirm=check]"); await p.waitForTimeout(1500);
  console.log("before clicking link:", await p.locator(".toast").last().textContent().catch(() => "-"));
  const link = codes.oobCodes.find((c) => c.email === "newemp@example.com").oobLink;
  await fetch(link); // same as clicking the link in the email
  await p.click("[data-confirm=check]"); await p.waitForSelector("#post-form", { timeout: 15000 });
  console.log("after confirming: post form shown:", await p.locator("#post-form").isVisible());
  const prof = await p.evaluate(async (v) => { const m = await import(`/assets/store.js?v=${v}`); return { must: m.getAuthState().mustConfirmEmail, saved: m.getAuthState().profile.emailVerified }; }, V);
  console.log("state after:", JSON.stringify(prof));
  console.log("errors:", errs); await b.close();
})();
