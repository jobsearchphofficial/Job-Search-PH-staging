SP="$(cd "$(dirname "$0")" && pwd)"
node chat-e2e.cjs
cd /home/claude/job-search-ph && FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 EMAIL_OUTBOX=$SP/outbox-chat node scripts/send-emails.mjs | grep -E "Flagged|Sent|Done"
head -qn1 $SP/outbox-chat/*admin*.html
cd $SP/rt && node -e '
const { chromium } = require("playwright");
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1000, height: 800 } }); const p = await ctx.newPage();
  await p.goto("http://localhost:8000/?emu#/"); await p.waitForTimeout(2500);
  const v = await p.evaluate(() => [...document.scripts].find((s) => s.src.includes("app.js")).src.split("?v=")[1]);
  await p.evaluate(async (v) => { const m = await import(`/assets/store.js?v=${v}`); await m.store.signInEmail("boss@example.com", "secret123"); }, v);
  await p.waitForTimeout(1500);
  await p.goto("http://localhost:8000/?emu#/admin/flags"); await p.reload(); await p.waitForSelector("#admin-body .trow, #admin-body .empty", { timeout: 15000 }); await p.waitForTimeout(800);
  console.log("admin flags tab:", (await p.locator("#admin-body").innerText()).replace(/\s+/g, " ").slice(0, 300));
  await p.screenshot({ path: "../admin-flags.png" }); await b.close(); })();'
