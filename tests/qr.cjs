const { chromium } = require("playwright");
(async () => { const b = await chromium.launch(); const p = await b.newPage(); p.on("console", (m) => console.log("console", m.text())); p.on("pageerror", (e) => console.log("ERR", e.message));
 await p.goto("http://localhost:8000/?emu#/safety"); await p.waitForTimeout(1500);
 const r = await p.evaluate(async () => { try { await new Promise((ok, bad) => { const el = document.createElement("script"); el.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; el.onload = ok; el.onerror = () => bad(new Error("load")); document.head.appendChild(el); }); const box = document.createElement("div"); new window.QRCode(box, { text: "https://x.y", width: 256, height: 256 }); await new Promise((r) => setTimeout(r, 200)); return box.innerHTML.slice(0, 80); } catch (e) { return "fail " + e.message; } });
 console.log(r); await b.close(); })();
