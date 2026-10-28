// Shared look and sending for every Job Search PH email (job alerts, new applicants, post updates, admin).
// Design: accent bar, logo header, white card, big button, "Stay safe" note, footer with tagline and
// Facebook + website buttons. Plain inline styles and tables so it renders in Gmail, Outlook and Yahoo.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const SITE = (process.env.SITE_URL || "https://jobsearchph.com").replace(/\/+$/, "");
export const FACEBOOK = "https://www.facebook.com/thejobsearchph";
export const REPLY_TO = "support@jobsearchph.com";
const LOGO = "https://jobsearchph.com/assets/img/icon-circle-64.png"; // always the live logo: the test site's images may not be public yet

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const peso = (n) => "₱" + Number(n).toLocaleString("en-PH");
const PER = { month: "/ month", day: "/ day", hour: "/ hour" };
export function salaryText(j) {
  if (!j.salaryMin && !j.salaryMax) return "Salary negotiable";
  const per = PER[j.salaryPeriod] || "";
  if (j.salaryMin && j.salaryMax && j.salaryMax !== j.salaryMin) return `${peso(j.salaryMin)}–${peso(j.salaryMax)} ${per}`;
  return `${peso(j.salaryMin || j.salaryMax)} ${per}`;
}
// Links into the site, tagged so Admin → Analytics can count visits from emails.
export const link = (hash, src = "email") => `${SITE}/?src=${encodeURIComponent(src)}#${hash.replace(/^#/, "")}`;

export const button = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 6px 0;"><tr>
    <td style="background:#3d4fd6;border-radius:6px;"><a href="${esc(href)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${esc(label)}</a></td>
  </tr></table>`;

export const card = (inner, accent = "#3d4fd6", bg = "#f6f7fe") => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};border-left:4px solid ${accent};border-radius:6px;margin:0 0 12px 0;">
    <tr><td style="padding:14px 16px;font-size:14px;line-height:21px;color:#333333;">${inner}</td></tr>
  </table>`;

const SAFE = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff8e6;border-radius:6px;margin-top:18px;">
    <tr><td style="padding:12px 16px;font-size:13px;line-height:19px;color:#6b5200;"><strong>Stay safe:</strong> Job Search PH never charges jobseekers. Real employers never ask you to pay to apply, train or get hired.</td></tr>
  </table>`;

// title: big heading. body: HTML. footerNote: why they got it + how to stop (HTML). preheader: inbox preview text.
export function layout({ title, preheader = "", body, footerNote = "", safety = true }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f2f4fb;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f2f4fb;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f4fb;"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#222222;">
    <tr><td style="background:#3d4fd6;height:6px;line-height:6px;font-size:6px;">&nbsp;</td></tr>
    <tr><td style="padding:22px 28px 6px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;padding-right:12px;"><img src="${LOGO}" width="40" height="40" alt="Job Search PH" style="display:block;border:0;border-radius:20px;"></td>
        <td style="vertical-align:middle;font-size:18px;font-weight:bold;color:#3d4fd6;">Job Search PH</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:14px 28px 0 28px;">
      <h1 style="margin:0 0 12px 0;font-size:21px;line-height:27px;color:#111111;">${esc(title)}</h1>
      ${body}
      ${safety ? SAFE : ""}
    </td></tr>
    <tr><td style="padding:24px 28px 26px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e6e8f2;"><tr><td style="padding-top:18px;">
        <div style="font-size:14px;font-weight:bold;color:#3d4fd6;">Job Search PH</div>
        <div style="font-size:12px;color:#666666;margin:2px 0 12px 0;">Verified workers. Trusted employers. One platform.</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:8px;"><a href="${FACEBOOK}" style="display:inline-block;background:#1877F2;color:#ffffff;text-decoration:none;font-size:12px;font-weight:bold;padding:7px 14px;border-radius:4px;">Facebook</a></td>
          <td><a href="${SITE}" style="display:inline-block;background:#3d4fd6;color:#ffffff;text-decoration:none;font-size:12px;font-weight:bold;padding:7px 14px;border-radius:4px;">jobsearchph.com</a></td>
        </tr></table>
        ${footerNote ? `<div style="font-size:12px;line-height:18px;color:#777777;margin-top:14px;">${footerNote}</div>` : ""}
        <div style="font-size:11px;line-height:17px;color:#999999;margin-top:10px;">Job Search PH is a job listing board. We do not recruit, screen or place workers.<br>Bacolod City, Negros Occidental, Philippines</div>
      </td></tr></table>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

// Sends one email through Resend. EMAIL_OUTBOX=<folder> writes the emails there instead (tests).
// key: a stable id for this exact email, so a re-run can't send it twice (Resend keeps it for 24 h).
let outboxCount = 0;
export async function sendEmail({ to, subject, html, text, from, key, unsubscribe }) {
  const box = process.env.EMAIL_OUTBOX;
  if (box) {
    await mkdir(box, { recursive: true });
    const n = String(++outboxCount).padStart(2, "0");
    await writeFile(join(box, `${n}-${String(key || "email").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 60)}.html`), `<!-- to: ${to} | subject: ${subject} -->\n${html}`);
    return;
  }
  const headers = unsubscribe ? { "List-Unsubscribe": `<${unsubscribe}>, <mailto:${REPLY_TO}?subject=Unsubscribe>` } : undefined;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json", ...(key ? { "Idempotency-Key": key.slice(0, 256) } : {}) },
    body: JSON.stringify({ from, to: [to], reply_to: REPLY_TO, subject, html, text, headers }),
  });
  if (!res.ok) throw Object.assign(new Error(`Resend ${res.status}: ${await res.text()}`), { status: res.status });
  await new Promise((r) => setTimeout(r, 600)); // Resend allows 2 requests a second
}
