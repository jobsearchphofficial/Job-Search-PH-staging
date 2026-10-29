// Job Search PH · helper (Cloudflare Worker, free plan). Does the few things a static site can't:
//  1. Mobile number confirmation: texts a 6-digit code (UniSMS) to the number on the profile, then checks it.
//  2. Account emails (confirm your email, reset password) sent from noreply@jobsearchph.com through Resend,
//     in the Job Search PH design, with links to jobsearchph.com (instead of Firebase's plain emails).
// One helper serves both sites: the Firebase project in the request picks the database.
//
// Endpoints:
//   POST /send          (signed in) texts a code to the number on users/{uid}.phone
//   POST /verify        (signed in) {code} → if right, writes phoneVerified/{uid} = { phone, at }
//   POST /email/verify  (signed in) emails a "confirm your email" link
//   POST /email/reset   {email, project} emails a "reset your password" link (always answers ok)
//
// Settings (Cloudflare → Workers → this worker → Settings → Variables and secrets):
//   UNISMS_KEY     secret  UniSMS API secret key
//   RESEND_KEY     secret  Resend API key (same as the GitHub RESEND_API_KEY secret)
//   SA_LIVE        secret  service-account JSON of job-search-ph-website
//   SA_STAGING     secret  service-account JSON of job-search-ph-staging
//   SENDER_ID      text    the sender name shown in UniSMS (e.g. "UniSMS" until your own is approved)
//   DAILY_CAP      text    optional, most texts per day for the whole site (default 150)
//   MAIL_FROM      text    optional, default "Job Search PH <noreply@jobsearchph.com>"
// For local tests only: EMULATOR_HOST (Firestore emulator), AUTH_EMULATOR_HOST, DRY=1 (nothing really sent;
// the code / email comes back in the response).

const ORIGINS = ["https://jobsearchph.com", "https://www.jobsearchph.com", "https://staging.jobsearchph.com", "https://jobsearchphofficial.github.io", "http://localhost:8000"];
const PROJECTS = { "job-search-ph-website": "SA_LIVE", "job-search-ph-staging": "SA_STAGING", "demo-jsph": "SA_EMULATOR" };
const SITES = { "job-search-ph-website": "https://jobsearchph.com", "job-search-ph-staging": "https://staging.jobsearchph.com", "demo-jsph": "http://localhost:8000" };
const CODE_MINUTES = 10, COOLDOWN_S = 60, PER_USER_DAY = 3, PER_PHONE_DAY = 3, MAX_TRIES = 5;

export default {
  async fetch(req, env) {
    const origin = req.headers.get("origin") || "";
    const cors = { "access-control-allow-origin": ORIGINS.includes(origin) ? origin : ORIGINS[0], "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "POST, OPTIONS", "access-control-max-age": "86400", vary: "origin" };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const path = new URL(req.url).pathname;
    if (req.method === "GET" && path === "/") return reply(200, { ok: true, service: "Job Search PH SMS helper" });
    if (req.method !== "POST" || !["/send", "/verify", "/email/verify", "/email/reset"].includes(path)) return reply(404, { error: "not_found" });
    try {
      if (path === "/email/reset") return await resetEmail(await req.json().catch(() => ({})), env, reply);
      const who = await checkToken((req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""), env);
      if (!who) return reply(401, { error: "signin" });
      const db = await firestore(who.project, env);
      if (await db.get(`bans/${who.uid}`)) return reply(403, { error: "banned" });
      const body = await req.json().catch(() => ({}));
      if (path === "/email/verify") return await verifyEmail(who, db, env, reply);
      return path === "/send" ? await send(who, db, env, reply) : await verify(who, db, body, reply);
    } catch (e) {
      console.error(e.stack || e.message);
      // Which step failed (no secret values): "secret", "google", "firestore", "auth" or "mail".
      const m = String(e.message || "");
      const step = /secret/i.test(m) || e instanceof SyntaxError ? "secret" : /^Google/.test(m) ? "google" : /^Firestore/.test(m) ? "firestore" : /sendOobCode/.test(m) ? "auth" : "other";
      const detail = `${e.name || "Error"}: ${m.replace(/[A-Za-z0-9+/_=-]{24,}/g, "…").slice(0, 120)}`; // long tokens blanked out
      return reply(500, { error: "server", step, status: (m.match(/\b(\d{3})\b/) || [])[1] || null, detail });
    }
  },
};

/* ---------- Send a code ---------- */
async function send(who, db, env, reply) {
  const user = await db.get(`users/${who.uid}`);
  const phone = normPhone(user?.phone);
  if (!phone) return reply(400, { error: "phone", message: "Add a valid mobile number (09XX XXX XXXX) to your profile first." });
  const done = await db.get(`phoneVerified/${who.uid}`);
  if (done && done.phone === phone) return reply(200, { ok: true, already: true });

  const now = Date.now(), day = phDay(now);
  const mine = (await db.get(`smsCodes/${who.uid}`)) || {};
  if (mine.lastSentAt && now - mine.lastSentAt < COOLDOWN_S * 1000) return reply(429, { error: "wait", wait: Math.ceil((COOLDOWN_S * 1000 - (now - mine.lastSentAt)) / 1000) });
  const sentToday = mine.day === day ? mine.sentToday || 0 : 0;
  if (sentToday >= PER_USER_DAY) return reply(429, { error: "limit", message: "You've asked for 3 codes today. Try again tomorrow, or contact support." });
  const ph = (await db.get(`smsPhones/${phone.slice(1)}`)) || {};
  const phoneToday = ph.day === day ? ph.count || 0 : 0;
  if (phoneToday >= PER_PHONE_DAY) return reply(429, { error: "limit", message: "Too many codes went to this number today. Try again tomorrow." });
  const all = (await db.get("meta/sms")) || {};
  const allToday = all.day === day ? all.count || 0 : 0;
  if (allToday >= Number(env.DAILY_CAP || 150)) return reply(503, { error: "busy", message: "We can't send texts right now. Please try again tomorrow." });

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
  // Count first, so a failed send still uses up a try (stops loops).
  await db.set(`smsCodes/${who.uid}`, { hash: await sha(`${who.uid}:${code}`), phone, expiresAt: new Date(now + CODE_MINUTES * 60000), tries: 0, lastSentAt: new Date(now), day, sentToday: sentToday + 1 });
  await db.set(`smsPhones/${phone.slice(1)}`, { day, count: phoneToday + 1 });
  await db.set("meta/sms", { day, count: allToday + 1 });

  const text = `Your Job Search PH code is ${code}. It expires in ${CODE_MINUTES} minutes. Don't share this code with anyone, even if they say they're from Job Search PH.`;
  if (env.DRY === "1" && env.EMULATOR_HOST) return reply(200, { ok: true, to: mask(phone), dryCode: code });
  const res = await fetch("https://unismsapi.com/api/sms", {
    method: "POST",
    headers: { authorization: `Basic ${btoa(`${env.UNISMS_KEY}:`)}`, "content-type": "application/json" },
    body: JSON.stringify({ recipient: phone, content: text, sender_id: env.SENDER_ID || "UniSMS", metadata: { purpose: "phone-confirm" } }),
  });
  if (!res.ok) {
    console.error(`UniSMS ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return reply(502, { error: "send_failed", message: "We couldn't send the text right now. Please try again later." });
  }
  return reply(200, { ok: true, to: mask(phone) });
}

/* ---------- Check a code ---------- */
async function verify(who, db, body, reply) {
  const code = String(body.code || "").replace(/\D/g, "");
  if (code.length !== 6) return reply(400, { error: "code", message: "Enter the 6-digit code." });
  const c = await db.get(`smsCodes/${who.uid}`);
  if (!c?.hash) return reply(400, { error: "nocode", message: "Ask for a new code first." });
  if (!c.expiresAt || c.expiresAt < Date.now()) return reply(400, { error: "expired", message: "That code expired. Ask for a new one." });
  if ((c.tries || 0) >= MAX_TRIES) return reply(400, { error: "tries", message: "Too many wrong tries. Ask for a new code." });
  if ((await sha(`${who.uid}:${code}`)) !== c.hash) {
    await db.set(`smsCodes/${who.uid}`, { ...c, expiresAt: new Date(c.expiresAt), lastSentAt: new Date(c.lastSentAt), tries: (c.tries || 0) + 1 });
    const left = MAX_TRIES - (c.tries || 0) - 1;
    return reply(400, { error: "wrong", message: left > 0 ? `That code isn't right. ${left} tr${left === 1 ? "y" : "ies"} left.` : "Too many wrong tries. Ask for a new code." });
  }
  await db.set(`phoneVerified/${who.uid}`, { phone: c.phone, at: new Date() });
  // Keep the daily counters (so limits still apply), but forget the code.
  await db.set(`smsCodes/${who.uid}`, { lastSentAt: new Date(c.lastSentAt), day: c.day, sentToday: c.sentToday });
  return reply(200, { ok: true });
}

/* ---------- Account emails ---------- */
const MAIL_PER_MIN = 1, MAIL_PER_DAY = 5, MAIL_DAILY_CAP = 300;

// One-time link from Firebase Auth (VERIFY_EMAIL or PASSWORD_RESET). Returns the oobCode, or null if no such account.
async function oobCode(project, env, requestType, email) {
  const base = env.AUTH_EMULATOR_HOST ? `http://${env.AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com` : "https://identitytoolkit.googleapis.com";
  const r = await fetch(`${base}/v1/projects/${project}/accounts:sendOobCode`, {
    method: "POST", headers: { authorization: await googleAuth(project, env), "content-type": "application/json" },
    body: JSON.stringify({ requestType, email, returnOobLink: true }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) { if (/EMAIL_NOT_FOUND|USER_NOT_FOUND/.test(out.error?.message || "")) return null; throw new Error(`sendOobCode ${r.status} ${JSON.stringify(out).slice(0, 200)}`); }
  return new URL(out.oobLink).searchParams.get("oobCode");
}

// Shared limits: per key (account or email), and for the whole site.
async function mailLimit(db, key) {
  const now = Date.now(), day = phDay(now);
  const m = (await db.get(`mailLimits/${key}`)) || {};
  if (m.lastAt && now - m.lastAt < 60000 / MAIL_PER_MIN) return { wait: Math.ceil((60000 - (now - m.lastAt)) / 1000) };
  const today = m.day === day ? m.count || 0 : 0;
  if (today >= MAIL_PER_DAY) return { limit: true };
  const all = (await db.get("meta/mail")) || {};
  const allToday = all.day === day ? all.count || 0 : 0;
  if (allToday >= MAIL_DAILY_CAP) return { limit: true };
  await db.set(`mailLimits/${key}`, { lastAt: new Date(now), day, count: today + 1 });
  await db.set("meta/mail", { day, count: allToday + 1 });
  return {};
}

async function verifyEmail(who, db, env, reply) {
  if (!who.email) return reply(400, { error: "noemail", message: "This account has no email address." });
  if (who.emailVerified || who.provider !== "password") return reply(200, { ok: true, already: true });
  const lim = await mailLimit(db, who.uid);
  if (lim.wait) return reply(429, { error: "wait", wait: lim.wait, message: `Wait ${lim.wait}s before asking for another email.` });
  if (lim.limit) return reply(429, { error: "limit", message: "We've sent you several emails today. Check your Spam folder, or try again tomorrow." });
  const code = await oobCode(who.project, env, "VERIFY_EMAIL", who.email);
  if (!code) return reply(400, { error: "noaccount" });
  const user = await db.get(`users/${who.uid}`);
  const first = String(user?.fullName || who.name || "").trim().split(/\s+/)[0] || "there";
  const url = `${SITES[who.project]}/?mode=verifyEmail&oobCode=${encodeURIComponent(code)}`;
  const mail = {
    to: who.email, subject: "Confirm your email for Job Search PH",
    html: layout({ site: SITES[who.project], title: "Confirm your email", preheader: "One tap and your account is ready.", body: `
      <p style="margin:0 0 12px 0;font-size:16px;line-height:26px;color:#2b2f3a;">Hi ${esc(first)}, welcome to Job Search PH! Tap the button to confirm that <strong>${esc(who.email)}</strong> is your email address.</p>
      ${button(url, "Confirm my email")}
      <p style="margin:14px 0 0 0;font-size:13px;line-height:20px;color:#6b7186;">If the button doesn't open, copy this link into your browser:<br><a href="${esc(url)}" style="color:#3d4fd6;word-break:break-all;font-size:13px;">${esc(url)}</a></p>`,
      footerNote: "You're getting this because someone created a Job Search PH account with this email. If it wasn't you, you can ignore this email." }),
    text: `Hi ${first}, confirm your email for Job Search PH: ${url}\n\nIf you didn't create an account, ignore this email.`,
  };
  const sent = await sendMail(env, mail);
  return reply(sent.ok ? 200 : 502, sent.ok ? { ok: true, ...(sent.dry ? { dryUrl: url } : {}) } : { error: "send_failed", message: "We couldn't send the email right now. Try again in a few minutes." });
}

async function resetEmail(body, env, reply) {
  const email = String(body.email || "").trim().toLowerCase();
  const project = String(body.project || "");
  if (!SITES[project] || (project === "demo-jsph" && !env.EMULATOR_HOST)) return reply(400, { error: "project" });
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email) || email.length > 200) return reply(400, { error: "email", message: "Enter a valid email address." });
  const db = await firestore(project, env);
  const lim = await mailLimit(db, `reset_${(await sha(email)).slice(0, 32)}`);
  if (lim.wait) return reply(429, { error: "wait", wait: lim.wait, message: `Wait ${lim.wait}s before asking for another email.` });
  if (lim.limit) return reply(200, { ok: true }); // don't reveal anything; just stop sending
  const code = await oobCode(project, env, "PASSWORD_RESET", email);
  if (!code) return reply(200, { ok: true }); // no account with that email: same answer, so nobody can probe for accounts
  const url = `${SITES[project]}/?mode=resetPassword&oobCode=${encodeURIComponent(code)}`;
  const sent = await sendMail(env, {
    to: email, subject: "Reset your Job Search PH password",
    html: layout({ site: SITES[project], title: "Reset your password", preheader: "Choose a new password for your account.", body: `
      <p style="margin:0 0 12px 0;font-size:16px;line-height:26px;color:#2b2f3a;">We got a request to reset the password for <strong>${esc(email)}</strong>. Tap the button to choose a new one.</p>
      ${button(url, "Choose a new password")}
      <p style="margin:14px 0 0 0;font-size:13px;line-height:20px;color:#6b7186;">The button works for 1 hour. If you didn't ask for this, ignore this email. Your password stays the same.</p>`,
      footerNote: "Job Search PH will never ask for your password by email, text or chat." }),
    text: `Reset your Job Search PH password: ${url}\n\nIf you didn't ask for this, ignore this email.`,
  });
  return reply(sent.ok ? 200 : 502, sent.ok ? { ok: true, ...(sent.dry ? { dryUrl: url } : {}) } : { error: "send_failed", message: "We couldn't send the email right now. Try again in a few minutes." });
}

async function sendMail(env, { to, subject, html, text }) {
  if (env.DRY === "1" && env.EMULATOR_HOST) return { ok: true, dry: true };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { authorization: `Bearer ${env.RESEND_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM || "Job Search PH <noreply@jobsearchph.com>", to: [to], subject, html, text, reply_to: "support@jobsearchph.com" }),
  });
  if (!r.ok) console.error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return { ok: r.ok };
}

// Same look as the other emails (keep in sync with scripts/lib/email.mjs).
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const button = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 8px 0;"><tr>
    <td style="background:#3d4fd6;border-radius:8px;"><a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${esc(label)}</a></td>
  </tr></table>`;
function layout({ site, title, preheader = "", body, footerNote = "", safety = false }) {
  const F = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const img = (n) => `${site}/assets/img/email/${n}.png`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#ffffff;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px 32px 20px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;font-family:${F};color:#2b2f3a;">
    <tr><td align="center" style="padding:0 0 36px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;"><img src="https://jobsearchph.com/assets/img/icon-circle-64.png" width="34" height="34" alt="" style="display:block;border:0;border-radius:17px;"></td>
        <td style="vertical-align:middle;padding-left:10px;font-family:${F};font-size:21px;font-weight:700;letter-spacing:-0.3px;color:#1b2150;">Job Search PH</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:0 4px;font-size:16px;line-height:26px;color:#2b2f3a;">
      <h1 style="margin:0 0 18px 0;font-family:${F};font-size:24px;line-height:32px;font-weight:700;color:#1b2150;">${esc(title)}</h1>
      ${body}
      ${safety ? SAFE : ""}
    </td></tr>
    <tr><td style="padding:44px 4px 0 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e7e8ef;"><tr>
        <td style="padding-top:22px;font-family:${F};font-size:13px;line-height:20px;color:#6b7186;vertical-align:top;">
          <strong style="color:#1b2150;">Job Search PH</strong><br>Verified workers. Trusted employers. One platform.<br>Bacolod City, Negros Occidental, Philippines
        </td>
        <td align="right" style="padding-top:22px;vertical-align:top;white-space:nowrap;">
          <a href="https://www.facebook.com/thejobsearchph" style="text-decoration:none;"><img src="${img("facebook")}" width="22" height="22" alt="Facebook" style="display:inline-block;border:0;"></a>
          <span style="display:inline-block;width:14px;"></span>
          <a href="${site}" style="text-decoration:none;"><img src="${img("website")}" width="22" height="22" alt="jobsearchph.com" style="display:inline-block;border:0;"></a>
        </td>
      </tr></table>
      ${footerNote ? `<p style="margin:18px 0 0 0;font-family:${F};font-size:12px;line-height:18px;color:#8a8fa3;">${footerNote}</p>` : ""}
      <p style="margin:12px 0 0 0;font-family:${F};font-size:12px;line-height:18px;color:#8a8fa3;"><a href="${site}/#/safety" style="color:#6b7186;text-decoration:underline;">Help &amp; safety</a> &nbsp;·&nbsp; <a href="${site}/#/privacy" style="color:#6b7186;text-decoration:underline;">Privacy</a> &nbsp;·&nbsp; <a href="${site}" style="color:#6b7186;text-decoration:underline;">jobsearchph.com</a></p>
      <p style="margin:10px 0 0 0;font-family:${F};font-size:11px;line-height:17px;color:#a3a7b6;">Job Search PH is a job listing board. We do not recruit, screen or place workers, and we never charge jobseekers.</p>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}
const SAFE = "";

/* ---------- Helpers ---------- */
export function normPhone(v) {
  const d = String(v || "").replace(/\D/g, "");
  const m = d.match(/^(?:0|63)?(9\d{9})$/);
  return m ? `+63${m[1]}` : null;
}
const mask = (p) => `0${p.slice(3, 6)} ••• ${p.slice(-4)}`;
const phDay = (t) => new Date(t + 8 * 3600000).toISOString().slice(0, 10);
async function sha(s) { return b64u(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }
function b64u(buf) { let s = ""; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
const ub64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
const jdec = (s) => JSON.parse(new TextDecoder().decode(ub64(s)));

// Firebase sign-in token → { uid, project }. Checks Google's signature, project, issuer and expiry.
let KEYS = null, KEYS_AT = 0;
async function checkToken(tok, env) {
  const parts = tok.split(".");
  if (parts.length !== 3) return null;
  const [h, p] = [jdec(parts[0]), jdec(parts[1])];
  const now = Date.now() / 1000;
  if (!PROJECTS[p.aud] || p.iss !== `https://securetoken.google.com/${p.aud}` || !p.sub || p.exp < now || p.iat > now + 300) return null;
  const who = { uid: p.sub, project: p.aud, email: p.email || "", emailVerified: !!p.email_verified, provider: p.firebase?.sign_in_provider || "", name: p.name || "" };
  if (env.EMULATOR_HOST) return h.alg === "none" || h.alg === "RS256" ? who : null; // emulator tokens are unsigned
  if (p.aud === "demo-jsph" || h.alg !== "RS256") return null;
  if (!KEYS || Date.now() - KEYS_AT > 3600000) {
    KEYS = (await (await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")).json()).keys; KEYS_AT = Date.now();
  }
  const jwk = KEYS.find((k) => k.kid === h.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, ub64(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  return ok ? who : null;
}

// Google access token for the project's service account (Firestore + Firebase Auth admin).
const TOKENS = {};
async function googleAuth(project, env) {
  if (env.EMULATOR_HOST) return "Bearer owner";
  {
    const sa = JSON.parse(env[PROJECTS[project]] || "null");
    if (!sa?.private_key || sa.project_id !== project) throw new Error(`Missing or wrong ${PROJECTS[project]} secret`);
    if (!TOKENS[project] || TOKENS[project].exp < Date.now() + 60000) {
      const iat = Math.floor(Date.now() / 1000);
      const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
      const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 })}`;
      const der = ub64(sa.private_key.replace(/-----[^-]+-----|\s/g, "").replace(/\+/g, "-").replace(/\//g, "_"));
      const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
      const sig = b64u(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
      const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }) });
      if (!r.ok) throw new Error(`Google sign-in failed ${r.status}`);
      TOKENS[project] = { token: (await r.json()).access_token, exp: Date.now() + 3500000 };
    }
    return `Bearer ${TOKENS[project].token}`;
  }
}

// Tiny Firestore REST client signed in as the project's service account (bypasses security rules).
async function firestore(project, env) {
  const auth = await googleAuth(project, env);
  const base = env.EMULATOR_HOST ? `http://${env.EMULATOR_HOST}/v1/projects/${project}/databases/(default)/documents` : `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  const call = async (method, path, body) => {
    const r = await fetch(`${base}/${path}`, { method, headers: { authorization: auth, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`Firestore ${method} ${path} ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r.json();
  };
  return {
    async get(path) { const d = await call("GET", path); return d ? Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, fromV(v)])) : null; },
    async set(path, data) { await call("PATCH", path, { fields: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined).map(([k, v]) => [k, toV(v)])) }); },
  };
}
function fromV(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return Date.parse(v.timestampValue);
  return null;
}
const toV = (v) => v instanceof Date ? { timestampValue: v.toISOString() } : typeof v === "number" ? { integerValue: String(Math.round(v)) } : typeof v === "boolean" ? { booleanValue: v } : v === null ? { nullValue: null } : { stringValue: String(v) };
