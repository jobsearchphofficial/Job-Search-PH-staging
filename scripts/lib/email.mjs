// Shared look and sending for every Job Search PH email (job alerts, new applicants, post updates, admin).
// Design: clean white page, centered logo, big indigo button, light "Stay safe" note, footer with address
// and small Facebook + website icons. Plain inline styles and tables so it renders in Gmail, Outlook and Yahoo.

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
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 8px 0;"><tr>
    <td style="background:#3d4fd6;border-radius:8px;"><a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${esc(label)}</a></td>
  </tr></table>`;

export const card = (inner, accent = "#3d4fd6", bg = "#f5f6fb") => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};border-left:3px solid ${accent};border-radius:10px;margin:0 0 12px 0;">
    <tr><td style="padding:16px 18px;font-size:15px;line-height:23px;color:#2b2f3a;">${inner}</td></tr>
  </table>`;

const SAFE = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
    <tr><td style="padding:14px 16px;background:#fbf7ec;border-radius:10px;font-size:13px;line-height:20px;color:#6b5a20;"><strong>Stay safe:</strong> Job Search PH never charges jobseekers. Real employers never ask you to pay to apply, train or get hired.</td></tr>
  </table>`;

// title: big heading. body: HTML. footerNote: why they got it + how to stop (HTML). preheader: inbox preview text.
export function layout({ title, preheader = "", body, footerNote = "", safety = true }) {
  const F = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const img = (n) => `${SITE}/assets/img/email/${n}.png`;
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
          <a href="${SITE}" style="text-decoration:none;"><img src="${img("website")}" width="22" height="22" alt="jobsearchph.com" style="display:inline-block;border:0;"></a>
        </td>
      </tr></table>
      ${footerNote ? `<p style="margin:18px 0 0 0;font-family:${F};font-size:12px;line-height:18px;color:#8a8fa3;">${footerNote}</p>` : ""}
      <p style="margin:12px 0 0 0;font-family:${F};font-size:12px;line-height:18px;color:#8a8fa3;"><a href="${SITE}/#/safety" style="color:#6b7186;text-decoration:underline;">Help &amp; safety</a> &nbsp;·&nbsp; <a href="${SITE}/#/privacy" style="color:#6b7186;text-decoration:underline;">Privacy</a> &nbsp;·&nbsp; <a href="${SITE}" style="color:#6b7186;text-decoration:underline;">jobsearchph.com</a></p>
      <p style="margin:10px 0 0 0;font-family:${F};font-size:11px;line-height:17px;color:#a3a7b6;">Job Search PH is a job listing board. We do not recruit, screen or place workers, and we never charge jobseekers.</p>
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
