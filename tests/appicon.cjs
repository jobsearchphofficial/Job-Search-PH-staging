const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
  await p.setContent(`<html><body style="margin:0"><div style="width:1024px;height:1024px;background:linear-gradient(135deg,#1f57dc,#2149b0);display:grid;place-items:center">
    <div style="width:668px;height:668px;border-radius:50%;background:#fff;display:grid;place-items:center">
      <svg viewBox="0 0 24 24" width="330" height="330" fill="none" stroke="#2353d0" stroke-width="1.5" stroke-linejoin="round"><rect x="3" y="7.5" width="18" height="12" rx="1.8"/><path d="M8.5 7.5V5.6c0-.9.7-1.6 1.6-1.6h3.8c.9 0 1.6.7 1.6 1.6v1.9"/><path d="M9 7.5v12M15 7.5v12"/></svg>
    </div></div></body></html>`);
  await p.screenshot({ path: process.argv[2] }); await b.close();
})();
