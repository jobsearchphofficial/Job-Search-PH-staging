// Job Search PH · SMS helper (Cloudflare Worker, free plan).
// Sends a 6-digit code by text (UniSMS) to the mobile number on the user's profile, then checks it.
// One helper serves both sites: the Firebase project in the user's sign-in token picks the database.
//
// Endpoints (both need "Authorization: Bearer <Firebase ID token>"):
//   POST /send    → texts a code to the number on users/{uid}.phone
//   POST /verify  {code} → if right, writes phoneVerified/{uid} = { phone, at }
//
// Settings (Cloudflare → Workers → this worker → Settings → Variables and secrets):
//   UNISMS_KEY     secret  UniSMS API secret key
//   SA_LIVE        secret  service-account JSON of job-search-ph-website
//   SA_STAGING     secret  service-account JSON of job-search-ph-staging
//   SENDER_ID      text    the sender name shown in UniSMS (e.g. "UniSMS" until your own is approved)
//   DAILY_CAP      text    optional, most texts per day for the whole site (default 150)
// For local tests only: EMULATOR_HOST (Firestore emulator) and DRY=1 (no real text; code returned).

const ORIGINS = ["https://jobsearchph.com", "https://www.jobsearchph.com", "https://staging.jobsearchph.com", "https://jobsearchphofficial.github.io", "http://localhost:8000"];
const PROJECTS = { "job-search-ph-website": "SA_LIVE", "job-search-ph-staging": "SA_STAGING", "demo-jsph": "SA_EMULATOR" };
const CODE_MINUTES = 10, COOLDOWN_S = 60, PER_USER_DAY = 3, PER_PHONE_DAY = 3, MAX_TRIES = 5;

export default {
  async fetch(req, env) {
    const origin = req.headers.get("origin") || "";
    const cors = { "access-control-allow-origin": ORIGINS.includes(origin) ? origin : ORIGINS[0], "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "POST, OPTIONS", "access-control-max-age": "86400", vary: "origin" };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const path = new URL(req.url).pathname;
    if (req.method === "GET" && path === "/") return reply(200, { ok: true, service: "Job Search PH SMS helper" });
    if (req.method !== "POST" || !["/send", "/verify"].includes(path)) return reply(404, { error: "not_found" });
    try {
      const who = await checkToken((req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""), env);
      if (!who) return reply(401, { error: "signin" });
      const db = await firestore(who.project, env);
      if (await db.get(`bans/${who.uid}`)) return reply(403, { error: "banned" });
      const body = await req.json().catch(() => ({}));
      return path === "/send" ? await send(who, db, env, reply) : await verify(who, db, body, reply);
    } catch (e) {
      console.error(e.stack || e.message);
      return reply(500, { error: "server" });
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
  if (env.EMULATOR_HOST) return h.alg === "none" || h.alg === "RS256" ? { uid: p.sub, project: p.aud } : null; // emulator tokens are unsigned
  if (p.aud === "demo-jsph" || h.alg !== "RS256") return null;
  if (!KEYS || Date.now() - KEYS_AT > 3600000) {
    KEYS = (await (await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")).json()).keys; KEYS_AT = Date.now();
  }
  const jwk = KEYS.find((k) => k.kid === h.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, ub64(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  return ok ? { uid: p.sub, project: p.aud } : null;
}

// Tiny Firestore REST client signed in as the project's service account (bypasses security rules).
const TOKENS = {};
async function firestore(project, env) {
  let base, auth;
  if (env.EMULATOR_HOST) { base = `http://${env.EMULATOR_HOST}/v1/projects/${project}/databases/(default)/documents`; auth = "Bearer owner"; }
  else {
    const sa = JSON.parse(env[PROJECTS[project]] || "null");
    if (!sa?.private_key || sa.project_id !== project) throw new Error(`Missing or wrong ${PROJECTS[project]} secret`);
    if (!TOKENS[project] || TOKENS[project].exp < Date.now() + 60000) {
      const iat = Math.floor(Date.now() / 1000);
      const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
      const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 })}`;
      const der = ub64(sa.private_key.replace(/-----[^-]+-----|\s/g, "").replace(/\+/g, "-").replace(/\//g, "_"));
      const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
      const sig = b64u(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
      const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }) });
      if (!r.ok) throw new Error(`Google sign-in failed ${r.status}`);
      TOKENS[project] = { token: (await r.json()).access_token, exp: Date.now() + 3500000 };
    }
    base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`; auth = `Bearer ${TOKENS[project].token}`;
  }
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
