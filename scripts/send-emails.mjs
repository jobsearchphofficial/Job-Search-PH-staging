// Automatic emails, run every ~15 minutes by .github/workflows/emails.yml:
//   1. Employer: one email per new applicant, with the applicant's fit score, and (if there are others)
//      how many applied and who fits best so far.
//   2. Employer: "we got your post", "your post is live", "your changes are live", "your post wasn't approved".
//   3. Admin: one summary email when there's something to do (posts to review, support messages, reports).
//
// Nothing is sent twice: every email has a key saved in mailLog/{key}, and meta/mailer.lastRun remembers
// where the last run stopped. Employers can turn these emails off in My profile (users.emailNotify = false).
//
// Secrets: FIREBASE_SERVICE_ACCOUNT, RESEND_API_KEY. Optional: SITE_URL, ADMIN_EMAIL, MAX_EMAILS (per run).
// Test locally: FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 EMAIL_OUTBOX=/tmp/outbox node scripts/send-emails.mjs

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { connect, hasFirebaseKey, query, get, patch, remove } from "./lib/firestore.mjs";
import { layout, sendEmail, button, card, esc, link, salaryText } from "./lib/email.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FROM = process.env.EMAIL_FROM || "Job Search PH <alerts@jobsearchph.com>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "jobsearchph.official@gmail.com";
const MAX_EMAILS = Number(process.env.MAX_EMAILS || 40);
const DECLINED = ["not_selected", "offer_declined"];
const now = Date.now();

// The same fit score the website shows (assets/match.js), loaded as a module.
const matchSrc = await readFile(join(ROOT, "assets/match.js"), "utf8");
const { rankApplicants } = await import(`data:text/javascript;base64,${Buffer.from(matchSrc).toString("base64")}`);
// The same scam checker the chat page uses (assets/safety.js).
const safetySrc = await readFile(join(ROOT, "assets/safety.js"), "utf8");
const { scamFlags, SERIOUS } = await import(`data:text/javascript;base64,${Buffer.from(safetySrc).toString("base64")}`);

const first = (n) => String(n || "").trim().split(/\s+/)[0] || "there";
const settingsNote = `You're getting this because you posted a job on Job Search PH. <a href="${link("#/profile/emails")}" style="color:#777777;">Turn off these emails</a> in My profile.`;
const fitColor = (s) => (s >= 80 ? "#15803d" : s >= 60 ? "#3d4fd6" : s >= 40 ? "#b45309" : "#6b7280");

let sent = 0, capped = false;
const cache = new Map();
const cached = (k, fn) => { if (!cache.has(k)) cache.set(k, fn()); return cache.get(k); };
const getUser = (id) => cached(`u:${id}`, () => get(`users/${id}`));
const getJob = (id) => cached(`j:${id}`, () => get(`jobs/${id}`));
const appsFor = (jobId) => cached(`a:${jobId}`, () => query("applications", [["jobId", "EQUAL", jobId]]));
const seen = async (key) => !!(await get(`mailLog/${key}`));
const mark = (key, to) => patch(`mailLog/${key}`, { at: new Date(), to: to || "" });

async function deliver(key, to, { subject, html, text }) {
  if (sent >= MAX_EMAILS) { capped = true; return false; }
  await sendEmail({ to, subject, html, text, from: FROM, key });
  await mark(key, to);
  sent++;
  console.log(`Sent ${key}`);
  return true;
}

// IDs an admin has checked (employers and jobseekers). Loaded once per run.
let VERIFIED_IDS = null;
const verifiedIds = async () => (VERIFIED_IDS ||= new Set((await query("verified").catch(() => [])).map((v) => v.id)));

function applicantBlock(a, { highlight = false } = {}) {
  const x = a.applicant || {}, f = a.fit;
  const reasons = [...f.good.slice(0, 3).map((g) => `✓ ${esc(g)}`), ...f.gaps.slice(0, 2).map((g) => `– ${esc(g)}`)].join("<br>");
  return card(`
    <div style="font-size:16px;font-weight:bold;color:#111111;">${esc(x.fullName || "Applicant")}${x.age ? `, ${esc(x.age)}` : ""}${VERIFIED_IDS?.has(a.applicantUid) ? ` <span style="display:inline-block;padding:2px 8px;border-radius:10px;background:#dcfce7;color:#15803d;font-size:12px;font-weight:bold;vertical-align:middle;">✓ Verified</span>` : ""}</div>
    <div style="font-size:13px;color:#666666;margin-bottom:6px;">${esc(x.city || "")}${x.experienceYears != null && x.experienceYears !== "" ? ` · ${esc(x.experienceYears)} yrs experience` : ""}${x.availability ? ` · ${esc(x.availability)}` : ""}</div>
    <div style="font-size:14px;margin-bottom:6px;"><strong style="color:${fitColor(f.score)};font-size:18px;">${f.score}/100</strong> <span style="color:#333;">${esc(f.label)}</span></div>
    <div style="font-size:13px;line-height:20px;color:#555555;">${reasons}</div>`,
    highlight ? "#15803d" : "#3d4fd6", highlight ? "#f0fdf4" : "#f6f7fe");
}

/* ---------- 1. New applicants ---------- */
async function newApplicants(since) {
  const fresh = (await query("applications", [["createdAt", "GREATER_THAN", new Date(since)]])).sort((a, b) => a.createdAt - b.createdAt);
  for (const app of fresh) {
    const key = `app_${app.id}`;
    if (await seen(key)) continue;
    const [job, emp] = await Promise.all([getJob(app.jobId), getUser(app.employerUid), verifiedIds()]);
    if (!job || !emp?.email || emp.emailNotify === false || app.applicantDeleted) { await mark(key, "skipped"); continue; }
    const ranked = rankApplicants(job, await appsFor(app.jobId)).filter((a) => a.createdAt <= app.createdAt || a.id === app.id);
    const me = ranked.find((a) => a.id === app.id) || { ...app, fit: rankApplicants(job, [app])[0].fit };
    const active = ranked.filter((a) => !DECLINED.includes(a.status));
    const best = active[0];
    const total = ranked.length;
    const name = first(app.applicant?.fullName);
    const others = total - 1;
    const body = `
      <p style="margin:0 0 14px 0;font-size:15px;line-height:22px;color:#444444;">Hi ${esc(first(emp.fullName))}, <strong>${esc(app.applicant?.fullName || "someone")}</strong> applied to your post <strong>${esc(job.title)}</strong>.</p>
      ${applicantBlock(me, { highlight: best && best.id === me.id && total > 1 })}
      ${total > 1 ? (best && best.id !== me.id
        ? `<p style="margin:14px 0 8px 0;font-size:14px;color:#444444;">You now have <strong>${total} applicants</strong>. Your best fit so far:</p>${applicantBlock(best, { highlight: true })}`
        : `<p style="margin:14px 0 8px 0;font-size:14px;color:#444444;">You now have <strong>${total} applicants</strong>, and ${esc(name)} is your best fit so far.</p>`) : ""}
      ${button(link(`#/applicants/${app.jobId}`, "email-applicant"), total > 1 ? `See all ${total} applicants` : `See ${name}'s profile`)}
      <p style="margin:6px 0 0 0;font-size:12px;color:#888888;">The fit score compares their profile with your post. It's a guide; you decide. Reply to applicants in Messages on Job Search PH.</p>`;
    await deliver(key, emp.email, {
      subject: `New applicant for ${job.title}: ${name} (${me.fit.score}/100 fit)`,
      html: layout({ title: `New applicant: ${app.applicant?.fullName || name}`, preheader: `${me.fit.label} · ${total} applicant${total === 1 ? "" : "s"} so far`, body, footerNote: settingsNote, safety: false }),
      text: `${app.applicant?.fullName || name} applied to ${job.title}. Fit: ${me.fit.score}/100 (${me.fit.label}).${total > 1 ? ` You now have ${total} applicants${best ? `; best fit so far: ${best.applicant?.fullName} (${best.fit.score}/100)` : ""}.` : ""}\nSee applicants: ${link(`#/applicants/${app.jobId}`, "email-applicant")}`,
    });
    if (capped) return;
  }
}

/* ---------- 2. Post updates for employers ---------- */
async function postUpdates(since) {
  const jobs = await query("jobs", [["updatedAt", "GREATER_THAN", new Date(since)]]);
  const pendingForAdmin = [];
  for (const j of jobs) {
    if (j.status === "pending") pendingForAdmin.push(j);
    const emp = await getUser(j.ownerUid);
    const ok = emp?.email && emp.emailNotify !== false;
    const where = [j.area, j.city].filter(Boolean).join(", ");
    const postCard = card(`<div style="font-size:12px;color:#777777;text-transform:uppercase;letter-spacing:.5px;">Your post</div>
      <div style="font-size:16px;font-weight:bold;color:#111111;margin:2px 0 6px 0;">${esc(j.title)}</div>
      <div>${esc(where)} · ${esc(salaryText(j))}</div>`);
    let key = null, subject = "", title = "", body = "";
    if (j.status === "pending" && !j.editedAt && j.createdAt > since) {
      key = `job_${j.id}_received`; subject = `We got your job post: ${j.title}`; title = "We got your job post";
      body = `<p style="margin:0 0 14px 0;font-size:15px;line-height:22px;color:#444444;">Hi ${esc(first(emp?.fullName))}, thanks for posting on Job Search PH. We check every post before it goes live, usually within a day. We'll email you when it's approved.</p>${postCard}
        <p style="margin:12px 0 0 0;font-size:13px;color:#666666;">Want a <strong>Verified</strong> badge? Add your Facebook link or business permit on your profile, so we can confirm you're a real employer.</p>${button(link("#/profile", "email-post"), "Update my profile")}`;
    } else if (j.status === "approved" && j.approvedAt && j.approvedAt > since && !(j.editedAt && j.editedAt > j.approvedAt)) {
      key = `job_${j.id}_live_${j.approvedAt}`; subject = `Your job post is live: ${j.title}`; title = "Your job post is live";
      body = `<p style="margin:0 0 14px 0;font-size:15px;line-height:22px;color:#444444;">Hi ${esc(first(emp?.fullName))}, your post is approved and jobseekers can see it now${j.expiresAt ? ` until ${new Date(j.expiresAt).toLocaleDateString("en-PH", { month: "long", day: "numeric" })}` : ""}. We'll email you when someone applies.</p>${postCard}
        <p style="margin:12px 0 0 0;font-size:13px;color:#666666;">Tip: share it in your Facebook groups to get more applicants.</p>${button(link(`#/job/${j.id}`, "email-post"), "View my post")}`;
    } else if (j.status === "approved" && j.editedAt && (!j.approvedAt || j.editedAt > j.approvedAt) && j.editedAt > now - 30 * 86400000) {
      key = `job_${j.id}_relive_${j.editedAt}`; subject = `Your changes are live: ${j.title}`; title = "Your changes are live";
      body = `<p style="margin:0 0 14px 0;font-size:15px;line-height:22px;color:#444444;">Hi ${esc(first(emp?.fullName))}, we approved the changes to your post and it's visible to jobseekers again.</p>${postCard}${button(link(`#/job/${j.id}`, "email-post"), "View my post")}`;
    } else if (j.status === "rejected") {
      key = `job_${j.id}_rejected_${j.editedAt || j.createdAt}`; subject = `Your job post wasn't approved: ${j.title}`; title = "Your job post wasn't approved";
      body = `<p style="margin:0 0 14px 0;font-size:15px;line-height:22px;color:#444444;">Hi ${esc(first(emp?.fullName))}, we couldn't approve this post yet. Usually it's one of these: pay below the legal minimum, missing details about the work, or a contact that doesn't work.</p>${postCard}
        <p style="margin:12px 0 0 0;font-size:13px;color:#666666;">Fix it and we'll check it again. Questions? Just reply to this email.</p>${button(link(`#/post/edit/${j.id}`, "email-post"), "Edit my post")}`;
    }
    if (!key || await seen(key)) continue;
    if (!ok) { await mark(key, "skipped"); continue; }
    await deliver(key, emp.email, { subject, html: layout({ title, preheader: subject, body, footerNote: settingsNote, safety: false }), text: `${title}: ${j.title}. ${link(`#/my`, "email-post")}` });
    if (capped) return pendingForAdmin;
  }
  return pendingForAdmin;
}

/* ---------- Deleted accounts: remove their closed chats 30 days later ---------- */
async function purgeDeletedChats() {
  const cutoff = Date.now() - 30 * 86400000;
  const apps = [...await query("applications", [["applicantDeleted", "EQUAL", true]]), ...await query("applications", [["employerDeleted", "EQUAL", true]])];
  const seenIds = new Set();
  for (const a of apps) {
    if (seenIds.has(a.id) || !a.deletedAt || a.deletedAt > cutoff) continue;
    seenIds.add(a.id);
    const msgs = await query("messages", [], 2000, `applications/${a.id}`);
    for (const m of msgs) await remove(`applications/${a.id}/messages/${m.id}`);
    await remove(`applications/${a.id}`);
    console.log(`Removed chat ${a.id} (${msgs.length} messages) of a deleted account`);
  }
}

/* ---------- Get Verified: delete ID photos nobody checked within 14 days ---------- */
async function expireVerify() {
  const reqs = await query("verifyRequests", [["status", "EQUAL", "pending"]]).catch(() => []);
  for (const r of reqs) {
    if (!r.createdAt || now - r.createdAt < 14 * 86400000) continue;
    await patch(`verifyRequests/${r.id}`, { status: "expired", reason: "Not checked within 14 days", decidedAt: new Date(now), updatedAt: new Date(now) }, ["idPhoto", "selfie"]);
    console.log(`Expired ID check ${r.id} (photos deleted)`);
  }
}

/* ---------- Get Verified: decisions for the employer; new requests for the admin ---------- */
async function verifyUpdates(since) {
  const reqs = await query("verifyRequests", [["updatedAt", "GREATER_THAN", new Date(since)]]).catch(() => []);
  const pending = [];
  for (const r of reqs) {
    if (r.status === "pending") { pending.push(r); continue; }
    if (!["approved", "rejected", "expired"].includes(r.status)) continue;
    const key = `verify_${r.id}_${r.status}_${r.decidedAt || r.updatedAt}`;
    if (await seen(key)) continue;
    const emp = await getUser(r.id);
    if (!emp?.email) { await mark(key, "skipped"); continue; }
    const ok = r.status === "approved";
    const seeker = emp.role === "jobseeker";
    if (r.status === "expired") r.reason = "we didn't get to it within 14 days, so we deleted your photos to keep them safe";
    const body = ok
      ? `<p style="margin:0 0 12px 0;font-size:15px;line-height:22px;color:#444444;">Hi ${esc(first(emp.fullName))}, we checked your ID and you're now a <strong>Verified ${seeker ? "jobseeker" : "employer"}</strong>. ${seeker ? "Employers see the green Verified badge when you apply, so they know you're real." : "The green Verified badge shows on all your job posts, so jobseekers know you're real."}</p>
         <p style="margin:0;font-size:13px;color:#666666;">As promised, we deleted your ID photo and selfie. We only keep that you were verified and the type of ID.</p>${seeker ? button(link("#/", "email-verify"), "Find jobs") : button(link("#/my", "email-verify"), "See my posts")}`
      : `<p style="margin:0 0 12px 0;font-size:15px;line-height:22px;color:#444444;">Hi ${esc(first(emp.fullName))}, we couldn't verify your ID this time${r.reason ? `: <strong>${esc(r.reason)}</strong>` : "."}</p>
         <p style="margin:0;font-size:13px;color:#666666;">We deleted the photos you sent. You can send new ones from your profile${seeker ? ", and you can still apply to jobs in the meantime" : ", and your posts can still go live after our usual review"}.</p>${button(link("#/verify", "email-verify"), "Try again")}`;
    await deliver(key, emp.email, { subject: ok ? `You're a Verified ${seeker ? "jobseeker" : "employer"} on Job Search PH` : "We couldn't verify your ID yet", html: layout({ title: ok ? "You're verified" : "We couldn't verify your ID yet", preheader: ok ? (seeker ? "Employers will see the Verified badge when you apply." : "The Verified badge is on your posts now.") : "You can send new photos.", body, safety: false }), text: `${ok ? "You're verified." : "We couldn't verify your ID yet."} ${link(ok ? (seeker ? "#/" : "#/my") : "#/verify", "email-verify")}` });
    if (capped) break;
  }
  return pending;
}

/* ---------- Chat safety: flag messages that look like a scam (for the admin's Chat flags tab) ---------- */
async function scanChats(since) {
  const found = [];
  const apps = await query("applications", [["lastMessageAt", "GREATER_THAN", new Date(since)]]);
  for (const a of apps) {
    const msgs = await query("messages", [["createdAt", "GREATER_THAN", new Date(since)]], 500, `applications/${a.id}`);
    for (const m of msgs) {
      const fromEmployer = m.fromUid === a.employerUid;
      // Money, fees and codes from anyone; ID numbers and odd links only from employers.
      const flags = scamFlags(m.text).filter((f) => SERIOUS.includes(f.type) || fromEmployer);
      if (!flags.length) continue;
      const id = `${a.id}_${m.id}`;
      if (await get(`flags/${id}`)) continue;
      const f = { appId: a.id, msgId: m.id, jobId: a.jobId || "", jobTitle: a.jobTitle || "", fromUid: m.fromUid, toUid: fromEmployer ? a.applicantUid : a.employerUid,
        fromRole: fromEmployer ? "employer" : "jobseeker", fromName: fromEmployer ? a.employerName || "" : a.applicant?.fullName || "", text: String(m.text || "").slice(0, 300),
        types: flags.map((x) => x.type), createdAt: new Date(m.createdAt || now) };
      await patch(`flags/${id}`, f);
      found.push({ id, ...f });
      console.log(`Flagged chat ${id}: ${f.types.join(",")}`);
    }
  }
  return found;
}

/* ---------- 3. Admin summary ---------- */
async function adminSummary(since, pendingJobs, flagged = [], verifyReqs = []) {
  const [support, reports] = await Promise.all([
    query("support", [["createdAt", "GREATER_THAN", new Date(since)]]).catch(() => []),
    query("reports", [["createdAt", "GREATER_THAN", new Date(since)]]).catch(() => []),
  ]);
  const items = [
    ...pendingJobs.filter((j) => (j.editedAt || j.createdAt) > since).map((j) => ({ key: `admin_job_${j.id}_${j.editedAt || j.createdAt}`, kind: j.editedAt ? "Edited post to re-check" : "New post to review", text: `${j.title} · ${j.employerName} · ${j.city}`, href: link("#/admin/pending", "email-admin") })),
    ...support.map((s) => ({ key: `admin_support_${s.id}`, kind: `Support: ${s.topic || "message"}`, text: `${s.name || ""}: ${String(s.message || "").slice(0, 140)}`, href: link("#/admin/support", "email-admin") })),
    ...reports.map((r) => ({ key: `admin_report_${r.id}`, kind: `Report: ${r.reason}`, text: `Job ${r.jobId}${r.details ? ` · ${String(r.details).slice(0, 120)}` : ""}`, href: link(`#/job/${r.jobId}`, "email-admin") })),
    ...verifyReqs.map((r) => ({ key: `admin_verify_${r.id}_${r.createdAt}`, kind: "ID check to review", text: `${r.idType || "ID"} · sent ${new Date(r.createdAt).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`, href: link("#/admin/verify", "email-admin") })),
    ...flagged.map((f) => ({ key: `admin_flag_${f.id}`, kind: `Chat flag: ${f.types.join(", ")}`, text: `${f.fromName} (${f.fromRole}) · ${f.jobTitle}: “${f.text.slice(0, 120)}”`, href: link("#/admin/flags", "email-admin") })),
  ];
  const todo = [];
  for (const it of items) if (!(await seen(it.key))) todo.push(it);
  if (!todo.length) return;
  const NOUN = { "New post to review": ["new post to review", "new posts to review"], "Edited post to re-check": ["edited post to re-check", "edited posts to re-check"], Support: ["support message", "support messages"], Report: ["report", "reports"], "Chat flag": ["flagged chat message", "flagged chat messages"], "ID check to review": ["ID check to review", "ID checks to review"] };
  const counts = {};
  todo.forEach((t) => { const k = t.kind.split(":")[0]; counts[k] = (counts[k] || 0) + 1; });
  const summary = Object.entries(counts).map(([k, n]) => `${n} ${(NOUN[k] || [k.toLowerCase(), `${k.toLowerCase()}s`])[n === 1 ? 0 : 1]}`).join(", ");
  const body = `<p style="margin:0 0 14px 0;font-size:15px;line-height:22px;color:#444444;">${esc(summary)}.</p>
    ${todo.slice(0, 20).map((t) => card(`<div style="font-size:12px;color:#777777;text-transform:uppercase;letter-spacing:.5px;">${esc(t.kind)}</div><div style="margin-top:2px;">${esc(t.text)}</div><div style="margin-top:6px;"><a href="${esc(t.href)}" style="color:#3d4fd6;font-weight:bold;">Open</a></div>`)).join("")}
    ${todo.length > 20 ? `<p style="font-size:13px;color:#666666;">…and ${todo.length - 20} more.</p>` : ""}
    ${button(link("#/admin/pending", "email-admin"), "Open Admin")}`;
  const key = `admin_${now}`;
  if (await deliver(key, ADMIN_EMAIL, { subject: `Job Search PH: ${summary}`, html: layout({ title: "Something needs your attention", preheader: summary, body, safety: false }), text: `${summary}\n${link("#/admin/pending", "email-admin")}` })) {
    for (const t of todo) await mark(t.key, ADMIN_EMAIL);
  }
}

/* ---------- 4. Reminders for employers who haven't posted in a while (once a day, 10 AM PH) ---------- */
async function employerReminders() {
  const ph = new Date(now + 8 * 3600000);
  if (!process.env.FORCE_REMINDERS && ph.getUTCHours() !== 10) return;
  const month = ph.toISOString().slice(0, 7);
  const [emps, jobs, bans] = await Promise.all([query("users", [["role", "EQUAL", "employer"]]), query("jobs"), query("bans").catch(() => [])]);
  const banned = new Set(bans.map((b) => b.id));
  const byOwner = {};
  jobs.forEach((j) => (byOwner[j.ownerUid] ||= []).push(j));
  let n = 0;
  for (const emp of emps) {
    if (!emp.email || emp.emailNotify === false || banned.has(emp.id)) continue;
    const posts = byOwner[emp.id] || [];
    if (posts.some((j) => j.status === "pending" || (j.status === "approved" && (!j.expiresAt || j.expiresAt > now)))) continue;
    let key, subject, title, body;
    if (!posts.length) {
      if (!emp.createdAt || now - emp.createdAt < 7 * 86400000) continue;
      key = `remind_${emp.id}_first`; subject = "Ready to post your first job?"; title = "Ready to post your first job?";
      body = `<p style="margin:0 0 12px 0;font-size:15px;line-height:22px;color:#444444;">Hi ${esc(first(emp.fullName))}, you made an employer account on Job Search PH but haven't posted a job yet. It's free and takes about 2 minutes. Jobseekers in Negros Occidental can apply and message you right on the site.</p>${button(link("#/post", "email-remind"), "Post a job for free")}`;
    } else {
      const last = posts.reduce((a, b) => ((b.createdAt || 0) > (a.createdAt || 0) ? b : a));
      if (now - (last.createdAt || 0) < 30 * 86400000) continue;
      key = `remind_${emp.id}_${month}`; subject = "Still hiring? Post a job in 2 minutes"; title = "Still hiring?";
      body = `<p style="margin:0 0 12px 0;font-size:15px;line-height:22px;color:#444444;">Hi ${esc(first(emp.fullName))}, you don't have any live job posts on Job Search PH right now. If you need help again, posting is free and jobseekers can apply the same day.</p>
        ${card(`<div style="font-size:12px;color:#777777;text-transform:uppercase;letter-spacing:.5px;">Your last post</div><div style="font-size:15px;font-weight:bold;color:#111111;margin-top:2px;">${esc(last.title)}</div><div>${esc(last.city || "")} · ${new Date(last.createdAt).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}</div>`)}
        ${button(link("#/post", "email-remind"), "Post a job")}`;
    }
    if (await seen(key)) continue;
    if (await deliver(key, emp.email, { subject, html: layout({ title, preheader: subject, body, footerNote: settingsNote, safety: false }), text: `${title} ${link("#/post", "email-remind")}` })) n++;
    if (capped || n >= 20) return; // leave room in the daily Resend limit for job alerts and applicant emails
  }
}

async function main() {
  // Not set up yet: skip quietly instead of failing every 15 minutes.
  if (!hasFirebaseKey()) { console.log("Emails aren't set up yet: add the FIREBASE_SERVICE_ACCOUNT secret (and RESEND_API_KEY). Skipping."); return; }
  if (!process.env.RESEND_API_KEY && !process.env.EMAIL_OUTBOX) throw new Error("RESEND_API_KEY secret is missing.");
  await connect();
  const state = await get("meta/mailer");
  // Overlap 10 minutes with the last run; mailLog makes sure nothing is sent twice. First run: last 30 minutes only.
  const since = state?.lastRun ? state.lastRun - 10 * 60000 : now - 30 * 60000;
  try {
    await newApplicants(since);
    const pending = capped ? [] : await postUpdates(since);
    const flagged = await scanChats(since).catch((e) => { console.error(`Chat scan failed: ${e.message}`); return []; });
    await expireVerify().catch((e) => console.error(`ID check cleanup failed: ${e.message}`));
    await purgeDeletedChats().catch((e) => console.error(`Deleted-account cleanup failed: ${e.message}`));
    const verifyReqs = capped ? [] : await verifyUpdates(since);
    if (!capped) await adminSummary(since, pending, flagged, verifyReqs);
    if (!capped) await employerReminders();
  } catch (e) {
    if (e.status === 429 || e.status === 403) { console.error(`Stopping: Resend limit or key problem. ${e.message}`); process.exitCode = 1; return; }
    throw e;
  }
  if (capped) console.log(`Reached MAX_EMAILS (${MAX_EMAILS}); the rest go out on the next run.`);
  else await patch("meta/mailer", { lastRun: new Date(now) });
  console.log(`Done. Sent ${sent}.`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
