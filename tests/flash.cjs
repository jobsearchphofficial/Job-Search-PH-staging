const { chromium } = require("playwright");
const FS = "http://127.0.0.1:8085/v1/projects/demo-jsph/databases/(default)/documents";
async function confirmEmails() { const codes = await (await fetch("http://127.0.0.1:9099/emulator/v1/projects/demo-jsph/oobCodes")).json(); for (const c of codes.oobCodes.filter((c) => c.requestType === "VERIFY_EMAIL")) await fetch(c.oobLink); }
(async () => { const b = await chromium.launch(); const S = process.argv[2]; const p = await b.newPage({ viewport: { width: 1000, height: 800 } }); p.on("pageerror", (e) => console.log("ERR", e.message));
  const frames = async (tag, n = 8, gap = 120) => { const seen = []; for (let k = 0; k < n; k++) { seen.push((await p.locator("#app h1").first().innerText().catch(() => "?")).slice(0, 40)); if (k < 3) await p.screenshot({ path: `${S}/fl-${tag}-${k}.png` }); await p.waitForTimeout(gap); } console.log(tag, "->", seen.join(" | ")); };
  await p.goto("http://localhost:8000/?emu#/join/employer"); await p.waitForSelector("[name=firstName]");
  await p.fill("[name=firstName]", "Rea"); await p.fill("[name=lastName]", "Alvarez"); await p.fill("#s-email", `fl${Date.now()}@example.com`); await p.fill("#s-pw", "secret123"); await p.fill("#s-pw2", "secret123");
  await p.click("#email-form button[type=submit]"); await frames("after-create");
  await confirmEmails(); await p.goto("http://localhost:8000/?emu#/profile"); await p.reload(); await p.waitForSelector(".ob");
  const uid = await p.evaluate(async () => { const v = [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]; return (await import(`/assets/store.js?v=${v}`)).getAuthState().user.uid; });
  await p.click(".ob-opt:has([value=household])"); await p.click(".ob-next"); await p.fill("[name=companyName]", "Alvarez Family"); await p.click(".ob-next");
  await p.click(".picker-btn"); await p.click('.picker-opt[data-v="Silay City"]'); await p.click(".ob-next");
  await p.fill("[name=phone]", "0917 123 4567"); await p.click(".ob-next"); await p.click(".ob-opt:has([value='Cook'])"); await p.click(".ob-next");
  await p.check("[name=consent]"); await p.click(".ob-next"); await frames("after-finish", 12, 150);
  console.log("final url:", p.url().split("#")[1]); await b.close(); })();
