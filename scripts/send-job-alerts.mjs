// Daily job alert emails. Run by .github/workflows/job-alerts.yml once a day.
//
// Who gets one: jobseekers who ticked "Job alerts by email" on their profile.
// What's in it: jobs approved since their last alert (at most the last 3 days) whose category
// is one of the jobs they picked, in their city (or anywhere, if they chose that).
// Nothing new for someone = no email that day.
//
// Needs two secrets (GitHub → Settings → Secrets and variables → Actions):
//   FIREBASE_SERVICE_ACCOUNT  the JSON key from Firebase → Project settings → Service accounts
//   RESEND_API_KEY            from resend.com → API Keys
// Optional: SITE_URL (default https://jobsearchph.com), ALERTS_FROM, MAX_EMAILS (default 90; Resend free = 100/day).
//
// Try it safely:
//   node scripts/send-job-alerts.mjs --fixture scripts/sample-alerts.json            (no network, prints emails)
//   node scripts/send-job-alerts.mjs --dry-run                                        (reads real data, sends nothing)
//   node scripts/send-job-alerts.mjs --only you@gmail.com                             (sends only to that one opted-in person)
//
// No dependencies. Firestore is reached over REST with a token signed from the service account.

import { readFile, writeFile } from "node:fs/promises";
import { createSign } from "node:crypto";

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const FIXTURE = opt("--fixture");
const DRY = flag("--dry-run") || !!FIXTURE;
const ONLY = (opt("--only") || "").toLowerCase();

const SITE = (process.env.SITE_URL || "https://jobsearchph.com").replace(/\/+$/, "");
const FROM = process.env.ALERTS_FROM || "Job Search PH <alerts@jobsearchph.com>";
const REPLY_TO = "support@jobsearchph.com";
const MAX_EMAILS = Number(process.env.MAX_EMAILS || 90);
const MAX_JOBS_IN_EMAIL = 8;
const LOOKBACK_MS = 3 * 86400000;
const now = Date.now();

/* ---------- Firestore over REST ---------- */

let SA, TOKEN, BASE;

async function auth() {
  SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "null");
  if (!SA?.private_key || !SA?.client_email || !SA?.project_id) throw new Error("FIREBASE_SERVICE_ACCOUNT secret is missing or not a service account JSON key.");
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const iat = Math.floor(now / 1000);
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: SA.client_email, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 })}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(SA.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  if (!res.ok) throw new Error(`Google sign-in failed: ${res.status} ${await res.text()}`);
  TOKEN = (await res.json()).access_token;
  BASE = `https://firestore.googleapis.com/v1/projects/${SA.project_id}/databases/(default)/documents`;
  console.log(`Firebase project: ${SA.project_id}`);
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`Firestore ${method} ${path.split("?")[0]} failed: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

function fromValue(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return Date.parse(v.timestampValue);
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromValue);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromValue(x)]));
  return null;
}
const docOut = (d) => ({ id: d.name.split("/").pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, fromValue(v)])) });

// where: [field, op, value] with a string/boolean value, or null for the whole collection.
async function query(collectionId, where) {
  const sq = { from: [{ collectionId }], limit: 5000 };
  if (where) {
    const [field, op, val] = where;
    sq.where = { fieldFilter: { field: { fieldPath: field }, op, value: typeof val === "boolean" ? { booleanValue: val } : { stringValue: val } } };
  }
  const rows = await api("POST", ":runQuery", { structuredQuery: sq });
  return rows.filter((r) => r.document).map((r) => docOut(r.document));
}

const toValue = (v) => typeof v === "boolean" ? { booleanValue: v } : typeof v === "number" ? { integerValue: String(v) } : v instanceof Date ? { timestampValue: v.toISOString() } : { stringValue: String(v) };
async function patch(path, data) {
  const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  await api("PATCH", `/${path}?${mask}`, { fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)])) });
}
const remove = (path) => api("DELETE", `/${path}`);

/* ---------- Matching ---------- */

const isLive = (j) => j.status === "approved" && (!j.expiresAt || j.expiresAt > now);
const low = (s) => String(s || "").trim().toLowerCase();

export function matchesFor(user, jobs, lastSentAt) {
  const since = Math.max(lastSentAt || 0, now - LOOKBACK_MS);
  const cats = new Set(user.jobCategories || []);
  return jobs
    .filter((j) => isLive(j) && (j.approvedAt || 0) > since && j.ownerUid !== user.id)
    .filter((j) => cats.has(j.category) && (j.category !== "Other" || (user.jobCategoryOther && low(j.categoryOther) === low(user.jobCategoryOther))))
    .filter((j) => user.alertsScope === "all" || low(j.city) === low(user.city))
    .sort((a, b) => (b.approvedAt || 0) - (a.approvedAt || 0));
}

/* ---------- Email ---------- */

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const peso = (n) => "₱" + Number(n).toLocaleString("en-PH");
const PER = { month: "/ month", day: "/ day", hour: "/ hour" };
function salaryText(j) {
  if (!j.salaryMin && !j.salaryMax) return "Salary negotiable";
  const per = PER[j.salaryPeriod] || "";
  if (j.salaryMin && j.salaryMax && j.salaryMax !== j.salaryMin) return `${peso(j.salaryMin)}–${peso(j.salaryMax)} ${per}`;
  return `${peso(j.salaryMin || j.salaryMax)} ${per}`;
}
const jobUrl = (j) => `${SITE}/?src=job-alert#/job/${encodeURIComponent(j.id)}`;
const place = (j) => [j.area, j.city].filter(Boolean).join(", ");
const kind = (j) => j.category === "Other" && j.categoryOther ? j.categoryOther : j.category;
const employer = (j) => j.workplace === "household" ? "Private household" : j.employerName;

export function buildEmail(user, matches) {
  const first = String(user.fullName || "").trim().split(/\s+/)[0] || "there";
  const shown = matches.slice(0, MAX_JOBS_IN_EMAIL);
  const more = matches.length - shown.length;
  const where = user.alertsScope === "all" ? "Negros Occidental" : user.city;
  const subject = matches.length === 1
    ? `New job: ${matches[0].title} in ${matches[0].city}`
    : `${matches.length} new jobs for you in ${where}`;
  const unsub = `${SITE}/#/unsubscribe/${user.alertsToken}`;
  const manage = `${SITE}/?src=job-alert#/profile`;
  const browse = `${SITE}/?src=job-alert#/`;

  const rows = shown.map((j) => `
      <tr><td style="padding:14px 0;border-bottom:1px solid #e5e7eb">
        <a href="${esc(jobUrl(j))}" style="font-size:16px;font-weight:700;color:#3730a3;text-decoration:none">${esc(j.title)}</a>
        <div style="font-size:14px;color:#374151;margin-top:4px">${esc(employer(j))} · ${esc(place(j))}</div>
        <div style="font-size:14px;color:#374151;margin-top:2px">${esc(salaryText(j))}${j.schedule || j.employmentType ? ` · ${esc(j.schedule || j.employmentType)}` : ""}${j.arrangement ? ` · ${esc(j.arrangement)}` : ""}</div>
        <div style="font-size:13px;color:#6b7280;margin-top:2px">${esc(kind(j))}</div>
        <a href="${esc(jobUrl(j))}" style="display:inline-block;margin-top:8px;padding:8px 14px;background:#4f46e5;color:#ffffff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none">View and apply</a>
      </td></tr>`).join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:24px">
      <tr><td style="font-size:18px;font-weight:700;color:#111827">Job Search PH</td></tr>
      <tr><td style="padding-top:12px;font-size:15px;color:#111827">Hi ${esc(first)}, ${matches.length === 1 ? "a new job matches" : `${matches.length} new jobs match`} what you're looking for:</td></tr>
      ${rows}
      ${more > 0 ? `<tr><td style="padding-top:14px;font-size:14px"><a href="${esc(browse)}" style="color:#3730a3">See ${more} more on Job Search PH</a></td></tr>` : ""}
      <tr><td style="padding-top:18px;font-size:13px;color:#92400e;background:#fffbeb;border-radius:8px;padding:12px">Stay safe: real employers never ask you to pay to apply, train or get hired.</td></tr>
      <tr><td style="padding-top:18px;font-size:12px;color:#6b7280;line-height:1.5">
        You're getting this because you turned on job alerts on your Job Search PH profile.<br>
        <a href="${esc(manage)}" style="color:#6b7280">Change your alerts</a> · <a href="${esc(unsub)}" style="color:#6b7280">Unsubscribe</a><br>
        Job Search PH · Negros Occidental, Philippines
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  const text = [
    `Hi ${first}, ${matches.length === 1 ? "a new job matches" : `${matches.length} new jobs match`} what you're looking for:`, "",
    ...shown.flatMap((j) => [`${j.title}`, `${employer(j)} · ${place(j)}`, `${salaryText(j)}`, jobUrl(j), ""]),
    ...(more > 0 ? [`See ${more} more: ${browse}`, ""] : []),
    "Stay safe: real employers never ask you to pay to apply, train or get hired.", "",
    `Change your alerts: ${manage}`, `Unsubscribe: ${unsub}`,
  ].join("\n");

  return { subject, html, text, unsub };
}

async function send(user, mail) {
  const day = new Date(now + 8 * 3600000).toISOString().slice(0, 10);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json",
      "Idempotency-Key": `job-alert-${user.id}-${day}`, // a re-run the same day can't email someone twice
    },
    body: JSON.stringify({
      from: FROM, to: [user.email], reply_to: REPLY_TO, subject: mail.subject, html: mail.html, text: mail.text,
      headers: { "List-Unsubscribe": `<${mail.unsub}>, <mailto:${REPLY_TO}?subject=Unsubscribe%20job%20alerts>` },
      tags: [{ name: "type", value: "job_alert" }],
    }),
  });
  if (!res.ok) throw Object.assign(new Error(`Resend ${res.status}: ${await res.text()}`), { status: res.status });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Run ---------- */

async function main() {
  let users, jobs, state, bans, unsubs;
  if (FIXTURE) {
    const fx = JSON.parse(await readFile(FIXTURE, "utf8"));
    const rel = (ms) => (typeof ms === "string" && /^-?\d+h$/.test(ms) ? now + parseInt(ms) * 3600000 : ms); // "-5h" = 5 hours ago
    jobs = fx.jobs.map((j) => ({ ...j, approvedAt: rel(j.approvedAt), expiresAt: rel(j.expiresAt) }));
    users = fx.users; state = (fx.alertState || []).map((s) => ({ ...s, lastSentAt: rel(s.lastSentAt) })); bans = fx.bans || []; unsubs = fx.unsubscribes || [];
  } else {
    if (!DRY && !process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY secret is missing.");
    await auth();
    unsubs = await query("unsubscribes");
    // 1. Apply unsubscribe clicks first.
    for (const u of unsubs) {
      const owners = await query("users", ["alertsToken", "EQUAL", u.id]);
      for (const o of owners) { if (!DRY) await patch(`users/${o.id}`, { alerts: false }); console.log(`Unsubscribed ${o.id}`); }
      if (!DRY) await remove(`unsubscribes/${u.id}`);
    }
    [users, jobs, state, bans] = await Promise.all([
      query("users", ["alerts", "EQUAL", true]),
      query("jobs", ["status", "EQUAL", "approved"]),
      query("alertState"),
      query("bans"),
    ]);
  }
  const unsubbed = new Set(unsubs.map((u) => u.id));
  const banned = new Set(bans.map((b) => b.id));
  const lastSent = Object.fromEntries(state.map((s) => [s.id, s.lastSentAt]));

  const eligible = users.filter((u) => u.alerts === true && u.role === "jobseeker" && /.+@.+\..+/.test(u.email || "")
    && (u.jobCategories || []).length && /^[A-Za-z0-9]{32}$/.test(u.alertsToken || "")
    && !banned.has(u.id) && !unsubbed.has(u.alertsToken) && (!ONLY || low(u.email) === ONLY));
  console.log(`${users.length} opted in, ${eligible.length} eligible, ${jobs.filter(isLive).length} live jobs.`);

  let sent = 0, skipped = 0, failed = 0;
  for (const u of eligible) {
    const m = matchesFor(u, jobs, lastSent[u.id]);
    if (!m.length) { skipped++; continue; }
    if (sent >= MAX_EMAILS) { console.log(`Reached MAX_EMAILS (${MAX_EMAILS}); the rest get theirs on the next run.`); break; }
    const mail = buildEmail(u, m);
    if (DRY) {
      console.log(`\n--- would email ${u.email} (${m.length} job${m.length === 1 ? "" : "s"}) ---\nSubject: ${mail.subject}\n${mail.text}`);
      if (FIXTURE && sent === 0) await writeFile("job-alert-preview.html", mail.html);
      sent++; continue;
    }
    try {
      await send(u, mail);
      await patch(`alertState/${u.id}`, { lastSentAt: new Date(now), lastCount: m.length });
      sent++;
      console.log(`Sent ${m.length} job(s) to ${u.id}`);
    } catch (e) {
      failed++;
      console.error(`Could not email ${u.id}: ${e.message}`);
      if (e.status === 429 || e.status === 403) { console.error("Stopping: Resend limit or key problem."); break; }
    }
    await sleep(600); // Resend allows 2 requests a second
  }
  console.log(`\nDone. ${DRY ? "Would send" : "Sent"} ${sent}, nothing new for ${skipped}, failed ${failed}.`);
  if (failed && !sent) process.exit(1);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
