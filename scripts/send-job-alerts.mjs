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

import { readFile, writeFile } from "node:fs/promises";
import { connect, hasFirebaseKey, query, patch, remove } from "./lib/firestore.mjs";
import { layout, sendEmail, button, esc, salaryText, SITE } from "./lib/email.mjs";

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const FIXTURE = opt("--fixture");
const DRY = flag("--dry-run") || !!FIXTURE;
const ONLY = (opt("--only") || "").toLowerCase();

const FROM = process.env.ALERTS_FROM || "Job Search PH <alerts@jobsearchph.com>";
const MAX_EMAILS = Number(process.env.MAX_EMAILS || 90);
const MAX_JOBS_IN_EMAIL = 8;
const LOOKBACK_MS = 3 * 86400000;
const now = Date.now();

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
  const manage = `${SITE}/?src=job-alert#/profile/emails`;
  const browse = `${SITE}/?src=job-alert#/`;

  const rows = shown.map((j) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #e6e8f2;"><tr><td style="padding:14px 0;">
      <a href="${esc(jobUrl(j))}" style="font-size:16px;font-weight:bold;color:#3d4fd6;text-decoration:none;">${esc(j.title)}</a>
      <div style="font-size:14px;color:#444444;margin-top:4px;">${esc(employer(j))} · ${esc(place(j))}</div>
      <div style="font-size:14px;color:#444444;margin-top:2px;"><strong style="color:#15803d;">${esc(salaryText(j))}</strong>${j.schedule || j.employmentType ? ` · ${esc(j.schedule || j.employmentType)}` : ""}${j.arrangement ? ` · ${esc(j.arrangement)}` : ""}</div>
      <div style="font-size:12px;color:#777777;margin-top:2px;">${esc(kind(j))}</div>
      <a href="${esc(jobUrl(j))}" style="display:inline-block;margin-top:8px;padding:8px 14px;background:#3d4fd6;color:#ffffff;border-radius:6px;font-size:13px;font-weight:bold;text-decoration:none;">View and apply</a>
    </td></tr></table>`).join("");

  const body = `
    <p style="margin:0 0 6px 0;font-size:15px;line-height:22px;color:#444444;">Hi ${esc(first)}, ${matches.length === 1 ? "a new job matches" : `${matches.length} new jobs match`} what you're looking for:</p>
    ${rows}
    ${more > 0 ? button(browse, `See ${more} more jobs`) : ""}`;
  const footerNote = `You're getting this because you turned on job alerts on your Job Search PH profile.<br>
    <a href="${esc(manage)}" style="color:#777777;">Change your alerts</a> · <a href="${esc(unsub)}" style="color:#777777;">Unsubscribe</a>`;
  const html = layout({ title: matches.length === 1 ? "A new job for you" : `${matches.length} new jobs for you`, preheader: subject, body, footerNote });

  const text = [
    `Hi ${first}, ${matches.length === 1 ? "a new job matches" : `${matches.length} new jobs match`} what you're looking for:`, "",
    ...shown.flatMap((j) => [`${j.title}`, `${employer(j)} · ${place(j)}`, `${salaryText(j)}`, jobUrl(j), ""]),
    ...(more > 0 ? [`See ${more} more: ${browse}`, ""] : []),
    "Stay safe: real employers never ask you to pay to apply, train or get hired.", "",
    `Change your alerts: ${manage}`, `Unsubscribe: ${unsub}`,
  ].join("\n");

  return { subject, html, text, unsub };
}

/* ---------- Run ---------- */

async function main() {
  let users, jobs, state, bans, unsubs;
  if (FIXTURE) {
    const fx = JSON.parse(await readFile(FIXTURE, "utf8"));
    const rel = (ms) => (typeof ms === "string" && /^-?\d+h$/.test(ms) ? now + parseInt(ms) * 3600000 : ms); // "-5h" = 5 hours ago
    jobs = fx.jobs.map((j) => ({ ...j, approvedAt: rel(j.approvedAt), expiresAt: rel(j.expiresAt) }));
    users = fx.users; state = (fx.alertState || []).map((s) => ({ ...s, lastSentAt: rel(s.lastSentAt) })); bans = fx.bans || []; unsubs = fx.unsubscribes || [];
  } else {
    // Not set up yet (no secrets at all): skip quietly instead of failing every day.
    if (!hasFirebaseKey()) {
      console.log("Job alerts aren't set up yet: add the FIREBASE_SERVICE_ACCOUNT secret (and RESEND_API_KEY). Skipping.");
      return;
    }
    if (!DRY && !process.env.RESEND_API_KEY && !process.env.EMAIL_OUTBOX) throw new Error("RESEND_API_KEY secret is missing.");
    await connect();
    unsubs = await query("unsubscribes");
    // 1. Apply unsubscribe clicks first.
    for (const u of unsubs) {
      const owners = await query("users", [["alertsToken", "EQUAL", u.id]]);
      for (const o of owners) { if (!DRY) await patch(`users/${o.id}`, { alerts: false }); console.log(`Unsubscribed ${o.id}`); }
      if (!DRY) await remove(`unsubscribes/${u.id}`);
    }
    [users, jobs, state, bans] = await Promise.all([
      query("users", [["alerts", "EQUAL", true]]),
      query("jobs", [["status", "EQUAL", "approved"]]),
      query("alertState"),
      query("bans"),
    ]);
  }
  const unsubbed = new Set(unsubs.map((u) => u.id));
  const banned = new Set(bans.map((b) => b.id));
  const lastSent = Object.fromEntries(state.map((s) => [s.id, s.lastSentAt]));

  const eligible = users.filter((u) => u.alerts === true && u.role === "jobseeker" && /.+@.+\..+/.test(u.email || "")
    && (u.jobCategories || []).length && /^[A-Za-z0-9]{32}$/.test(u.alertsToken || "")
    && (u.signIn !== "password" || u.emailVerified === true) // email + password accounts: only once confirmed
    && !banned.has(u.id) && !unsubbed.has(u.alertsToken) && (!ONLY || low(u.email) === ONLY));
  console.log(`${users.length} opted in, ${eligible.length} eligible, ${jobs.filter(isLive).length} live jobs.`);

  let sent = 0, skipped = 0, failed = 0;
  const day = new Date(now + 8 * 3600000).toISOString().slice(0, 10);
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
      // The key stops a re-run on the same day from emailing someone twice.
      await sendEmail({ to: u.email, subject: mail.subject, html: mail.html, text: mail.text, from: FROM, key: `job-alert-${u.id}-${day}`, unsubscribe: mail.unsub });
      await patch(`alertState/${u.id}`, { lastSentAt: new Date(now), lastCount: m.length });
      sent++;
      console.log(`Sent ${m.length} job(s) to ${u.id}`);
    } catch (e) {
      failed++;
      console.error(`Could not email ${u.id}: ${e.message}`);
      if (e.status === 429 || e.status === 403) { console.error("Stopping: Resend limit or key problem."); break; }
    }
  }
  console.log(`\nDone. ${DRY ? "Would send" : "Sent"} ${sent}, nothing new for ${skipped}, failed ${failed}.`);
  if (failed && !sent) process.exit(1);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
