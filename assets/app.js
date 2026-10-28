import { store, onAuth, getAuthState, JOB_FIELDS, ageFrom, uploadsEnabled, LIMITS } from "./store.js?v=1793180680";
import { IS_STAGING } from "./firebase-config.js?v=1793180680";

/* ---------------- Constants ---------------- */
const CATEGORIES = [
  "Kasambahay / Househelper", "Yaya / Nanny", "Caregiver", "Cook", "Driver", "Laundry",
  "Gardener / Maintenance", "Food service", "Sales / Retail", "Delivery / Rider",
  "Construction / Skilled trade", "Security", "Office / Admin", "Other",
];
const TYPES = ["Live-in", "Stay-out", "Full-time", "Part-time", "Project-based"];
// Negros Occidental only for now: 13 cities and 19 municipalities.
const CITIES = [
  "Bacolod City", "Talisay City", "Silay City", "Bago City", "Victorias City", "Cadiz City",
  "Sagay City", "La Carlota City", "Kabankalan City", "San Carlos City", "Escalante City",
  "Himamaylan City", "Sipalay City",
  "Binalbagan", "Calatrava", "Candoni", "Cauayan", "E.B. Magalona", "Hinigaran", "Hinoba-an",
  "Ilog", "Isabela", "La Castellana", "Manapla", "Moises Padilla", "Murcia", "Pontevedra",
  "Pulupandan", "Salvador Benedicto", "San Enrique", "Toboso", "Valladolid", "Other",
];
// Barangays for the major cities (Metro Bacolod: Bacolod, Talisay, Silay, Bago), shown as "Barangay · City".
const BARANGAYS = {
  "Bacolod City": ["Alangilan", "Alijis", "Banago", "Bata", "Cabug", "Estefania", "Felisa", "Granada", "Handumanan", "Mandalagan",
    "Mansilingan", "Montevista", "Pahanocoy", "Punta Taytay", "Singcang-Airport", "Sum-ag", "Taculing", "Tangub", "Villamonte", "Vista Alegre"],
  "Talisay City": ["Bubog", "Cabatangan", "Concepcion", "Dos Hermanas", "Efigenio Lizares", "Katilingban", "Matab-ang", "San Fernando"],
  "Silay City": ["Bagtic", "Balaring", "E. Lopez", "Guimbala-on", "Guinhalaran", "Hawaiian", "Kapitan Ramon", "Lantad", "Mambulac", "Patag", "Rizal"],
  "Bago City": ["Abuanan", "Alianza", "Atipuluan", "Bacong-Montilla", "Bagroy", "Balingasag", "Binubuhan", "Busay", "Calumangan", "Caridad",
    "Don Jorge L. Araneta", "Dulao", "Ilijan", "Lag-Asan", "Ma-ao", "Mailum", "Malingin", "Napoles", "Pacol", "Poblacion", "Sagasa", "Sampinit", "Tabunan", "Taloc"],
};
const AREAS = Object.entries(BARANGAYS).flatMap(([city, list]) => list.map((b) => [b, city]));
// Job titles people search for most, used for "What" suggestions.
const POPULAR_TITLES = [
  "Kasambahay", "Yaya", "Caregiver", "Caretaker", "Cook", "Family driver", "Driver", "Housekeeper", "Nanny",
  "Elderly caregiver", "Laundry helper", "Gardener", "All-around helper", "Kitchen helper", "Waiter", "Waitress",
  "Cashier", "Sales lady", "Delivery rider", "Security guard", "Construction worker", "Carpenter", "Electrician",
  "Utility worker", "Barista", "Office staff", "Encoder", "Store helper", "Janitor", "Mason", "Welder", "Tutor",
];
const AVAILABILITY = ["Available now", "Within 2 weeks", "Within a month", "Not sure yet"];
const EDUCATION_LEVELS = ["Elementary level", "Elementary graduate", "High school level", "High school graduate", "Senior high school graduate", "Vocational / TESDA certificate", "College level", "College graduate", "Post-graduate"];
// Stored as one text field: "College graduate · University of St. La Salle"
const splitEdu = (v) => { const t = String(v || ""); const i = t.indexOf(" · "); const lvl = i < 0 ? t : t.slice(0, i); return EDUCATION_LEVELS.includes(lvl) ? [lvl, i < 0 ? "" : t.slice(i + 3)] : ["", t]; };
const PERIODS = { month: "/ month", day: "/ day", hour: "/ hour" };
const REPORT_REASONS = {
  fee: "Asks jobseekers to pay a fee",
  scam: "Looks like a scam or fake job",
  illegal: "Illegal or unsafe work (e.g. minors, trafficking)",
  wrong: "Wrong or misleading details",
  filled: "Job already filled",
  other: "Other",
};
const STATUS_LABEL = { pending: "Under review", approved: "Live", rejected: "Rejected", closed: "Closed" };
const APP_STATUS = { new: "Sent", shortlisted: "Shortlisted", offered: "Job offer", not_selected: "Not selected", offer_declined: "Offer declined", hired: "Hired" };
const DECLINED = ["not_selected", "offer_declined"];
const CAN_SMS = matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const FB_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v2.9h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/><path fill="#fff" d="m16.7 15.5.5-3.5h-3.4V9.7c0-1 .5-1.9 2-1.9h1.5V4.9s-1.4-.2-2.7-.2c-2.7 0-4.5 1.6-4.5 4.7V12h-3v3.5h3v8.4a12 12 0 0 0 3.7 0v-8.4h2.9z"/></svg>`;
const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\//i.test(navigator.userAgent);

/* ---------------- Wages, work conditions, places ---------------- */
// Official minimums. Negros Occidental (incl. Bacolod) follows the Western Visayas wage board;
// Negros Oriental follows Central Visayas. Update these when new wage orders take effect.
const WAGES = {
  R6: { name: "Western Visayas", household: 6500, daily: 525, dailyLarge: 550, since: "Nov 19, 2025" },
  R7: { name: "Central Visayas", household: 7500, daily: null, since: "Oct 14, 2026" },
};
const CITY_REGION = { "Dumaguete City": "R7" };
const WORK_DAYS = 26; // days per month used to convert daily and monthly pay
// Jobs that only exist in private homes; businesses don't see these.
const HOUSEHOLD_ONLY = ["Kasambahay / Househelper", "Yaya / Nanny"];
const HOUSEHOLD_CATS = ["Kasambahay / Househelper", "Yaya / Nanny", "Caregiver", "Cook", "Driver", "Laundry", "Gardener / Maintenance"];
const BENEFITS = ["SSS", "PhilHealth", "Pag-IBIG", "13th month pay", "Free meals", "Free lodging", "Paid leave", "Overtime pay", "Transport allowance", "Uniform provided"];
const LEGAL_HOUSEHOLD = ["SSS", "PhilHealth", "Pag-IBIG", "13th month pay"];
const CITY_COORDS = {
  "Bacolod City": [10.6765, 122.9509], "Talisay City": [10.7363, 122.9672], "Silay City": [10.7947, 122.9748],
  "Bago City": [10.5333, 122.8333], "Victorias City": [10.901, 123.071], "Cadiz City": [10.9506, 123.309],
  "Sagay City": [10.8967, 123.4167], "La Carlota City": [10.4239, 122.9213], "Kabankalan City": [9.9846, 122.8114],
  "San Carlos City": [10.4929, 123.4095], "Escalante City": [10.8404, 123.4994], "Himamaylan City": [10.0989, 122.8706],
  "Sipalay City": [9.7516, 122.4041], "Murcia": [10.605, 123.042], "Valladolid": [10.46, 122.83], "Pulupandan": [10.52, 122.8],
  "E.B. Magalona": [10.87, 123.03], "Manapla": [10.96, 123.12], "Iloilo City": [10.7202, 122.5621], "Roxas City": [11.5853, 122.7511],
  "Dumaguete City": [9.3068, 123.3054],
  "Binalbagan": [10.19, 122.86], "Calatrava": [10.6, 123.48], "Candoni": [9.83, 122.6], "Cauayan": [9.97, 122.62],
  "Hinigaran": [10.27, 122.85], "Hinoba-an": [9.6, 122.47], "Ilog": [10.03, 122.77], "Isabela": [10.2, 122.99],
  "La Castellana": [10.32, 123.02], "Moises Padilla": [10.27, 123.08], "Pontevedra": [10.37, 122.88],
  "Salvador Benedicto": [10.59, 123.22], "San Enrique": [10.42, 122.86], "Toboso": [10.72, 123.51],
};
function kmBetween([a, b], [c, d]) {
  const r = (x) => (x * Math.PI) / 180, R = 6371;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Lowest legal pay for a job, in the chosen pay period. Returns null when we have no rate to check.
function minimumPay(city, workplace, period) {
  const w = WAGES[CITY_REGION[city] || "R6"];
  let monthly;
  if (workplace === "household") monthly = w.household;
  else if (w.daily) monthly = w.daily * WORK_DAYS;
  else return null;
  const amt = period === "month" ? monthly : period === "day" ? monthly / WORK_DAYS : monthly / WORK_DAYS / 8;
  return { amount: Math.ceil(amt), region: w.name, since: w.since, basis: workplace === "household" ? `₱${w.household.toLocaleString("en-PH")}/month kasambahay minimum` : `₱${w.daily}/day minimum (₱${w.dailyLarge}/day if you have more than 10 workers)` };
}
const monthlyEquivalent = (j) => {
  const v = j.salaryMin || j.salaryMax; if (!v) return 0;
  return j.salaryPeriod === "month" ? v : j.salaryPeriod === "day" ? v * WORK_DAYS : v * 8 * WORK_DAYS;
};
const ICON = {
  pin: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2.3" stroke="currentColor" stroke-width="1.8"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  locate: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  cal: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  people: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="8.5" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.8a3 3 0 0 1 0 5.4M18 19a5.5 5.5 0 0 0-2.5-4.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
};
function requirementsHtml(j) {
  const exp = Number(j.reqExperience || 0);
  const facts = [];
  if (exp > 0) facts.push(["Experience", `${exp}+ year${exp === 1 ? "" : "s"}`]);
  else if (j.reqExperience === 0) facts.push(["Experience", "Not required"]);
  if (j.reqEducation && j.reqEducation !== "Any") facts.push(["Education", esc(j.reqEducation)]);
  const list = j.reqList || [];
  const other = (j.requirements || "").split("\n").map((r) => r.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  if (!facts.length && !list.length && !other.length) return "";
  return `<h2>Requirements</h2>
    ${facts.length ? `<dl class="conds">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>` : ""}
    ${list.length ? `<ul class="benefits reqchips">${list.map((r) => `<li>${ICON.check}${esc(r)}</li>`).join("")}</ul>` : ""}
    ${other.length ? `<ul class="reqs">${other.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}`;
}
function conditionsHtml(j) {
  const rows = [];
  if (j.workplace) rows.push([ICON.home, "Workplace", j.workplace === "household" ? "Private household" : "Business"]);
  if (!j.address && j.addressHidden) rows.push([ICON.pin, "Address", `<span data-private-address>${esc([j.area, j.city].filter(Boolean).join(", "))} · <span class="muted">exact address shared with the person hired</span></span>`]);
  if (j.address) { const q = encodeURIComponent([j.address, j.area, j.city, "Negros Occidental"].filter(Boolean).join(", ")); rows.push([ICON.pin, "Address", `${esc(j.address)}${j.area ? `, ${esc(j.area)}` : ""}, ${esc(j.city)} · <a href="https://www.google.com/maps/search/?api=1&amp;query=${q}" target="_blank" rel="noopener">Open map</a>`]); }
  if (j.hours) rows.push([ICON.clock, "Working hours", esc(j.hours)]);
  if (j.daysOff != null && j.daysOff !== "") rows.push([ICON.cal, "Days off", `${esc(j.daysOff)} day${Number(j.daysOff) === 1 ? "" : "s"} per ${j.daysOffPer === "month" ? "month" : "week"}`]);
  if (j.openings > 1) rows.push([ICON.people, "Openings", `${esc(j.openings)} people`]);
  if (j.startDate) rows.push([ICON.cal, "Start date", new Date(j.startDate + "T00:00:00").toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })]);
  const ben = (j.benefits || []).length ? `<ul class="benefits">${j.benefits.map((b) => `<li>${ICON.check}${esc(b)}</li>`).join("")}</ul>` : "";
  if (!rows.length && !ben) return "";
  return `<h2>Work conditions</h2>
    ${rows.length ? `<dl class="conds">${rows.map(([i, k, v]) => `<div><dt>${i}${k}</dt><dd>${v}</dd></div>`).join("")}</dl>` : ""}
    ${ben ? `<h3 class="sub">Benefits</h3>${ben}` : ""}`;
}

/* ---------------- Profile strength (jobseekers) ---------------- */
const STRENGTH_ITEMS = [
  { k: "photo", pts: 15, todo: "Add a profile photo", done: (p) => !!p.photo },
  { k: "jobCategories", pts: 10, todo: "Pick the jobs you want", done: (p) => Array.isArray(p.jobCategories) && p.jobCategories.length > 0 },
  { k: "experienceYears", pts: 10, todo: "Add your years of experience", done: (p) => p.experienceYears !== "" && p.experienceYears != null },
  { k: "availability", pts: 10, todo: "Say when you can start", done: (p) => !!p.availability },
  { k: "skills", pts: 15, todo: "List your skills (at least a few words)", done: (p) => String(p.skills || "").trim().length >= 15 },
  { k: "workHistory", pts: 15, todo: "Add your work history", done: (p) => String(p.workHistory || "").trim().length >= 20 },
  { k: "education", pts: 10, todo: "Add your education", done: (p) => String(p.education || "").trim().length >= 4 },
  { k: "gender", pts: 5, todo: "Choose your gender", done: (p) => !!p.gender },
  { k: "messenger", pts: 5, todo: "Add your Messenger", done: (p) => !!String(p.messenger || "").trim() },
  { k: "resumeUrl", pts: 5, todo: "Add a resume link", done: (p) => !!String(p.resumeUrl || p.resumeFileUrl || "").trim() },
];
function profileStrength(p = {}) {
  const score = STRENGTH_ITEMS.reduce((n, it) => n + (it.done(p) ? it.pts : 0), 0);
  const [level, cls] = score >= 90 ? ["Excellent", "s-excellent"] : score >= 70 ? ["Great", "s-great"] : score >= 40 ? ["Good", "s-good"] : ["Weak", "s-weak"];
  return { score, level, cls, todo: STRENGTH_ITEMS.filter((it) => !it.done(p)) };
}
const wantList = (u) => (Array.isArray(u.jobCategories) ? u.jobCategories : []).map((c) => (c === "Other" && u.jobCategoryOther ? `Other: ${u.jobCategoryOther}` : c));
const strengthChip = (p) => { const s = profileStrength(p); return `<span class="s-chip ${s.cls}" title="Profile strength ${s.score}/100">${s.level} profile</span>`; };
function strengthCard(p, compact = false) {
  const s = profileStrength(p);
  const next = s.todo.slice(0, compact ? 2 : 4);
  const msg = s.score >= 90 ? "Your profile stands out. Employers see everything they need." : s.score >= 70 ? "Almost there. A complete profile gets more replies." : s.score >= 40 ? "Good start. Add a few more details so employers pick you." : "Employers skip empty profiles. Add a few details to stand out.";
  return `<div class="strength ${s.cls}" id="strength">
    <div class="strength-top"><span>Profile strength</span><strong>${s.level} · ${s.score}/100</strong></div>
    <div class="strength-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.score}"><i style="width:${s.score}%"></i></div>
    <div class="strength-scale" aria-hidden="true"><span>Weak</span><span>Good</span><span>Great</span><span>Excellent</span></div>
    <p class="small">${msg}</p>
    ${next.length ? `<div class="strength-next">${next.map((it) => `<button type="button" class="s-step" data-goto="${it.k}"><span>${esc(it.todo)}</span><em>+${it.pts}</em></button>`).join("")}</div>` : ""}
  </div>`;
}

/* ---------------- Founding member badge (#1–#100) ---------------- */
let FOUNDERS = {};
const STAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.5l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.2z" fill="currentColor"/></svg>`;
// role: "employer" | "jobseeker". Numbers are kept internally (to cap at 100) but never shown.
function founderBadge(uid, role, { short = false } = {}) {
  if (!uid || !FOUNDERS[uid]) return "";
  const label = role === "employer" ? "Founding employer" : "Founding jobseeker";
  return `<span class="fbadge ${short ? "short" : ""}" title="${label}: one of the first 100 members of Job Search PH">${STAR}${label}</span>`;
}

/* ---------------- Verified employer (checked by an admin) ---------------- */
let VERIFIED = {};
const SHIELD = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 4.5 5.6v5.6c0 4.7 3.2 8.9 7.5 10 4.3-1.1 7.5-5.3 7.5-10V5.6L12 2.8Z" fill="currentColor"/><path d="m8.4 12.1 2.4 2.4 4.8-4.8" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function verifiedBadge(uid, { short = false } = {}) {
  if (!uid || !VERIFIED[uid]) return "";
  return `<span class="vbadge ${short ? "short" : ""}" title="Job Search PH checked this employer's identity">${SHIELD}Verified</span>`;
}
const VERIFY_METHODS = ["Talked on the phone", "Checked their Facebook", "Saw business permit / DTI", "Met in person", "Known to us"];
const INFO_ASKS = ["Your Facebook profile or page link", "Your business permit or DTI number", "The exact work location", "More details about the job", "Check the pay (it looks off)"];

// Things worth a second look before approving. Each: [level "bad"|"warn", text]
const SCAM_WORDS = /\b(fee|bayad|deposit|processing|placement|reservation|gcash|paymaya|maya|telegram|whatsapp|viber|abroad|overseas|dubai|saudi|qatar|kuwait|hong ?kong|taiwan|load|investment|easy money|sideline|online job)\b/i;
function riskFlags(j, owner, ctx) {
  const f = [];
  if (!owner) return [["bad", "No employer profile found"]];
  const ageH = owner.createdAt ? (Date.now() - owner.createdAt) / 3600000 : null;
  if (ageH != null && ageH < 24) f.push(["warn", `Brand-new account (made ${ago(owner.createdAt)})`]);
  if (owner.signIn === "password" && !owner.emailVerified) f.push(["warn", "Email not confirmed (signed up with email & password)"]);
  if (!owner.fbUrl) f.push(["warn", "No Facebook link on their profile"]);
  const txt = `${j.title} ${j.description} ${j.requirements || ""}`;
  const sw = txt.match(SCAM_WORDS); if (sw) f.push(["bad", `Post mentions “${sw[0]}” — common in scam posts`]);
  if (/(\+?63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}/.test(txt) || /https?:\/\/|www\.|\.com\b/i.test(txt)) f.push(["warn", "Phone number or link inside the job text"]);
  if ((j.description || "").trim().length < 60) f.push(["warn", "Very short job description"]);
  const ceil = PAY_CEIL[j.workplace === "business" ? "business" : "household"][j.salaryPeriod || "month"];
  if (ceil && Number(j.salaryMax || j.salaryMin) > ceil) f.push(["bad", "Pay is unusually high for this kind of job (too good to be true?)"]);
  const prev = ctx.jobs.filter((x) => x.ownerUid === j.ownerUid && x.id !== j.id);
  const rej = prev.filter((x) => x.status === "rejected").length; if (rej) f.push(["bad", `${rej} earlier post${rej === 1 ? " was" : "s were"} rejected`]);
  const day = prev.filter((x) => x.createdAt && Date.now() - x.createdAt < 86400000).length; if (day >= 2) f.push(["warn", `${day + 1} posts in the last 24 hours`]);
  const rep = ctx.reports.filter((r) => prev.some((x) => x.id === r.jobId) || r.jobId === j.id).length; if (rep) f.push(["bad", `${rep} report${rep === 1 ? "" : "s"} on their posts`]);
  const ph = digits(owner.phone).slice(-10);
  const same = ph.length === 10 ? ctx.users.filter((u) => u.id !== owner.id && digits(u.phone).slice(-10) === ph) : [];
  if (same.length) f.push(["bad", `Same phone as ${same.length} other account${same.length === 1 ? "" : "s"}: ${same.slice(0, 3).map((u) => esc(u.fullName || u.id)).join(", ")}`]);
  if (ctx.bans.some((b) => b.id === owner.id)) f.push(["bad", "This account is banned"]);
  if (owner.companyName && j.employerName && owner.companyName.trim().toLowerCase() !== j.employerName.trim().toLowerCase()) f.push(["warn", `Post name “${esc(j.employerName)}” differs from profile “${esc(owner.companyName)}”`]);
  return f;
}
const fbHref = (v) => { const u = safeUrl(v); try { return u && /(^|\.)(facebook\.com|fb\.com|fb\.me|m\.me)$/i.test(new URL(u).hostname) ? u : null; } catch { return null; } };

/* ---------------- Pay sanity check (catches typos like 85,000 instead of 8,500) ---------------- */
const PAY_CEIL = { household: { month: 25000, day: 1000, hour: 150 }, business: { month: 60000, day: 2500, hour: 350 } };
function payWarning(d) {
  const per = d.salaryPeriod || "month", ceil = (PAY_CEIL[d.workplace] || PAY_CEIL.business)[per];
  const lo = Number(d.salaryMin) || 0, hi = Number(d.salaryMax) || 0;
  const peso = (n) => `₱${Math.round(n).toLocaleString("en-PH")}`;
  const shown = hi && hi !== lo ? `${peso(lo)}–${peso(hi)}` : peso(lo);
  if (hi && lo && hi > lo * 2.5) {
    const guess = hi / 10 >= lo ? ` Did you mean ${peso(hi / 10)}?` : "";
    return { msg: `${shown} per ${per} is a very wide range. The top is much higher than the starting pay.${guess}`, field: "salaryMax" };
  }
  const top = Math.max(lo, hi);
  if (top > ceil) {
    const guess = top / 10 >= 1 ? ` Did you mean ${peso(top / 10)}?` : "";
    return { msg: `${shown} per ${per} is much higher than usual for ${d.workplace === "household" ? "household work" : "this kind of job"} in Negros Occidental.${guess}`, field: hi > ceil ? "salaryMax" : "salaryMin" };
  }
  return null;
}

/* ---------------- Drafts: keep unsaved form input across refreshes ---------------- */
const draftKey = (k) => { const u = getAuthState().user?.uid; return u ? `jsph-draft:${k}:${u}` : null; };
function saveDraft(k, form) {
  const key = draftKey(k); if (!key || !form) return;
  const d = {};
  form.querySelectorAll("input[name], textarea[name], select[name]").forEach((el) => {
    if (el.type === "file" || el.type === "password") return;
    if (el.type === "checkbox") { (d[el.name] ||= []); if (el.checked) d[el.name].push(el.value); }
    else if (el.type === "radio") { if (el.checked) d[el.name] = el.value; }
    else d[el.name] = el.value;
  });
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch {}
}
function loadDraft(k) {
  try { const key = draftKey(k); const r = key && JSON.parse(localStorage.getItem(key) || "null"); if (r && Date.now() - r.t < 7 * 86400000) return r.d; } catch {}
  return null;
}
function applyDraft(form, d) {
  Object.entries(d || {}).forEach(([n, v]) => form.querySelectorAll(`[name="${CSS.escape(n)}"]`).forEach((el) => {
    if (el.type === "checkbox") el.checked = Array.isArray(v) && v.includes(el.value);
    else if (el.type === "radio") el.checked = el.value === v;
    else if (el.type !== "file") el.value = v;
  }));
}
function clearDraft(k) { try { const key = draftKey(k); if (key) localStorage.removeItem(key); } catch {} }
function autosave(k, form) { let t; const go = () => { clearTimeout(t); t = setTimeout(() => saveDraft(k, form), 300); }; form.addEventListener("input", go); form.addEventListener("change", go); form.addEventListener("click", (e) => { if (e.target.closest("button[type=button]")) go(); }); }
const draftNote = () => `<p class="draft-note">${ICON.check}<span>We restored what you typed before. </span><button type="button" class="linkbtn" data-draft-clear>Start over</button></p>`;

/* ---------------- Helpers ---------------- */
// Skeleton placeholders shown while data loads.
const SK = {
  line: (w = 100, h = 12) => `<span class="sk" style="width:${w}%;height:${h}px"></span>`,
  card: () => `<div class="card sk-card" aria-hidden="true"><span class="sk" style="width:38%;height:10px"></span><span class="sk" style="width:72%;height:18px"></span><span class="sk" style="width:48%;height:12px"></span><span class="sk" style="width:58%;height:12px"></span><div class="sk-row"><span class="sk pill-sk"></span><span class="sk pill-sk"></span></div><div class="card-foot"><span class="sk" style="width:40%;height:14px"></span><span class="sk" style="width:18%;height:12px"></span></div></div>`,
  cards: (n = 6) => Array.from({ length: n }, SK.card).join(""),
  rows: (n = 4) => `<div class="table" aria-hidden="true">${Array.from({ length: n }, () => `<div class="trow"><div style="display:grid;gap:8px"><span class="sk" style="width:55%;height:14px"></span><span class="sk" style="width:35%;height:11px"></span></div><span class="sk pill-sk"></span><span class="sk" style="width:90px;height:32px;border-radius:10px"></span></div>`).join("")}</div>`,
  threads: (n = 5) => `<div class="inbox" aria-hidden="true">${Array.from({ length: n }, () => `<div class="thread"><span class="sk" style="width:40px;height:40px;border-radius:13px;flex:none"></span><span style="display:grid;gap:7px;flex:1"><span class="sk" style="width:40%;height:13px"></span><span class="sk" style="width:65%;height:11px"></span></span></div>`).join("")}</div>`,
  job: () => `<p><span class="sk" style="width:70px;height:14px"></span></p><article class="job" aria-hidden="true"><div class="job-main" style="display:grid;gap:12px"><span class="sk" style="width:60%;height:32px"></span><span class="sk" style="width:35%;height:14px"></span><span class="sk" style="width:45%;height:14px"></span><div class="sk-row"><span class="sk pill-sk"></span><span class="sk pill-sk"></span><span class="sk pill-sk"></span></div><span class="sk" style="width:100%;height:62px;border-radius:14px"></span><span class="sk" style="width:30%;height:18px"></span>${SK.line(95)}${SK.line(88)}${SK.line(70)}</div><aside class="job-side"><div class="panel" style="display:grid;gap:10px"><span class="sk" style="width:60%;height:18px"></span>${SK.line(90)}<span class="sk" style="width:100%;height:44px;border-radius:12px"></span></div></aside></article>`,
  panel: () => `<div style="display:grid;gap:10px" aria-hidden="true"><span class="sk" style="width:60%;height:18px"></span>${SK.line(90)}${SK.line(70)}<span class="sk" style="width:100%;height:44px;border-radius:12px"></span></div>`,
  chat: () => `<div style="display:grid;gap:10px" aria-hidden="true"><span class="sk" style="width:55%;height:38px;border-radius:16px"></span><span class="sk" style="width:40%;height:38px;border-radius:16px;justify-self:end"></span><span class="sk" style="width:60%;height:38px;border-radius:16px"></span></div>`,
  page: () => `<div style="display:grid;gap:14px" aria-hidden="true"><span class="sk" style="width:40%;height:30px"></span>${SK.line(30)}${SK.rows(3)}</div>`,
};
// Round avatar: photo when there is one, otherwise the first letter.
function avatar(name, photo, cls = "sm") {
  const ok = typeof photo === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo);
  return ok ? `<img class="avatar ${cls} photo" src="${photo}" alt="">` : `<span class="avatar ${cls}" aria-hidden="true">${esc((String(name || "?").trim().charAt(0) || "?").toUpperCase())}</span>`;
}
// Shrink a picked image to a 256px square JPEG data URL (about 15–25 KB).
function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error("Choose a photo (JPG or PNG)."));
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 256, c = document.createElement("canvas"); c.width = c.height = size;
      const s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = (img.height - s) / 2;
      const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size); URL.revokeObjectURL(url);
      let q = 0.82, out = c.toDataURL("image/jpeg", q);
      while (out.length > 55000 && q > 0.4) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That photo couldn't be read. Try another one.")); };
    img.src = url;
  });
}
// Crop dialog: drag to move, slider/scroll/pinch to zoom. Resolves a 256px JPEG data URL, or null on cancel.
function cropPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error("Choose a photo (JPG or PNG)."));
    const url = URL.createObjectURL(file); const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That photo couldn't be read. Try another one.")); };
    img.onload = () => {
      const V = 280; // viewport size in CSS px
      const wrap = document.createElement("div"); wrap.className = "dlg-backdrop";
      wrap.innerHTML = `<div class="dlg crop-dlg" role="dialog" aria-modal="true" aria-labelledby="crop-t">
        <h2 id="crop-t">Crop your photo</h2>
        <p>Drag to move. Use the slider to zoom.</p>
        <div class="crop-stage"><canvas width="${V * 2}" height="${V * 2}" style="width:${V}px;height:${V}px"></canvas><div class="crop-ring" aria-hidden="true"></div></div>
        <label class="crop-zoom"><span aria-hidden="true">−</span><input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom"><span aria-hidden="true">+</span></label>
        <div class="dlg-actions"><button class="btn btn-ghost" data-crop="cancel">Cancel</button><button class="btn btn-primary" data-crop="save">Save photo</button></div>
      </div>`;
      document.body.appendChild(wrap);
      const cv = wrap.querySelector("canvas"), ctx = cv.getContext("2d"), range = wrap.querySelector("input[type=range]");
      const base = V / Math.min(img.width, img.height); // scale that just covers the viewport
      let zoom = 1, cx = img.width / 2, cy = img.height / 2; // image point at viewport centre
      const clamp = () => {
        const half = V / 2 / (base * zoom);
        cx = Math.min(Math.max(cx, half), img.width - half); cy = Math.min(Math.max(cy, half), img.height - half);
      };
      const draw = () => {
        clamp(); const k = base * zoom * 2;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, cv.width / 2 - cx * k, cv.height / 2 - cy * k, img.width * k, img.height * k);
      };
      draw();
      const setZoom = (z) => { zoom = Math.min(4, Math.max(1, z)); range.value = zoom; draw(); };
      range.addEventListener("input", () => setZoom(Number(range.value)));
      cv.addEventListener("wheel", (e) => { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.93)); }, { passive: false });
      const pts = new Map(); let pinch = 0;
      cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); });
      cv.addEventListener("pointermove", (e) => {
        if (!pts.has(e.pointerId)) return;
        const [px, py] = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 2) {
          const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          if (pinch) setZoom(zoom * (d / pinch)); pinch = d; return;
        }
        const k = base * zoom; cx -= (e.clientX - px) / k; cy -= (e.clientY - py) / k; draw();
      });
      const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; };
      cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
      const done = (val) => { wrap.remove(); URL.revokeObjectURL(url); document.removeEventListener("keydown", onKey); resolve(val); };
      const onKey = (e) => { if (e.key === "Escape") done(null); };
      document.addEventListener("keydown", onKey);
      wrap.addEventListener("click", (e) => {
        const b = e.target.closest("[data-crop]"); if (!b) return;
        if (b.dataset.crop === "cancel") return done(null);
        const out = document.createElement("canvas"); out.width = out.height = 256; const o = out.getContext("2d");
        const k = base * zoom, half = V / 2 / k;
        o.fillStyle = "#fff"; o.fillRect(0, 0, 256, 256);
        o.drawImage(img, cx - half, cy - half, half * 2, half * 2, 0, 0, 256, 256);
        let q = 0.85, data = out.toDataURL("image/jpeg", q);
        while (data.length > 55000 && q > 0.4) { q -= 0.1; data = out.toDataURL("image/jpeg", q); }
        done(data);
      });
      wrap.querySelector("[data-crop=save]").focus();
    };
    img.src = url;
  });
}
const limitMsg = {
  applies: `You've applied to ${LIMITS.applies} jobs today, the daily limit. You can apply again tomorrow.`,
  posts: `You've posted ${LIMITS.posts} jobs this month, the monthly limit. You can post again on the 1st of next month.`,
  messages: `You've sent ${LIMITS.messages} messages today, the daily limit. You can chat again tomorrow.`,
  reports: `You've sent ${LIMITS.reports} reports today. Contact support if something urgent needs attention.`,
  support: `You've sent ${LIMITS.support} support messages today. We'll reply to those first.`,
};
const $ = (s, el = document) => el.querySelector(s);
// 32 random letters/digits: the secret in a job alert email's unsubscribe link.
const alertToken = () => { const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; return [...crypto.getRandomValues(new Uint8Array(32))].map((b) => c[b % 62]).join(""); };
const app = $("#app");
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const peso = (n) => "₱" + Number(n).toLocaleString("en-PH");
const nl2br = (s) => esc(s).replace(/\n/g, "<br>");
const opts = (list, sel) => list.map((c) => `<option ${sel === c ? "selected" : ""}>${esc(c)}</option>`).join("");
const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "Profile";

function salaryText(j) {
  if (!j.salaryMin && !j.salaryMax) return "Salary negotiable";
  const per = PERIODS[j.salaryPeriod] || "";
  if (j.salaryMin && j.salaryMax && j.salaryMax !== j.salaryMin) return `${peso(j.salaryMin)}–${peso(j.salaryMax)} ${per}`;
  return `${peso(j.salaryMin || j.salaryMax)} ${per}`;
}
function ago(ms) {
  if (!ms) return "";
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 60) return m <= 1 ? "just now" : `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24); if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}
const isLive = (j) => j.status === "approved" && (!j.expiresAt || j.expiresAt > Date.now());
const digits = (v) => String(v || "").replace(/[^\d+]/g, "");
const safeUrl = (v) => { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } };

function messengerUrl(v) {
  v = String(v || "").trim(); if (!v) return null;
  let user = v;
  try {
    if (/^https?:\/\//i.test(v)) {
      const u = new URL(v);
      if (!/(^|\.)(m\.me|facebook\.com|messenger\.com)$/i.test(u.hostname)) return null;
      user = u.pathname.replace(/^\/+|\/+$/g, "").replace(/^t\//, "");
    }
  } catch { return null; }
  user = user.replace(/[^A-Za-z0-9.\-_]/g, "");
  return user ? `https://m.me/${user}` : null;
}
function contactLink(c) {
  if (!c) return null;
  const v = String(c.contactValue || "").trim();
  if (c.contactMethod === "phone") return { href: `tel:${digits(v)}`, label: `Call ${v}`, extra: CAN_SMS ? `sms:${digits(v)}` : null, text: v };
  if (c.contactMethod === "email") {
    if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(v)) return null;
    return { href: `mailto:${v}`, label: `Email ${v}`, text: v };
  }
  const m = messengerUrl(v);
  return m ? { href: m, label: "Message on Messenger", text: v } : null;
}

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2800);
}
const statusBadge = (j) => {
  const s = j.status === "approved" && !isLive(j) ? "expired" : j.status;
  return `<span class="badge badge-${s}">${s === "expired" ? "Expired" : STATUS_LABEL[s]}</span>`;
};
const appBadge = (s, employer) => `<span class="badge badge-app-${s}">${employer && s === "new" ? "New" : employer && s === "offered" ? "Offer sent" : employer && s === "offer_declined" ? "Declined your offer" : APP_STATUS[s] || s}</span>`;

function authError(err) {
  const code = err?.code || "";
  const map = {
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/missing-password": "Enter your password.",
    "auth/weak-password": "Use a password with at least 6 characters.",
    "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
    "auth/invalid-credential": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/user-not-found": "No account with that email. Create one instead.",
    "auth/too-many-requests": "Too many tries. Wait a few minutes and try again.",
    "auth/popup-closed-by-user": "The sign-in window was closed before signing in.",
    "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups or use email instead.",
    "auth/cancelled-popup-request": "The sign-in window was closed before signing in.",
    "auth/account-exists-with-different-credential": "You already have an account with this email. Sign in with Google or email first, then connect Facebook in My profile.",
    "auth/credential-already-in-use": "That Facebook account is already used by another Job Search PH account.",
    "auth/provider-already-linked": "Facebook is already connected to your account.",
    "auth/requires-recent-login": "For your safety, sign out and sign in again, then try once more.",
    "last-method": "You need at least one other way to sign in before removing Facebook.",
    "auth/operation-not-allowed": "This sign-in method isn't turned on yet.",
    "auth/unauthorized-domain": "This website address isn't allowed for sign-in yet.",
    "auth/network-request-failed": "No internet connection. Check your connection and try again.",
  };
  return map[code] || `Something went wrong (${code || err?.message || "unknown"}).`;
}

// Two-click confirm without browser dialogs.
function confirmInline(btn, text = "Click again to confirm") {
  if (btn.dataset.armed) return true;
  const orig = btn.textContent; btn.dataset.armed = "1"; btn.textContent = text; btn.classList.add("armed");
  setTimeout(() => { delete btn.dataset.armed; btn.textContent = orig; btn.classList.remove("armed"); }, 3000);
  return false;
}

/* ---------------- Auth flow helpers ---------------- */
let returnTo = null;
let signInPurpose = "";
let pendingName = "";
let signupIntent = "";
function goSignIn(purpose, intent) {
  returnTo = location.hash || "#/";
  if (intent) signupIntent = intent;
  if (intent === "employer" && /^#?\/?$/.test(location.hash)) returnTo = "#/post";
  signInPurpose = purpose || "";
  location.hash = "#/signin";
}
function finishAuthFlow() {
  const { profile } = getAuthState();
  if (!profile) { location.hash = "#/profile"; return; }
  const to = returnTo && !/^#\/(signin|profile)/.test(returnTo) ? returnTo : "#/";
  returnTo = null;
  if (location.hash === to) route(); else location.hash = to;
}

/* ---------------- Dialog (no browser popups) ---------------- */
function showDialog({ title, body, actions }) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "dlg-backdrop";
    wrap.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><h2 id="dlg-t">${title}</h2><p>${body}</p>
      <div class="dlg-actions">${actions.map((a, i) => `<button class="btn ${a.primary ? "btn-primary" : "btn-ghost"}" data-i="${i}">${a.label}</button>`).join("")}</div></div>`;
    const done = (v) => { wrap.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") done(null); };
    wrap.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) done(actions[b.dataset.i].value); else if (e.target === wrap) done(null); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(wrap);
    wrap.querySelector(".btn-primary, .btn")?.focus();
  });
}

// Dialog with choice pills. Resolves to an array of picked labels (plus "other" text), or null if cancelled.
function pickDialog({ title, body, options, multi = false, other = "", confirm = "OK" }) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "dlg-backdrop";
    wrap.innerHTML = `<div class="dlg dlg-pick" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><h2 id="dlg-t">${title}</h2><p>${body}</p>
      <div class="pills">${options.map((o) => `<label class="pill"><input type="${multi ? "checkbox" : "radio"}" name="pk" value="${esc(o)}"><span>${esc(o)}</span></label>`).join("")}</div>
      ${other ? `<label class="small pk-other">${esc(other)}<input maxlength="150" id="pk-other"></label>` : ""}
      <p class="error small" id="pk-err" hidden>Pick at least one.</p>
      <div class="dlg-actions"><button class="btn btn-ghost" data-v="0">Cancel</button><button class="btn btn-primary" data-v="1">${confirm}</button></div></div>`;
    const done = (v) => { wrap.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") done(null); };
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) return done(null);
      const b = e.target.closest("[data-v]"); if (!b) return;
      if (b.dataset.v === "0") return done(null);
      const picked = [...wrap.querySelectorAll("[name=pk]:checked")].map((i) => i.value);
      const extra = wrap.querySelector("#pk-other")?.value.trim(); if (extra) picked.push(extra);
      if (!picked.length) { wrap.querySelector("#pk-err").hidden = false; return; }
      done(picked);
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(wrap);
  });
}

/* ---------------- Notifications ---------------- */
let notifs = [];
let unwatch = null;
let pendingForAdmin = 0;
const BELL = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2H4.5l1.5-2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 20.5a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
function startNotifications() {
  if (unwatch) { unwatch(); unwatch = null; }
  notifs = []; renderBell();
  const { user, isAdmin } = getAuthState();
  if (!user) return;
  unwatch = store.watchNotifications((list) => { if (list.length !== notifs.length) myAppsCache = null; notifs = list; renderBell(); });
  if (isAdmin) store.pendingCount().then((n) => { pendingForAdmin = n; renderBell(); renderNav(); });
}
function renderBell() {
  const wrap = $("#bell-wrap"); const { user, isAdmin } = getAuthState();
  if (!user) { wrap.innerHTML = ""; return; }
  const unread = notifs.filter((n) => !n.read).length + (isAdmin && pendingForAdmin ? 1 : 0);
  const open = wrap.classList.contains("open");
  const items = [
    ...(isAdmin && pendingForAdmin ? [{ id: "_pending", title: `${pendingForAdmin} post${pendingForAdmin === 1 ? "" : "s"} waiting for review`, body: "Approve or reject them in Admin.", link: "#/admin/pending", read: false, createdAt: null, type: "admin" }] : []),
    ...notifs,
  ];
  wrap.innerHTML = `
    <button class="bell" id="bell-btn" aria-label="Notifications${unread ? `, ${unread} unread` : ""}" aria-expanded="${open}">${BELL}${unread ? `<span class="bell-count">${unread > 9 ? "9+" : unread}</span>` : ""}</button>
    <div class="notif-panel" ${open ? "" : "hidden"}>
      <div class="notif-head"><strong>Notifications</strong>${notifs.some((n) => !n.read) ? `<button class="linkbtn" id="mark-all">Mark all as read</button>` : ""}</div>
      <div class="notif-list">${items.length ? items.map((n) => `
        <button class="notif ${n.read ? "" : "unread"} t-${esc(n.type || "")}" data-nid="${esc(n.id)}" data-link="${esc(n.link || "")}">
          <span class="notif-dot" aria-hidden="true"></span>
          <span class="notif-text"><strong>${esc(n.title)}</strong>${n.body ? `<span>${esc(n.body)}</span>` : ""}${n.createdAt ? `<small>${ago(n.createdAt)}</small>` : ""}</span>
        </button>`).join("") : `<p class="notif-empty">No notifications yet. You'll see application updates here.</p>`}</div>
    </div>`;
}
document.addEventListener("click", async (e) => {
  const wrap = $("#bell-wrap");
  if (e.target.closest("#bell-btn")) { $("#gear-wrap").classList.remove("open"); renderGear(); wrap.classList.toggle("open"); renderBell(); return; }
  if (e.target.closest("#mark-all")) { await store.markRead(notifs.filter((n) => !n.read).map((n) => n.id)).catch(() => {}); return; }
  const item = e.target.closest(".notif");
  if (item) {
    wrap.classList.remove("open");
    if (item.dataset.nid !== "_pending") store.markRead([item.dataset.nid]).catch(() => {});
    if (item.dataset.link) { if (location.hash === item.dataset.link) route(); else location.hash = item.dataset.link; }
    renderBell(); return;
  }
  if (wrap.classList.contains("open") && !e.target.closest("#bell-wrap")) { wrap.classList.remove("open"); renderBell(); }
});

/* ---------------- Nav ---------------- */
function renderNav() {
  const { user, profile, isAdmin } = getAuthState();
  const here = location.hash || "#/";
  const link = (href, label) => `<a href="${href}" class="${here === href || (href !== "#/" && here.startsWith(href)) ? "active" : ""}">${label}</a>`;
  const role = profile?.role;
  $("#nav").innerHTML = [
    link("#/", "Find jobs"),
    !user || role === "employer" ? link("#/post", "Post a job") : "",
    role === "employer" ? link("#/my", "My posts") : "",
    role === "jobseeker" ? link("#/applications", "My applications") : "",
    user && profile ? link("#/messages", `Messages${unreadMessages() ? ` <span class="dot">${unreadMessages()}</span>` : ""}`) : "",
    user && !profile ? link("#/profile", "Set up profile") : "",
    user ? "" : `<a class="btn btn-primary btn-sm nav-cta" href="#/signin" data-action="gosignin">Sign in</a>`,
  ].join("");
  renderGear();
}

/* ---------------- Settings menu ---------------- */
const GI = {
  gear: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-2.6-1.5L14.1 2.6h-4.2l-.4 2.4a7.5 7.5 0 0 0-2.6 1.5l-2.3-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-.9a7.5 7.5 0 0 0 2.6 1.5l.4 2.4h4.2l.4-2.4a7.5 7.5 0 0 0 2.6-1.5l2.3.9 2-3.4-2-1.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5" stroke="currentColor" stroke-width="1.8"/><path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  help: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>`,
  doc: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3h7l4 4v14H7V3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 12h5M10 16h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  out: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  admin: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/></svg>`,
};
const getTheme = () => { try { return localStorage.getItem("jsph-theme") || "light"; } catch { return "light"; } };
function setTheme(t) {
  try { localStorage.setItem("jsph-theme", t); } catch {}
  if (t === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#151b31" : "#3d4fd6");
}
function renderGear() {
  const wrap = $("#gear-wrap"); const { user, profile, isAdmin } = getAuthState();
  if (!user) { wrap.innerHTML = ""; wrap.classList.remove("open"); return; }
  const open = wrap.classList.contains("open"); const theme = getTheme();
  const name = profile?.fullName || user.displayName || "Your account";
  wrap.innerHTML = `
    <button class="bell" id="gear-btn" aria-label="Settings" aria-expanded="${open}">${GI.gear}</button>
    <div class="set-panel" ${open ? "" : "hidden"}>
      <div class="set-user">${avatar(name, profile?.photo)}
        <div><strong>${esc(name)}</strong><span>${esc(user.email || "")}${profile ? ` · ${profile.role === "employer" ? "Employer" : "Jobseeker"}` : ""}</span></div></div>
      <div class="set-group">
        <a class="set-item" href="#/profile">${GI.user}${profile ? "My profile" : "Set up profile"}</a>
        ${isAdmin ? `<a class="set-item" href="#/admin">${GI.admin}Admin${pendingForAdmin ? `<span class="dot">${pendingForAdmin}</span>` : ""}</a>` : ""}
      </div>
      <div class="set-group">
        <p class="set-label">Appearance</p>
        <div class="theme-pick" role="radiogroup" aria-label="Appearance">${[["light", "Light"], ["dark", "Dark"], ["system", "Auto"]].map(([k, l]) => `<button role="radio" aria-checked="${theme === k}" class="${theme === k ? "on" : ""}" data-theme-set="${k}">${l}</button>`).join("")}</div>
      </div>
      <div class="set-group">
        <a class="set-item" href="#/support">${GI.help}Contact support</a>
        <a class="set-item" href="#/safety">${GI.shield}Safety tips</a>
        <a class="set-item" href="#/terms">${GI.doc}Terms &amp; privacy</a>
      </div>
      <div class="set-group"><button class="set-item danger" data-action="signout">${GI.out}Sign out</button></div>
    </div>`;
}
document.addEventListener("click", (e) => {
  const wrap = $("#gear-wrap"); if (!wrap) return;
  if (e.target.closest("#gear-btn")) { $("#bell-wrap").classList.remove("open"); renderBell(); wrap.classList.toggle("open"); renderGear(); return; }
  const th = e.target.closest("[data-theme-set]"); if (th) { setTheme(th.dataset.themeSet); renderGear(); return; }
  if (wrap.classList.contains("open") && (e.target.closest(".set-item") || !e.target.closest("#gear-wrap"))) { wrap.classList.remove("open"); renderGear(); }
});
$("#nav-toggle").addEventListener("click", () => {
  const nav = $("#nav"); const open = nav.classList.toggle("open");
  $("#nav-toggle").setAttribute("aria-expanded", open);
});
document.addEventListener("click", async (e) => {
  const a = e.target.closest("[data-action]"); if (!a) return;
  if (a.dataset.action === "signout") { $("#gear-wrap").classList.remove("open"); await store.signOut(); myAppsCache = null; toast("Signed out"); location.hash = "#/"; }
  if (a.dataset.action === "gosignin") { e.preventDefault(); goSignIn(a.dataset.purpose, a.dataset.intent); }
});

/* ---------------- Search helpers ---------------- */
const PAY_MIN = 6500, PAY_MAX = 30000;
const payLabel = (v) => (Number(v) > PAY_MIN ? `₱${Number(v).toLocaleString("en-PH")}+ / month` : "Any (₱6,500+)");
const clock = (h) => { h = ((h % 24) + 24) % 24; return `${h % 12 || 12}:00 ${h < 12 ? "AM" : "PM"}`; };
const hl = (text, t) => { const i = text.toLowerCase().indexOf(t); return i < 0 ? esc(text) : `${esc(text.slice(0, i))}<mark>${esc(text.slice(i, i + t.length))}</mark>${esc(text.slice(i + t.length))}`; };
// Lightweight combobox: shows suggestions as you type; arrows + Enter to pick, Esc to close.
function autocomplete(input, list, suggest, onPick, openOnFocus = false) {
  let items = [], active = -1;
  const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; };
  const paint = () => {
    list.innerHTML = items.map((it, i) => `<li role="option" id="${list.id}-${i}" class="${i === active ? "on" : ""}" aria-selected="${i === active}" data-i="${i}"><span>${it.html}</span>${it.meta ? `<small>${esc(it.meta)}</small>` : ""}</li>`).join("");
    list.hidden = !items.length; input.setAttribute("aria-expanded", String(!!items.length));
    if (active >= 0) input.setAttribute("aria-activedescendant", `${list.id}-${active}`); else input.removeAttribute("aria-activedescendant");
  };
  const open = () => { items = suggest(input.value); active = -1; paint(); };
  const pick = (i) => { const it = items[i]; if (!it) return; input.value = it.value; close(); onPick(it.value); };
  input.addEventListener("input", open);
  input.addEventListener("focus", () => { if (input.value || openOnFocus) open(); });
  input.addEventListener("keydown", (e) => {
    if (list.hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); active = (active + 1) % items.length; paint(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = (active - 1 + items.length) % items.length; paint(); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(active); }
    else if (e.key === "Escape") close();
  });
  list.addEventListener("mousedown", (e) => { const li = e.target.closest("li"); if (li) { e.preventDefault(); pick(Number(li.dataset.i)); } });
  input.addEventListener("blur", () => setTimeout(close, 120));
}

/* ---------------- Jobs list ---------------- */
let jobsCache = null;
let myAppsCache = null;
const filters = { q: "", where: "", category: "", type: "", minPay: "", sort: "new", near: null, nearCity: "" };

async function getMyApps() {
  const { profile } = getAuthState();
  if (profile?.role !== "jobseeker") return [];
  if (!myAppsCache) myAppsCache = await store.myApplications().catch(() => []);
  return myAppsCache;
}

async function viewList() {
  document.title = "Job Search PH — Jobs in Negros Occidental";
  const { user } = getAuthState();
  const cityList = CITIES.filter((c) => c !== "Other");
  app.innerHTML = `
    <section class="hero">
      <span class="eyebrow">Free for jobseekers · No fees, ever</span>
      <h1>Find work near you in <em>Negros Occidental</em></h1>
      <p>Household, service and local jobs from employers in Bacolod and nearby towns. Every post is checked and must pay at least the legal minimum wage.</p>
      <form class="search2" id="search" role="search">
        <div class="field ac"><span class="ico">${ICON.search}</span><label class="sr" for="q">What</label>
          <input type="search" id="q" name="q" placeholder="Job title or keyword" value="${esc(filters.q)}" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="q-list" aria-autocomplete="list">
          <ul class="ac-list" id="q-list" role="listbox" hidden></ul></div>
        <div class="field ac"><span class="ico">${ICON.pin}</span><label class="sr" for="where">Where</label>
          <input type="search" id="where" name="where" placeholder="City, town or barangay" value="${esc(filters.where)}" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="where-list" aria-autocomplete="list">
          <ul class="ac-list" id="where-list" role="listbox" hidden></ul></div>
        <button class="btn btn-primary" type="submit">Search</button>
      </form>
      <div class="hero-row">
        <button class="btn btn-ghost btn-sm near" id="near" type="button">${ICON.locate}<span>${filters.near ? `Near ${esc(filters.nearCity)}` : "Use my location"}</span></button>
        <div class="hero-stats"><span><strong id="stat-jobs">–</strong> open jobs</span><span><strong id="stat-cities">–</strong> locations</span></div>
      </div>
      ${user ? "" : `<div class="hero-actions"><a class="btn btn-ghost btn-sm" href="#/signin" data-action="gosignin" data-intent="jobseeker" data-purpose="Create your free profile">Create a free profile</a><a class="btn btn-ghost btn-sm" href="#/signin" data-action="gosignin" data-intent="employer" data-purpose="Sign in to post a job">I'm hiring</a></div>`}
    </section>
    <nav class="cat-chips" aria-label="Categories">
      <button class="cat ${!filters.category ? "on" : ""}" data-cat="">All jobs</button>
      ${CATEGORIES.map((c) => `<button class="cat ${filters.category === c ? "on" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
    </nav>
    <div class="toolbar">
      <span id="count" class="muted"></span>
      <div class="toolbar-filters">
        <select id="f-type" name="type" aria-label="Job type"><option value="">Any type</option>${opts(TYPES, filters.type)}</select>
        <label class="pay-slider"><span class="ps-label">Pay <strong id="pay-out">${payLabel(filters.minPay)}</strong></span>
          <input type="range" id="f-pay" min="${PAY_MIN}" max="${PAY_MAX}" step="500" value="${filters.minPay || PAY_MIN}" aria-label="Minimum monthly pay"></label>
        <select id="f-sort" name="sort" aria-label="Sort">
          <option value="new" ${filters.sort === "new" ? "selected" : ""}>Newest</option>
          <option value="pay" ${filters.sort === "pay" ? "selected" : ""}>Highest pay</option>
          <option value="near" ${filters.sort === "near" ? "selected" : ""}>Nearest</option>
        </select>
      </div>
    </div>
    <div id="active-filters" class="active-filters"></div>
    <section id="results" class="cards">${SK.cards(6)}</section>
    <aside class="notice"><strong>Stay safe:</strong> legitimate employers never ask you to pay to apply, train or get hired. <a href="#/safety">Read safety tips</a></aside>`;

  let applied = new Set();
  const distanceOf = (j) => (filters.near && CITY_COORDS[j.city] ? kmBetween(filters.near, CITY_COORDS[j.city]) : null);
  const draw = () => {
    const q = filters.q.trim().toLowerCase();
    const where = filters.where.trim().toLowerCase();
    let list = (jobsCache || []).filter(isLive)
      .filter((j) => !filters.category || j.category === filters.category)
      .filter((j) => !filters.type || j.employmentType === filters.type || j.schedule === filters.type)
      .filter((j) => !(Number(filters.minPay) > PAY_MIN) || monthlyEquivalent(j) >= Number(filters.minPay))
      .filter((j) => !where || [j.city, j.area].join(" ").toLowerCase().includes(where.replace(/ city$/, "")))
      .filter((j) => !q || [j.title, j.category, j.employerName, j.description, (j.benefits || []).join(" ")].join(" ").toLowerCase().includes(q));
    const by = {
      new: (a, b) => (b.featured - a.featured) || (b.approvedAt || b.createdAt) - (a.approvedAt || a.createdAt),
      pay: (a, b) => monthlyEquivalent(b) - monthlyEquivalent(a),
      near: (a, b) => (distanceOf(a) ?? 1e9) - (distanceOf(b) ?? 1e9),
    };
    list.sort(by[filters.sort] || by.new);
    $("#count").textContent = `${list.length} job${list.length === 1 ? "" : "s"}${where ? ` in or near “${filters.where.trim()}”` : ""}`;
    const chips = [
      filters.q && ["q", `“${filters.q}”`], filters.where && ["where", filters.where], filters.category && ["category", filters.category],
      filters.type && ["type", filters.type], Number(filters.minPay) > PAY_MIN && ["minPay", `${payLabel(filters.minPay)}`],
    ].filter(Boolean);
    $("#active-filters").innerHTML = chips.length ? chips.map(([k, v]) => `<button class="fchip" data-clear="${k}">${esc(v)} <span aria-hidden="true">×</span></button>`).join("") + `<button class="linkbtn" data-clear="all">Clear all</button>` : "";
    const anyLive = (jobsCache || []).some(isLive);
    const { user: u, profile: pr } = getAuthState();
    $("#results").innerHTML = list.length ? list.map((j) => card(j, applied.has(j.id), distanceOf(j))).join("") : !anyLive ? `
      <div class="empty empty-hero">
        <div class="empty-art" aria-hidden="true">${ICON.home}</div>
        <h2>Be the first to post a job here</h2>
        <p class="muted">Job Search PH just opened in Negros Occidental. Hiring a kasambahay, yaya, driver or cook? Post it free and reach local jobseekers.</p>
        <p class="empty-actions">
          ${!u || pr?.role === "employer" ? `<a class="btn btn-primary" href="#/post" ${u ? "" : `data-action="gosignin" data-intent="employer" data-purpose="Sign in to post a job"`}>Post a job for free</a>` : ""}
          ${!u ? `<a class="btn btn-ghost" href="#/signin" data-action="gosignin" data-intent="jobseeker" data-purpose="Create your free profile">I'm looking for work</a>` : pr?.role === "jobseeker" ? `<a class="btn btn-ghost" href="#/profile">Complete my profile</a>` : ""}
        </p>
        ${pr?.role === "jobseeker" ? `<p class="small muted">New jobs are added every week. Your profile is ready, so you can apply as soon as one fits.</p>` : ""}
      </div>` : `
      <div class="empty empty-hero">
        <div class="empty-art" aria-hidden="true">${ICON.search}</div>
        <h2>No jobs match your search yet</h2>
        <p class="muted">Try a nearby town, a different job, or lower the pay filter. New jobs are posted every week.</p>
        <p class="empty-actions"><button class="btn btn-ghost" data-clear="all" id="empty-clear">Clear all filters</button></p>
      </div>`;
    $("#empty-clear")?.addEventListener("click", () => { Object.assign(filters, { q: "", where: "", category: "", type: "", minPay: "" }); viewList(); });
  };
  const sync = () => { const f = $("#search"); filters.q = f.q.value; filters.where = f.where.value; draw(); };
  const payIn = $("#f-pay");
  const paintPay = () => { const pct = ((payIn.value - PAY_MIN) / (PAY_MAX - PAY_MIN)) * 100; payIn.style.setProperty("--fill", `${pct}%`); $("#pay-out").textContent = payLabel(payIn.value); };
  payIn.addEventListener("input", () => { filters.minPay = Number(payIn.value) > PAY_MIN ? payIn.value : ""; paintPay(); draw(); });
  paintPay();
  // Suggestions under the two search boxes.
  const live = () => (jobsCache || []).filter(isLive);
  autocomplete($("#q"), $("#q-list"), (term) => {
    const t = term.trim().toLowerCase(); if (!t) return [];
    const counts = new Map();
    const add = (label, n, sub) => { const k = label.toLowerCase(); const cur = counts.get(k); counts.set(k, { label, n: (cur?.n || 0) + n, sub: sub || cur?.sub }); };
    live().forEach((j) => { add(j.title, 3); add(j.category.split(" / ")[0], 1, "Category"); });
    POPULAR_TITLES.forEach((x, i) => add(x, (POPULAR_TITLES.length - i) / 100));
    const starts = (s) => s.toLowerCase().split(/[\s/-]+/).some((w) => w.startsWith(t)) || s.toLowerCase().startsWith(t);
    return [...counts.values()].filter((x) => starts(x.label)).sort((a, b) => b.n - a.n).slice(0, 8)
      .map((x) => { const n = live().filter((j) => `${j.title} ${j.category}`.toLowerCase().includes(x.label.toLowerCase())).length; return { value: x.label, html: hl(x.label, t), meta: n ? `${n} open` : "" }; });
  }, (v) => { filters.q = v; draw(); });
  autocomplete($("#where"), $("#where-list"), (term) => {
    const t = term.trim().toLowerCase().replace(/ city$/, ""); if (!t) return [];
    const jobsIn = (pred) => live().filter(pred).length;
    const cityHits = CITIES.filter((c) => c !== "Other" && c.toLowerCase().startsWith(t) || c.toLowerCase().split(/[\s.-]+/).some((w) => w && w.startsWith(t) && c !== "Other"))
      .map((c) => ({ value: c, html: hl(c, t), meta: (() => { const n = jobsIn((j) => j.city === c); return n ? `${n} job${n === 1 ? "" : "s"}` : "City / town"; })(), n: jobsIn((j) => j.city === c) + 0.5 }));
    const areaSet = new Map();
    AREAS.forEach(([a, c]) => areaSet.set(`${a}|${c}`, [a, c]));
    live().forEach((j) => { if (j.area) areaSet.set(`${j.area}|${j.city}`, [j.area, j.city]); });
    const areaHits = [...areaSet.values()].filter(([a]) => a.toLowerCase().split(/[\s-]+/).some((w) => w.startsWith(t)) || a.toLowerCase().startsWith(t))
      .map(([a, c]) => ({ value: a, html: `${hl(a, t)} <span class="ac-sub">· ${esc(c)}</span>`, meta: (() => { const n = jobsIn((j) => (j.area || "").toLowerCase() === a.toLowerCase()); return n ? `${n} job${n === 1 ? "" : "s"}` : "Barangay"; })(), n: jobsIn((j) => (j.area || "").toLowerCase() === a.toLowerCase()) }));
    return [...cityHits, ...areaHits].sort((a, b) => Math.floor(b.n) - Math.floor(a.n)).slice(0, 8);
  }, (v) => { filters.where = v; draw(); });
  $("#search").addEventListener("submit", (e) => { e.preventDefault(); sync(); $("#results").scrollIntoView({ behavior: "smooth", block: "start" }); });
  $("#q").addEventListener("input", sync);
  $("#where").addEventListener("input", sync);
  app.querySelectorAll(".toolbar select").forEach((s) => s.addEventListener("change", () => {
    filters[s.name] = s.value;
    if (s.name === "sort" && s.value === "near" && !filters.near) locate(); else draw();
  }));
  app.querySelectorAll("[data-cat]").forEach((b) => b.addEventListener("click", () => {
    filters.category = b.dataset.cat;
    app.querySelectorAll("[data-cat]").forEach((x) => x.classList.toggle("on", x === b)); draw();
  }));
  $("#active-filters").addEventListener("click", (e) => {
    const k = e.target.closest("[data-clear]")?.dataset.clear; if (!k) return;
    if (k === "all") Object.assign(filters, { q: "", where: "", category: "", type: "", minPay: "" }); else filters[k] = "";
    viewList();
  });
  const locate = () => {
    const btn = $("#near"); const label = btn.querySelector("span");
    if (!navigator.geolocation) { toast("Location isn't available on this device. Type your city instead."); return; }
    label.textContent = "Finding you…";
    navigator.geolocation.getCurrentPosition((pos) => {
      const here = [pos.coords.latitude, pos.coords.longitude];
      let best = null, bestKm = Infinity;
      for (const [c, xy] of Object.entries(CITY_COORDS)) { const k = kmBetween(here, xy); if (k < bestKm) { bestKm = k; best = c; } }
      if (bestKm > 60) { label.textContent = "Use my location"; toast("You seem to be outside Negros Occidental. Type a city instead."); return; }
      filters.near = here; filters.nearCity = best; filters.sort = "near"; filters.where = best;
      const w = $("#where"); if (w) w.value = best;
      label.textContent = `Near ${best}`; $("#f-sort").value = "near"; draw();
    }, () => { label.textContent = "Use my location"; toast("Couldn't get your location. Type your city instead."); }, { timeout: 10000, maximumAge: 600000 });
  };
  $("#near").addEventListener("click", locate);

  try {
    const [jobs, apps] = await Promise.all([jobsCache ? jobsCache : store.listPublic(), getMyApps()]);
    jobsCache = jobs; applied = new Set(apps.map((a) => a.jobId));
    if (!$("#results")) return;
    draw();
    const live = jobsCache.filter(isLive);
    $("#stat-jobs").textContent = live.length;
    $("#stat-cities").textContent = new Set(live.map((j) => j.city)).size;
  } catch (err) { console.error(err); if ($("#results")) $("#results").innerHTML = `<p class="error">Could not load jobs. Please refresh.</p>`; }
}

function card(j, applied, km) {
  const perks = Array.isArray(j.benefits) ? j.benefits : [];
  return `
  <a class="card ${j.featured ? "card-featured" : ""}" href="#/job/${encodeURIComponent(j.id)}">
    <div class="card-top">
      <span class="cat-tag">${esc(j.category === "Other" && j.categoryOther ? j.categoryOther : j.category)}</span>
      ${j.featured ? `<span class="badge badge-featured">Featured</span>` : applied ? `<span class="badge badge-app-new">Applied</span>` : ""}
    </div>
    <h3>${esc(j.title)}</h3>
    <p class="employer">${esc(j.employerName)} ${verifiedBadge(j.ownerUid, { short: true })}${founderBadge(j.ownerUid, "employer", { short: true })}</p>
    <p class="loc">${ICON.pin}<span>${j.area ? `${esc(j.area)}, ` : ""}${esc(j.city)}${km != null ? ` · ${km < 1 ? "<1" : Math.round(km)} km` : ""}</span></p>
    <ul class="meta"><li>${esc(j.employmentType)}</li>${j.workplace === "household" && j.schedule ? `<li>${esc(j.schedule)}</li>` : ""}${perks.map((b) => `<li class="perk">${esc(b)}</li>`).join("")}</ul>
    <div class="card-foot"><span class="salary">${salaryText(j)}</span><span class="muted">${ago(j.approvedAt || j.createdAt)}</span></div>
  </a>`;
}

/* ---------------- Job detail + apply ---------------- */
async function viewJob(id) {
  app.innerHTML = SK.job();
  const here = location.hash;
  const j = await store.getJob(id);
  if (location.hash !== here) return;
  const { user, isAdmin } = getAuthState();
  const isOwner = !!(j && user && j.ownerUid === user.uid);
  if (!j || (!isLive(j) && !isOwner && !isAdmin)) {
    app.innerHTML = `<div class="empty"><h2>This job isn't available</h2><p class="muted">It may still be waiting for review, or it was filled or removed.</p><p><a class="btn btn-primary" href="#/">Browse other jobs</a></p></div>`;
    return;
  }
  document.title = `${j.title} — ${j.city} | Job Search PH`;
  app.innerHTML = `
    <p><a href="#/" class="back">← All jobs</a></p>
    <article class="job">
      <div class="job-main">
        ${!isLive(j) ? `<p class="notice">This post is not public. Status: ${statusBadge(j)}</p>` : ""}
        <h1>${esc(j.title)}</h1>
        <p class="employer">${esc(j.employerName)} ${verifiedBadge(j.ownerUid)}${founderBadge(j.ownerUid, "employer")}</p>
        <p class="loc">${ICON.pin}<span>${j.area ? `${esc(j.area)}, ` : ""}${esc(j.city)}</span></p>
        <ul class="meta"><li>${esc(j.employmentType)}</li>${j.workplace === "household" && j.schedule ? `<li>${esc(j.schedule)}</li>` : ""}<li>${esc(j.category === "Other" && j.categoryOther ? j.categoryOther : j.category)}</li><li>Posted ${ago(j.approvedAt || j.createdAt)}</li></ul>
        <div class="pay-box"><span class="salary salary-lg">${salaryText(j)}</span>${(() => { const m = j.workplace && j.salaryMin ? minimumPay(j.city, j.workplace, j.salaryPeriod) : null; return m && j.salaryMin >= m.amount ? `<span class="minok">${ICON.check}Meets the legal minimum wage</span>` : ""; })()}</div>
        <h2>About the job</h2><p>${nl2br(j.description)}</p>
        ${conditionsHtml(j)}
        ${requirementsHtml(j)}
      </div>
      <aside class="job-side">
        <div class="panel" id="apply-panel">${SK.panel()}</div>
        <div class="panel panel-warn">
          <strong>Never pay to get a job.</strong>
          <p>If the employer asks for a fee, deposit or your ID before an interview, stop and report the post.</p>
        </div>
        <details class="panel report">
          <summary>Report this post</summary>
          ${!user ? `<p class="small muted">Sign in to report a post. <a href="#/signin" data-action="gosignin" data-purpose="Sign in to report">Sign in</a></p>` : `<form id="report-form">
            <label for="r-reason">Reason</label><select id="r-reason" name="reason" required>${Object.entries(REPORT_REASONS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select>
            <label for="r-details">Details (optional)</label><textarea id="r-details" name="details" maxlength="500" rows="3"></textarea>
            <button class="btn btn-danger btn-sm" type="submit">Send report</button>
          </form>`}
        </details>
        <button class="btn btn-ghost btn-block" id="share">Share this job</button>
      </aside>
    </article>`;

  $("#share").addEventListener("click", async () => {
    // The static page has a proper Facebook/Messenger preview. New posts get one within ~2 hours;
    // until then, share the app link so the link never 404s.
    const staticUrl = `https://jobsearchph.com/jobs/${encodeURIComponent(j.id)}/?src=share`;
    let url = `https://jobsearchph.com/?src=share#/job/${encodeURIComponent(j.id)}`;
    try { const r = await fetch(`/jobs/${encodeURIComponent(j.id)}/`, { method: "HEAD", cache: "no-store" }); if (r.ok) url = staticUrl; } catch {}
    try {
      // Link only: with extra text, "Copy" in some share menus pastes the text into the link and breaks it.
      if (navigator.share) await navigator.share({ title: `${j.title} — ${j.city} | Job Search PH`, url });
      else { await navigator.clipboard.writeText(url); toast("Link copied"); }
    } catch {}
  });
  $("#report-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    try { await store.report(j.id, f.reason.value, f.details.value.trim().slice(0, 500)); f.closest("details").innerHTML = `<p>Thanks. We'll review this post.</p>`; }
    catch (err) { toast(err.code === "limit-reached" ? limitMsg.reports : "Could not send report. Try again."); }
  });
  renderApplyPanel(j, isOwner);
  if (j.addressHidden && (isOwner || getAuthState().isAdmin)) store.getContact(j.id).then((c) => {
    const el = app.querySelector("[data-private-address]"); if (!el || !c?.address) return;
    const q = encodeURIComponent([c.address, j.area, j.city, "Negros Occidental"].filter(Boolean).join(", "));
    el.innerHTML = `${esc(c.address)}${j.area ? `, ${esc(j.area)}` : ""}, ${esc(j.city)} · <a href="https://www.google.com/maps/search/?api=1&amp;query=${q}" target="_blank" rel="noopener">Open map</a> <span class="badge badge-closed">Private: only you${isOwner ? "" : " (admin)"} and admins see this</span>`;
  }).catch(() => {});
}

async function renderApplyPanel(j, isOwner) {
  const panel = $("#apply-panel"); if (!panel) return;
  const { user, profile, isAdmin } = getAuthState();

  if (isOwner || isAdmin) {
    const [apps, contact] = await Promise.all([isOwner ? store.applicationsForJob(j.id).catch(() => []) : [], store.getContact(j.id)]);
    const fresh = apps.filter((a) => a.status === "new").length;
    panel.innerHTML = `
      <h2>${isOwner ? "Your post" : "Admin view"}</h2>
      ${isOwner ? `<p class="muted">${apps.length} applicant${apps.length === 1 ? "" : "s"}${fresh ? ` · ${fresh} new` : ""}</p>
      <a class="btn btn-primary btn-block" href="#/applicants/${encodeURIComponent(j.id)}">View applicants</a>` : ""}
      ${contact ? `<p class="small muted">Contact shown to the person you hire: ${esc(contact.contactMethod)} · ${esc(contact.contactValue)}</p>` : ""}`;
    return;
  }
  if (!user) {
    panel.innerHTML = `
      <h2>Apply for this job</h2>
      <p class="muted">Sign in with a free profile to apply. You can message the employer here once you apply.</p>
      <a class="btn btn-primary btn-block" href="#/signin" data-action="gosignin" data-intent="jobseeker" data-purpose="Sign in to apply">Sign in to apply</a>`;
    return;
  }
  if (!profile) {
    returnTo = location.hash;
    panel.innerHTML = `<h2>Apply for this job</h2><p class="muted">Finish your profile first. It only takes a minute.</p><a class="btn btn-primary btn-block" href="#/profile">Finish my profile</a>`;
    return;
  }
  if (profile.role !== "jobseeker") {
    returnTo = location.hash;
    panel.innerHTML = `<h2>Apply for this job</h2><p class="muted">You're signed in as an employer. Switch your profile to "I'm looking for work" to apply.</p><a class="btn btn-ghost btn-block" href="#/profile">Change profile type</a>`;
    return;
  }
  myAppsCache = null; // always check the latest status before showing Apply
  const apps = await getMyApps();
  const mine = apps.find((a) => a.jobId === j.id);
  const employed = apps.find((a) => a.status === "hired" && !a.employmentEnded && isFullTime(a.jobSchedule, a.jobArrangement));
  if (mine) {
    const rawContact = mine.status === "hired" ? await store.getContact(j.id).catch(() => null) : null;
    const c = rawContact ? contactLink(rawContact) : null;
    panel.innerHTML = `
      <h2>${mine.status === "new" ? "Application sent" : mine.status === "offered" ? "You got a job offer!" : `You applied ${appBadge(mine.status)}`}</h2>
      ${mine.status === "offered" ? `<p>${esc(mine.employerName || "The employer")} wants to hire you. Accept to start, or decline if it's not right for you.</p><div class="actions offer-row">${offerHtml(mine)}</div>` : ""}
      <p class="muted">Sent ${ago(mine.createdAt)}. ${mine.status === "hired" ? "You're hired. Coordinate your start with the employer below." : "The employer can see your profile. Replies come through Messages here on Job Search PH."}</p>
      ${rawContact?.address ? `<p class="small"><strong>Work address</strong><br>${esc(rawContact.address)}${j.area ? `, ${esc(j.area)}` : ""}, ${esc(j.city)}</p>` : ""}
      ${c ? `<p class="small"><strong>Employer contact</strong></p>
        <a class="btn btn-primary btn-block" href="${esc(c.href)}" target="_blank" rel="noopener nofollow">${esc(c.label)}</a>
        ${c.extra ? `<a class="btn btn-ghost btn-block" href="${esc(c.extra)}">Send a text</a>` : ""}
        <p class="small muted copyable">${esc(c.text)}</p>` : ""}
      <a class="btn ${mine.status === "offered" ? "btn-ghost" : "btn-primary"} btn-block" href="#/chat/${encodeURIComponent(mine.id)}">${chatState(mine).open ? "Message the employer" : "View chat"}</a>
      ${mine.status === "new" || mine.status === "shortlisted" ? `<p class="withdraw-line"><button type="button" class="linkbtn small muted" id="withdraw">Withdraw application</button></p>` : ""}`;
    panel.querySelector(".offer-row")?.addEventListener("click", (e) => { const b = e.target.closest("[data-offer]"); if (b) handleOffer(b, mine, () => renderApplyPanel(j, false)); });
    $("#withdraw")?.addEventListener("click", async () => {
      if (!(await withdrawDialog(mine))) return;
      try {
        await store.notify(mine.employerUid, { type: "app_withdrawn", title: "An applicant withdrew", body: `${profile.fullName} withdrew their application for ${mine.jobTitle}.`, link: `#/applicants/${mine.jobId}`, appId: mine.id, jobId: mine.jobId }).catch(() => {});
        await store.withdraw(mine.id); myAppsCache = null; toast("Application withdrawn"); renderApplyPanel(j, false);
      } catch { toast("Could not withdraw. Try again."); }
    });
    return;
  }
  if (!isLive(j)) { panel.innerHTML = `<p class="muted">This job is not accepting applications.</p>`; return; }
  if (employed && isFullTime(j.schedule || j.employmentType, j.arrangement)) {
    panel.innerHTML = `
      <h2>You're employed full-time</h2>
      <p class="muted">You were hired for <a href="#/job/${encodeURIComponent(employed.jobId)}">${esc(employed.jobTitle)}</a>, so you can't apply to other full-time jobs right now. Part-time jobs are still open to you.</p>
      <p class="small muted">Did that job end? Update it in <a href="#/applications">My applications</a>.</p>`;
    return;
  }
  const usage = await store.usage().catch(() => ({ applies: 0 }));
  if ((usage.applies || 0) >= LIMITS.applies) {
    panel.innerHTML = `<h2>Daily limit reached</h2><p class="muted">${limitMsg.applies}</p><p class="small muted">The limit keeps the site fair for everyone and stops spam.</p>`;
    return;
  }
  const age = ageFrom(profile.birthDate);
  panel.innerHTML = `
    <h2>Apply for this job</h2>
    <p class="usage">${usage.applies || 0} of ${LIMITS.applies} applications used today</p>
    <p class="muted small">The employer will see your profile: <strong>${esc(profile.fullName)}</strong>${age ? `, ${age}` : ""}, ${esc(profile.city)}, ${esc(profile.phone)}, plus your experience${profile.resumeUrl || profile.resumeFileUrl ? " and resume" : ""}. <a href="#/profile">Edit profile</a></p>
    ${(() => { const st = profileStrength(profile); return st.score < 90 ? `<a class="s-nudge ${st.cls}" href="#/profile"><span><strong>${st.level} profile · ${st.score}/100.</strong> ${esc(st.todo[0]?.todo || "")} to get noticed.</span><em>Improve</em></a>` : ""; })()}
    <form id="apply-form">
      <label for="a-msg" class="small"><strong>Message to the employer</strong> (optional)</label>
      <textarea id="a-msg" name="message" rows="3" maxlength="1000" placeholder="e.g. I have 3 years experience as a yaya and can start next week."></textarea>
      <button class="btn btn-primary btn-block" type="submit">Apply now</button>
    </form>`;
  { const af = $("#apply-form"); const d = loadDraft(`apply:${j.id}`); if (d) applyDraft(af, d); autosave(`apply:${j.id}`, af); }
  $("#apply-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Sending…";
    try { await store.apply(j, e.target.message.value.trim()); clearDraft(`apply:${j.id}`); myAppsCache = null; toast("Application sent"); renderApplyPanel(j, false); }
    catch (err) {
      console.error(err); btn.disabled = false; btn.textContent = "Apply now";
      if (err.code === "limit-reached") { renderApplyPanel(j, false); return toast(limitMsg.applies); }
      toast(`Could not apply (${err.code || "error"}). Try again.`);
    }
  });
}

function isFullTime(schedule, arrangement) {
  return schedule === "Full-time" || arrangement === "Live-in" || schedule === "Live-in" || schedule === "Stay-out";
}

/* ---------------- Sign in ---------------- */
function viewSignIn() {
  document.title = "Sign in | Job Search PH";
  if (getAuthState().user) return finishAuthFlow();
  let mode = "signin";
  const draw = () => {
    app.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card">
          <h1>${mode === "signup" ? "Create your free account" : esc(signInPurpose || "Sign in")}</h1>
          <p class="muted">${mode === "signup" ? "For jobseekers and employers. It's free." : "Sign in to apply for jobs or manage your posts."}</p>
          ${IN_APP_BROWSER ? `<p class="notice small">You opened this inside Facebook or Messenger, which blocks Google sign-in. Use <strong>Continue with Facebook</strong> or email below, or tap ⋯ and choose <strong>Open in browser</strong>.</p>` : ""}
          <button class="btn btn-ghost btn-block btn-google" id="google" ${IN_APP_BROWSER ? "disabled" : ""}>
            <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Continue with Google
          </button>
          <button class="btn btn-ghost btn-block btn-google" id="facebook">
            ${FB_ICON.replace('width="16" height="16"', 'width="18" height="18"')}
            Continue with Facebook
          </button>
          <div class="divider"><span>or use email</span></div>
          <form id="email-form" class="auth-form" novalidate>
            ${mode === "signup" ? `<label for="s-name">Full name</label><input id="s-name" name="name" autocomplete="name" required maxlength="80">` : ""}
            <label for="s-email">Email</label><input id="s-email" name="email" type="email" autocomplete="email" required>
            <label for="s-pw">Password</label><input id="s-pw" name="pw" type="password" autocomplete="${mode === "signup" ? "new-password" : "current-password"}" required minlength="6">
            ${mode === "signup" ? `<p class="hint">At least 6 characters.</p>` : `<button type="button" class="linkbtn" id="forgot">Forgot password?</button>`}
            <p id="auth-error" class="error" hidden></p>
            <button class="btn btn-primary btn-block" type="submit">${mode === "signup" ? "Create account" : "Sign in"}</button>
          </form>
          <p class="switch">${mode === "signup" ? `Already have an account? <button class="linkbtn" id="toggle">Sign in</button>` : `New here? <button class="linkbtn" id="toggle">Create a free account</button>`}</p>
        </div>
      </div>`;
    const err = (m) => { const el = $("#auth-error"); el.textContent = m; el.hidden = !m; };
    $("#toggle").addEventListener("click", () => { mode = mode === "signup" ? "signin" : "signup"; draw(); });
    $("#google").addEventListener("click", async () => { try { await store.signInGoogle(); } catch (e) { err(authError(e)); } });
    $("#facebook").addEventListener("click", async () => { try { await store.signInFacebook({ redirect: IN_APP_BROWSER }); } catch (e) { err(authError(e)); } });
    store.redirectError().then((e) => { if (e) err(authError(e)); });
    $("#forgot")?.addEventListener("click", async () => {
      const email = $("#s-email").value.trim();
      if (!email) return err("Type your email above first, then tap Forgot password.");
      try { await store.resetPassword(email); err(""); toast("Password reset link sent. Check your email."); } catch (e) { err(authError(e)); }
    });
    $("#email-form").addEventListener("submit", async (e) => {
      e.preventDefault(); err("");
      const f = e.target; const btn = f.querySelector("button[type=submit]");
      const email = f.email.value.trim(), pw = f.pw.value;
      if (mode === "signup" && f.name.value.trim().length < 2) return err("Enter your full name.");
      if (!email) return err("Enter your email.");
      if (pw.length < 6) return err("Use a password with at least 6 characters.");
      btn.disabled = true;
      try {
        if (mode === "signup") { pendingName = f.name.value.trim(); await store.signUpEmail(email, pw, pendingName); }
        else await store.signInEmail(email, pw);
      } catch (ex) { err(authError(ex)); btn.disabled = false; }
    });
  };
  draw();
}

/* ---------------- Profile ---------------- */
function viewProfile() {
  document.title = "My profile | Job Search PH";
  const { user, profile } = getAuthState();
  if (!user) return goSignIn("Sign in to set up your profile");
  const p = { ...(profile || {}) };
  if (!p.fullName) p.fullName = pendingName || user.displayName || "";
  const isNew = !profile;
  let role = p.role || (isNew ? signupIntent : "") || "";
  if (isNew && !role) { try { const k = draftKey("role"); role = (k && localStorage.getItem(k)) || ""; } catch {} }
  const guided = isNew && !!signupIntent; // came from "Create a profile", "Apply" or "Post a job"

  const maxBirth = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d.toISOString().slice(0, 10); })();
  const chips = (name, list, selected = []) => `<div class="chips">${list.map((c) => `
    <label class="chip"><input type="checkbox" name="${name}" value="${esc(c)}" ${selected.includes(c) ? "checked" : ""}><span>${esc(c)}</span></label>`).join("")}</div>`;

  const formHtml = () => `
    <form id="profile-form" class="form" novalidate>
      <fieldset>
        <legend>About you</legend>
        <label>Full name *<input name="fullName" required minlength="2" maxlength="80" autocomplete="name" value="${esc(p.fullName)}"></label>
        <div class="row">
          <label>Mobile number *<input name="phone" required inputmode="tel" autocomplete="tel" placeholder="0917 123 4567" value="${esc(p.phone)}"></label>
          <label>City / municipality *<select name="city" required><option value="">Choose…</option>${opts(CITIES, p.city)}</select></label>
        </div>
        <div class="row">
          ${role === "jobseeker" ? `<label>Birthdate *<span class="date-age"><input name="birthDate" type="date" required max="${maxBirth}" value="${esc(p.birthDate)}"><output id="age-out" class="age-pill">${ageFrom(p.birthDate) != null ? `${ageFrom(p.birthDate)} years old` : "Age"}</output></span><span class="hint">You must be at least 18. Employers see your age, not your birthdate.</span></label>`
            : `<label>Household or business name<input name="companyName" maxlength="100" placeholder="e.g. Reyes Family or Inasal Express" value="${esc(p.companyName)}"></label>`}
          <label>Messenger (optional)<input name="messenger" maxlength="100" placeholder="Username or m.me link" value="${esc(p.messenger)}"></label>
        </div>
        ${role === "jobseeker" ? `<div><span class="label">Gender</span><div class="pills tight" role="radiogroup">${["Male", "Female", "Other"].map((g) => `<label class="pill"><input type="radio" name="gender" value="${g}" ${p.gender === g ? "checked" : ""}><span>${g}</span></label>`).join("")}</div></div>` : ""}
      </fieldset>
      ${role === "employer" ? `
      <fieldset>
        <legend>Help us confirm you're real</legend>
        <p class="hint vf-hint">${SHIELD}Only admins see these. Employers who add them get approved faster and can earn a <strong>Verified</strong> badge, which jobseekers trust more.</p>
        <label>Facebook profile or page link<input name="fbUrl" type="url" inputmode="url" maxlength="200" placeholder="https://facebook.com/yourname" value="${esc(p.fbUrl || "")}"></label>
        <label>Business permit or DTI number (businesses only, optional)<input name="bizReg" maxlength="60" placeholder="e.g. DTI 1234567" value="${esc(p.bizReg || "")}"></label>
      </fieldset>` : ""}
      ${role === "jobseeker" ? `
      <fieldset>
        <legend>Work you're looking for</legend>
        <div><span class="label">Jobs you want (up to 5)</span>${chips("jobCategories", CATEGORIES, p.jobCategories)}
          <label id="jc-other" ${(p.jobCategories || []).includes("Other") ? "" : "hidden"}>What other job are you looking for?<input name="jobCategoryOther" maxlength="40" placeholder="e.g. Tutor, Massage therapist, Farm worker" value="${esc(p.jobCategoryOther || "")}"><span class="hint">This helps us add new job types.</span></label></div>
        <div><span class="label">Arrangement</span>${chips("jobTypes", TYPES, p.jobTypes)}</div>
        <div class="row">
          <label>Years of experience<input name="experienceYears" type="number" min="0" max="60" inputmode="numeric" value="${esc(p.experienceYears ?? "")}"></label>
          <label>Availability<select name="availability"><option value="">Choose…</option>${opts(AVAILABILITY, p.availability)}</select></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Job alerts by email</legend>
        <label class="check"><input type="checkbox" name="alerts" ${p.alerts ? "checked" : ""}>
          <span>Email me when new jobs match the jobs I picked above</span></label>
        <label id="alerts-scope" ${p.alerts ? "" : "hidden"}>Where<select name="alertsScope">
          <option value="city" ${p.alertsScope !== "all" ? "selected" : ""}>Only in my city / municipality</option>
          <option value="all" ${p.alertsScope === "all" ? "selected" : ""}>Anywhere in Negros Occidental</option></select>
          <span class="hint">At most one email a day${user.email ? `, sent to <strong>${esc(user.email)}</strong>` : ""}. Every email has an unsubscribe link.</span></label>
      </fieldset>
      <fieldset>
        <legend>Experience &amp; resume</legend>
        <label>Skills<textarea name="skills" rows="2" maxlength="1000" placeholder="e.g. cooking Filipino dishes, ironing, caring for toddlers, basic first aid">${esc(p.skills)}</textarea></label>
        <label>Work history<textarea name="workHistory" rows="4" maxlength="3000" placeholder="One job per line, e.g.&#10;2022–2024 · Kasambahay · Santos family, Bacolod&#10;2020–2022 · Kitchen helper · Inasal stall, Silay">${esc(p.workHistory)}</textarea></label>
        <div class="row">
          <label>Highest education<select name="eduLevel"><option value="">Choose…</option>${opts(EDUCATION_LEVELS, splitEdu(p.education)[0])}</select></label>
          <label>School (optional)<input name="eduSchool" maxlength="200" placeholder="e.g. Bacolod City National High School" value="${esc(splitEdu(p.education)[1])}"></label>
        </div>
        <label>Resume link (optional)<input name="resumeUrl" type="url" maxlength="500" placeholder="https://drive.google.com/…" value="${esc(p.resumeUrl)}"><span class="hint">A Google Drive or other link. Set sharing to "Anyone with the link".</span></label>
        ${uploadsEnabled ? `<label>Upload resume (optional)<input name="resumeFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"><span class="hint">PDF or photo, up to 5 MB.${p.resumeFileName ? ` Current file: <a href="${esc(p.resumeFileUrl)}" target="_blank" rel="noopener">${esc(p.resumeFileName)}</a>` : ""}</span></label>` : ""}
      </fieldset>` : ""}
      ${!isNew ? (() => { const fbOn = store.providers().includes("facebook.com"); return `
      <fieldset>
        <legend>Sign-in methods</legend>
        <div class="fb-link"><span>${FB_ICON} Facebook: <strong>${fbOn ? "Connected" : "Not connected"}</strong></span>
          <button type="button" class="btn btn-ghost btn-sm" id="fb-link" data-on="${fbOn ? 1 : 0}">${fbOn ? "Remove" : "Connect Facebook"}</button></div>
        <span class="hint">${fbOn ? "You can sign in with Facebook or your other method." : "Sign in faster with Facebook next time. We never post anything to your Facebook."}</span>
      </fieldset>`; })() : ""}
      <label class="check"><input type="checkbox" name="consent" ${profile?.consent ? "checked" : ""}>
        <span>${role === "jobseeker" ? "I agree that my profile is shared with employers when I apply to their jobs." : "I agree to only post real jobs and to use applicants' details only for hiring."} I accept the <a href="#/terms" target="_blank">Terms</a> and <a href="#/privacy" target="_blank">Privacy notice</a>.</span></label>
      <p id="form-error" class="error" hidden></p>
      <div class="form-actions">
        <button class="btn btn-primary" type="submit">${isNew ? "Save and continue" : "Save changes"}</button>
        ${!isNew ? `<button class="btn btn-danger btn-sm" type="button" id="del-profile">Delete my profile</button>` : ""}
      </div>
    </form>`;

  const collect = () => {
    const f = $("#profile-form"); if (!f) return;
    ["fullName", "phone", "city", "messenger", "birthDate", "companyName", "fbUrl", "bizReg", "experienceYears", "availability", "skills", "workHistory", "resumeUrl"]
      .forEach((k) => { if (f[k]) p[k] = f[k].value; });
    if (f.eduLevel) p.education = [f.eduLevel.value, f.eduSchool.value.trim()].filter(Boolean).join(" · ");
    const g = f.querySelector("[name=gender]:checked"); if (f.querySelector("[name=gender]")) p.gender = g ? g.value : "";
    ["jobCategories", "jobTypes"].forEach((k) => { if (f.querySelector(`[name=${k}]`)) p[k] = [...f.querySelectorAll(`[name=${k}]:checked`)].map((i) => i.value); });
    if (f.jobCategoryOther) p.jobCategoryOther = (p.jobCategories || []).includes("Other") ? f.jobCategoryOther.value.trim().replace(/\s+/g, " ").replace(/^./, (c) => c.toUpperCase()) : "";
    if (f.alerts) { p.alerts = f.alerts.checked; p.alertsScope = f.alertsScope.value === "all" ? "all" : "city"; }
  };

  const bindForm = () => {
    const f = $("#profile-form");
    f.querySelectorAll("[name=jobCategories]").forEach((cb) => cb.addEventListener("change", () => {
      if (f.querySelectorAll("[name=jobCategories]:checked").length > 5) { cb.checked = false; toast("Pick up to 5 jobs"); }
      const jo = $("#jc-other"); if (jo) { jo.hidden = !f.querySelector('[name=jobCategories][value="Other"]:checked'); if (!jo.hidden && cb.value === "Other" && cb.checked) f.jobCategoryOther.focus(); }
    }));
    f.alerts?.addEventListener("change", () => { $("#alerts-scope").hidden = !f.alerts.checked; });
    f.addEventListener("input", (e) => e.target.classList?.remove("invalid"));
    const pd = loadDraft(`profile:${role}`);
    if (pd) {
      applyDraft(f, pd); f.insertAdjacentHTML("afterbegin", draftNote());
      f.querySelector("[data-draft-clear]").addEventListener("click", () => { clearDraft(`profile:${role}`); location.reload(); });
      const a = ageFrom(f.birthDate?.value); if (f.birthDate && a != null) $("#age-out").textContent = `${a} years old`;
    }
    autosave(`profile:${role}`, f);
    const paintStrength = () => { const box = $("#strength"); if (!box) return; collect(); box.outerHTML = strengthCard(p); };
    if (pd && role === "jobseeker") setTimeout(paintStrength);
    if (role === "jobseeker") { f.addEventListener("input", paintStrength); f.addEventListener("change", paintStrength); }
    $(".profile-wrap").addEventListener("click", (e) => {
      const b = e.target.closest("[data-goto]"); if (!b) return;
      const k = b.dataset.goto;
      if (k === "photo") { $(".photo-pick").scrollIntoView({ behavior: "smooth", block: "center" }); return $("#photo-in").click(); }
      const el = f.querySelector(`[name=${k === "education" ? "eduLevel" : k}]`); if (!el) return;
      const box = el.closest("label, div") || el;
      box.scrollIntoView({ behavior: "smooth", block: "center" }); box.classList.add("flash"); setTimeout(() => box.classList.remove("flash"), 1600);
      setTimeout(() => el.focus({ preventScroll: true }), 350);
    });
    f.birthDate?.addEventListener("input", () => {
      const a = ageFrom(f.birthDate.value); const out = $("#age-out");
      out.textContent = a == null ? "Age" : `${a} years old`; out.classList.toggle("bad", a != null && a < 18);
    });
    $("#fb-link")?.addEventListener("click", async (e) => {
      const b = e.currentTarget; const on = b.dataset.on === "1";
      if (on && !confirmInline(b, "Click again to remove")) return;
      b.disabled = true;
      try { if (on) await store.unlinkFacebook(); else await store.linkFacebook(); toast(on ? "Facebook removed" : "Facebook connected"); viewProfile(); }
      catch (ex) { b.disabled = false; toast(authError(ex)); }
    });
    $("#del-profile")?.addEventListener("click", async (e) => {
      if (!confirmInline(e.target, "Click again to delete")) return;
      try { await store.deleteProfile(); myAppsCache = null; toast("Profile deleted"); await store.signOut(); location.hash = "#/"; }
      catch { toast("Could not delete profile"); }
    });
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = $("#form-error");
      const fail = (m, el) => { errEl.textContent = m; errEl.hidden = false; if (el) { el.classList.add("invalid"); el.focus({ preventScroll: true }); } errEl.scrollIntoView({ block: "center", behavior: "smooth" }); };
      errEl.hidden = true;
      collect();
      const fullName = (p.fullName || "").trim(), phone = (p.phone || "").trim();
      if (fullName.length < 2) return fail("Enter your full name.", f.fullName);
      const ph = digits(phone).replace(/^\+/, "");
      if (ph.length < 10 || ph.length > 13) return fail("Enter a complete mobile number, e.g. 0917 123 4567.", f.phone);
      if (!p.city) return fail("Choose your city or municipality.", f.city);
      if (p.messenger && !messengerUrl(p.messenger)) return fail("That Messenger username or link doesn't look right.", f.messenger);
      const data = { role, fullName, phone, city: p.city, messenger: (p.messenger || "").trim(), photo: p.photo || "" };
      if (role === "jobseeker") {
        const age = ageFrom(p.birthDate);
        if (!p.birthDate || age === null) return fail("Enter your birthdate.", f.birthDate);
        if (age < 18) return fail("You must be at least 18 years old to apply for jobs here.", f.birthDate);
        if (age > 90) return fail("Check your birthdate.", f.birthDate);
        if (p.resumeUrl && !safeUrl(p.resumeUrl.trim())) return fail("The resume link should start with https://", f.resumeUrl);
        const exp = p.experienceYears === "" || p.experienceYears == null ? null : Number(p.experienceYears);
        Object.assign(data, {
          birthDate: p.birthDate, gender: p.gender || "", jobCategories: p.jobCategories || [], jobTypes: p.jobTypes || [],
          ...(p.jobCategoryOther ? { jobCategoryOther: p.jobCategoryOther } : {}),
          experienceYears: Number.isFinite(exp) && exp >= 0 ? Math.min(exp, 60) : null,
          skills: (p.skills || "").trim(), workHistory: (p.workHistory || "").trim(), education: (p.education || "").trim(),
          availability: p.availability || "", resumeUrl: (p.resumeUrl || "").trim(),
        });
        if (p.alerts && !(p.jobCategories || []).length) return fail("Pick at least one job above so we know which alerts to send.", f.alerts);
        if (p.alerts && !user.email) return fail("Your account has no email address, so we can't send job alerts.", f.alerts);
        // A fresh unsubscribe token each time alerts are switched on, so an old unsubscribe click can't turn them off again.
        Object.assign(data, { alerts: !!p.alerts, alertsScope: p.alertsScope || "city", alertsToken: p.alerts && !profile?.alerts ? alertToken() : (p.alertsToken || profile?.alertsToken || alertToken()) });
      } else {
        data.alerts = false; // employers don't get job alerts (also turns them off when switching from jobseeker)
        data.companyName = (p.companyName || "").trim();
        let fb = (p.fbUrl || "").trim();
        if (fb && !/^https?:\/\//i.test(fb)) fb = `https://${fb}`;
        if (fb && !fbHref(fb)) return fail("The Facebook link should look like https://facebook.com/yourname", f.fbUrl);
        data.fbUrl = fb; data.bizReg = (p.bizReg || "").trim();
      }
      if (!f.consent.checked) return fail("Tick the box to agree before saving.", f.consent);
      const btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Saving…";
      try {
        const file = f.resumeFile?.files?.[0];
        if (file) {
          if (file.size > 5 * 1024 * 1024) throw Object.assign(new Error("too-big"), { friendly: "The resume file is over 5 MB." });
          btn.textContent = "Uploading resume…";
          const up = await store.uploadResume(file);
          data.resumeFileUrl = up.url; data.resumeFileName = up.name;
        }
        await store.saveProfile(data);
        clearDraft(`profile:${role}`); clearDraft("role");
        if (isNew) {
          const no = await store.claimFounder();
          if (no) {
            FOUNDERS = await store.founders();
            await showDialog({ title: `You're a founding ${role === "employer" ? "employer" : "jobseeker"}!`, body: `${STAR.replace("<svg", '<svg class="dlg-star"')}You're one of the first 100 people on Job Search PH. Your Founding ${role === "employer" ? "employer" : "jobseeker"} badge shows on your profile${role === "employer" ? " and on your job posts" : " and to employers when you apply"}. Thank you for being here early.`, actions: [{ label: "Let's go", value: true, primary: true }] });
          }
        }
        myAppsCache = null; pendingName = ""; signupIntent = "";
        toast("Profile saved");
        if (isNew || returnTo) finishAuthFlow(); else viewProfile();
      } catch (ex) {
        console.error(ex); btn.disabled = false; btn.textContent = isNew ? "Save and continue" : "Save changes";
        fail(ex.friendly || `Could not save your profile (${ex.code || ex.message}). Try again.`);
      }
    });
  };

  const ICONS = {
    jobseeker: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2.5" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 7V5.8A1.8 1.8 0 0 1 10.3 4h3.4a1.8 1.8 0 0 1 1.8 1.8V7" stroke="currentColor" stroke-width="1.7"/><path d="M3 12.5h18" stroke="currentColor" stroke-width="1.7"/><path d="M11 12.5v1.6h2v-1.6" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
    employer: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12.2" r="2.2" stroke="currentColor" stroke-width="1.7"/><path d="M8.3 18.2a3.9 3.9 0 0 1 7.4 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  };
  const ROLES = {
    jobseeker: { title: "I'm looking for work", sub: "For kasambahay, yaya, drivers, cooks and other workers", points: ["Apply to any job in one tap", "Message employers right here", "Track replies in My applications"] },
    employer: { title: "I'm hiring", sub: "For households and local businesses", points: ["Post jobs for free", "Get applicants with their full profile", "Call, text or message them directly"] },
  };
  const roleCard = (k) => `
    <button type="button" class="role ${role === k ? "on" : ""}" data-role="${k}" role="radio" aria-checked="${role === k}">
      <span class="role-top"><span class="role-icon">${ICONS[k]}</span><span class="role-check" aria-hidden="true"></span></span>
      <strong>${ROLES[k].title}</strong>
      <span class="role-sub">${ROLES[k].sub}</span>
      ${isNew ? `<ul>${ROLES[k].points.map((t) => `<li>${t}</li>`).join("")}</ul>` : ""}
    </button>`;

  const draw = () => {
    if (isNew && role) { try { const k = draftKey("role"); if (k) localStorage.setItem(k, role); } catch {} }
    const name = p.fullName || user.displayName || "";
    const step = !role ? 1 : 2;
    app.innerHTML = `
      <div class="profile-wrap">
        <header class="profile-head">
          <div class="photo-col"><label class="photo-pick" title="Change photo">${avatar(name || user.email, p.photo, "lg")}<span class="photo-edit">${p.photo ? "Change" : "Add photo"}</span><input type="file" id="photo-in" accept="image/*" hidden></label>${p.photo ? `<button type="button" class="linkbtn small" id="photo-remove">Remove</button>` : ""}</div>
          <div>
            ${isNew ? `<p class="kicker">${guided ? "Create your profile" : `Step ${step} of 2`}</p>` : `<p class="kicker">${role === "employer" ? "Employer" : "Jobseeker"} profile</p>`}${!isNew ? founderBadge(user.uid, role) : ""}
            <h1>${isNew ? `Welcome${name ? `, ${esc(firstName(name))}` : ""}` : "My profile"}</h1>
            <p class="muted">${isNew ? (role ? "Fill in your details. Fields marked * are required." : "How will you use Job Search PH? You can change this later.") : `Signed in as ${esc(user.email || user.displayName || "")}`}</p>
          </div>
        </header>
        ${isNew && !guided ? `<ol class="steps" aria-label="Progress"><li class="${step >= 1 ? "done" : ""} ${step === 1 ? "current" : ""}">Choose type</li><li class="${step === 2 ? "current" : ""}">Your details</li></ol>` : ""}
        ${guided ? `<div class="role-switch"><span class="role-now">${ICONS[role]}<span>${role === "employer" ? "Employer profile: post jobs and review applicants" : "Jobseeker profile: apply to jobs with one profile"}</span></span>
            <button type="button" class="linkbtn" data-role="${role === "employer" ? "jobseeker" : "employer"}">${role === "employer" ? "Looking for work instead?" : "Hiring instead?"}</button></div>`
          : `${!isNew ? `<p class="label">Profile type</p>` : ""}
        <div class="role-pick ${isNew ? "" : "compact"}" role="radiogroup" aria-label="Profile type">${roleCard("jobseeker")}${roleCard("employer")}</div>`}
        ${role === "jobseeker" ? strengthCard(p) : ""}
        ${role ? formHtml() : `<div class="trust"><span>Free to use</span><span>No fees for jobseekers, ever</span><span>Your details are shared only when you apply</span></div>`}
      </div>`;
    app.querySelectorAll("[data-role]").forEach((b) => b.addEventListener("click", async () => {
      const target = b.dataset.role;
      if (target === role) return;
      if (!isNew && profile?.role && target !== profile.role) {
        const to = target === "employer" ? "an employer (I'm hiring)" : "a jobseeker (I'm looking for work)";
        const step1 = await showDialog({
          title: "Switch profile type?",
          body: `You're about to change your profile to ${to}. ${target === "employer" ? "You won't be able to apply to jobs while you're an employer." : "You won't be able to post jobs or see your applicants while you're a jobseeker."}`,
          actions: [{ label: "Keep my profile", value: false }, { label: "Continue", value: true, primary: true }],
        });
        if (!step1) return;
        const step2 = await showDialog({
          title: "Are you sure?",
          body: `Your ${profile.role === "employer" ? "job posts and applicants" : "applications"} stay saved, but you'll only see them again after you switch back. Tap Switch, then Save changes to finish.`,
          actions: [{ label: "Cancel", value: false }, { label: target === "employer" ? "Switch to employer" : "Switch to jobseeker", value: true, primary: true }],
        });
        if (!step2) return;
      }
      const first = !role; collect(); role = target; draw();
      if (first) $("#profile-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    if (role) bindForm();
    $("#photo-in")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      e.target.value = "";
      try {
        const cropped = await cropPhoto(file);
        if (!cropped) return;
        collect(); p.photo = cropped; draw();
        toast(isNew ? "Photo added" : "Photo updated. Tap Save changes to keep it.");
      } catch (err) { toast(err.message); }
    });
    $("#photo-remove")?.addEventListener("click", () => { collect(); p.photo = ""; draw(); });
  };
  draw();
}

/* ---------------- Post a job ---------------- */
const REQ_EXPERIENCE = [[0, "No experience needed"], [1, "1+ year"], [2, "2+ years"], [3, "3+ years"], [5, "5+ years"]];
const REQ_EDUCATION = ["Any", "Elementary", "High school", "Senior high school", "Vocational / TESDA", "College"];
const REQ_SKILLS = {
  household: ["Can cook", "Laundry & ironing", "Childcare experience", "Elderly care experience", "Professional driver's license", "Pet care", "Gardening"],
  business: ["Customer service", "Cash handling", "Food handling", "Professional driver's license", "Own motorcycle", "Computer skills", "Heavy lifting"],
  common: ["Non-smoker", "With references", "NBI or barangay clearance", "Medical certificate", "Can start immediately", "Speaks Hiligaynon", "Speaks English"],
};
// Requirement chips that only make sense for some categories.
const REQ_ONLY_FOR = { "Professional driver's license": ["Driver", "Delivery / Rider", "Other"], "Own motorcycle": ["Delivery / Rider", "Other"] };
const reqFits = (skill, cat) => !REQ_ONLY_FOR[skill] || !cat || REQ_ONLY_FOR[skill].includes(cat);
// Suggested job titles, filled in when the title box is still empty.
const TITLE_FOR = {
  "Kasambahay / Househelper": "Kasambahay", "Yaya / Nanny": "Yaya", "Caregiver": "Caregiver", "Cook": "Cook", "Driver": "Family driver",
  "Laundry": "Laundry helper", "Gardener / Maintenance": "Gardener", "Food service": "Food service crew", "Sales / Retail": "Sales staff",
  "Delivery / Rider": "Delivery rider", "Construction / Skilled trade": "Construction worker", "Security": "Security guard", "Office / Admin": "Office staff",
};
const SCHEDULES = { household: ["Full-time", "Part-time"], business: ["Full-time", "Part-time", "Project-based", "Shifts"] };
const RECOMMENDED = ["SSS", "PhilHealth", "Pag-IBIG", "13th month pay"];

function viewPost() {
  document.title = "Post a job | Job Search PH";
  const { user, profile } = getAuthState();
  if (!user) {
    app.innerHTML = `<div class="empty"><h1>Post a job for free</h1><p class="muted">Create a free employer account to post jobs and review applicants in one place.</p><p><a class="btn btn-primary" href="#/signin" data-action="gosignin" data-intent="employer" data-purpose="Sign in to post a job">Sign in to post a job</a></p></div>`;
    return;
  }
  if (!profile) { returnTo = "#/post"; location.hash = "#/profile"; return; }
  if (profile.role !== "employer") {
    returnTo = "#/post";
    app.innerHTML = `<div class="empty"><h1>Hiring?</h1><p class="muted">Your profile is set to "I'm looking for work". Switch it to "I'm hiring" to post jobs.</p><p><a class="btn btn-primary" href="#/profile">Change profile type</a></p></div>`;
    return;
  }
  const cityList = CITIES.filter((c) => c !== "Other");
  const radioPills = (name, list, sel, cls = "") => `<div class="pills ${cls}" role="radiogroup">${list.map(([v, l]) => `<label class="pill"><input type="radio" name="${name}" value="${esc(v)}" ${String(sel) === String(v) ? "checked" : ""}><span>${esc(l)}</span></label>`).join("")}</div>`;
  const stepper = (name, val, min, max) => `<div class="stepper"><button type="button" data-step="-1" data-for="${name}" aria-label="Less">−</button><input name="${name}" type="number" inputmode="numeric" min="${min}" max="${max}" value="${val}"><button type="button" data-step="1" data-for="${name}" aria-label="More">+</button></div>`;

  app.innerHTML = `
    <div class="page-head"><div><p class="kicker">New job post</p><h1>Post a job</h1><p class="muted">Free to post. Reviewed within a day, then live for 30 days.</p><p class="usage" id="post-usage"></p></div></div>
    <div class="post-layout">
      <form id="post-form" class="form post-form" novalidate>
        <section class="pcard">
          <header><span class="num">1</span><div><h2>Who's hiring?</h2><p>This sets the right pay rules and job options.</p></div></header>
          <div class="seg" role="radiogroup">
            <label><input type="radio" name="workplace" value="household" required><span>${ICON.home}<strong>Private household</strong><small>Kasambahay, yaya, family driver, cook…</small></span></label>
            <label><input type="radio" name="workplace" value="business"><span>${ICON.people}<strong>Business</strong><small>Store, restaurant, office, site…</small></span></label>
          </div>
          <label class="fld">Employer or household name *<input name="employerName" required maxlength="80" placeholder="e.g. Reyes Family" value="${esc(profile.companyName || "")}"></label>
        </section>

        <section class="pcard" data-needs-workplace>
          <header><span class="num">2</span><div><h2>The job</h2></div></header>
          <label class="fld">Job title *<input name="title" required minlength="3" maxlength="100" placeholder="e.g. Live-in Kasambahay"></label>
          <div class="fld"><span class="label">Category *</span><div id="cat-pills" class="pills wrap-pills" role="radiogroup"></div>
            <label class="fld" id="cat-other" hidden>What kind of job is it? *<input name="categoryOther" maxlength="40" placeholder="e.g. Tutor, Massage therapist, Farm worker"><span class="hint">This helps us add new categories later.</span></label></div>
          <div class="fld" id="arr-field"><span class="label">Live-in or stay-out? *</span>${radioPills("arrangement", [["Live-in", "Live-in"], ["Stay-out", "Stay-out"]], "")}</div>
          <div class="fld"><span class="label">Schedule *</span><div id="sched-pills"></div></div>
        </section>

        <section class="pcard">
          <header><span class="num">3</span><div><h2>Location</h2></div></header>
          <div class="row">
            <div class="fld"><label for="p-city">City or municipality *</label><div class="field ac boxed"><span class="ico">${ICON.pin}</span>
              <input id="p-city" name="city" required autocomplete="off" role="combobox" aria-expanded="false" aria-controls="p-city-list" aria-autocomplete="list" placeholder="Type a city or town" value="${esc(cityList.includes(profile.city) ? profile.city : "")}">
              <ul class="ac-list" id="p-city-list" role="listbox" hidden></ul></div></div>
            <div class="fld"><label for="p-area">Barangay or area</label><div class="field ac boxed"><span class="ico">${ICON.pin}</span>
              <input id="p-area" name="area" maxlength="80" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="p-area-list" aria-autocomplete="list" placeholder="e.g. Mandalagan">
              <ul class="ac-list" id="p-area-list" role="listbox" hidden></ul></div></div>
          </div>
          <div class="fld" id="addr-field" hidden>
            <label class="fld">Full business address *<input name="address" maxlength="200" placeholder="e.g. Unit 5, 2F Ayala Malls Capitol Central, Gatuslao St."><span class="hint">Building, unit or floor, and street.</span></label>
            <label class="check small addr-private"><input type="checkbox" name="hideAddress"><span><strong>Keep the full address private.</strong> Jobseekers only see the barangay and city. Job Search PH admins can still see it, and it's shared with the person you hire.</span></label>
          </div>
          <p class="hint" id="loc-hint">The area helps jobseekers search nearby. Don't include house numbers.</p>
        </section>

        <section class="pcard">
          <header><span class="num">4</span><div><h2>Pay</h2></div></header>
          <div class="pay-row">
            <label class="fld money"><span id="pay-from-label">From *</span><span class="peso">₱</span><input name="salaryMin" type="number" min="1" step="1" required inputmode="numeric" placeholder="6,500"></label>
            <label class="fld money" id="pay-to"><span>To</span><span class="peso">₱</span><input name="salaryMax" type="number" min="1" step="1" inputmode="numeric" placeholder="Optional"></label>
            <div class="fld"><span class="label">Per</span>${radioPills("salaryPeriod", [["month", "Month"], ["day", "Day"], ["hour", "Hour"]], "month", "tight")}</div>
          </div>
          <div id="wage-box" class="wage-box" aria-live="polite"></div>
        </section>

        <section class="pcard">
          <header><span class="num">5</span><div><h2>Work conditions</h2></div></header>
          <div class="fld hours-fld"><span class="label">Working hours</span>
            <div class="wh">
              <div class="wh-part"><span class="wh-cap">Starts</span><div class="wh-step"><button type="button" data-wh="hStart" data-d="-1" aria-label="Earlier">−</button><output id="wh-start">8:00 AM</output><button type="button" data-wh="hStart" data-d="1" aria-label="Later">+</button></div></div>
              <div class="wh-part"><span class="wh-cap">Hours a day</span><div class="wh-step"><button type="button" data-wh="hLen" data-d="-1" aria-label="Fewer hours">−</button><output id="wh-len">8</output><button type="button" data-wh="hLen" data-d="1" aria-label="More hours">+</button></div></div>
              <div class="wh-sum" aria-live="polite"><strong id="wh-range"></strong><span id="wh-tag" class="h-tag ok"></span></div>
            </div>
            <input type="hidden" name="hStart" value="8"><input type="hidden" name="hLen" value="8"><input type="hidden" name="hours">
          </div>
          <div class="row row-3">
            <div class="fld"><span class="label">Days off per month</span>${stepper("daysOff", 4, 2, 15)}</div>
            <div class="fld"><span class="label">Openings (max 3)</span>${stepper("openings", 1, 1, 3)}</div>
            <label class="fld">Start date (optional)<input name="startDate" type="date"></label>
          </div>
          <div class="fld"><span class="label">Benefits</span>
            <div class="chips">${BENEFITS.map((b) => `<label class="chip ${RECOMMENDED.includes(b) ? "rec" : ""}"><input type="checkbox" name="benefits" value="${esc(b)}"><span>${esc(b)}${RECOMMENDED.includes(b) ? `<em>Recommended</em>` : ""}</span></label>`).join("")}</div>
            <p class="hint" id="ben-hint">Posts with SSS, PhilHealth, Pag-IBIG and 13th month pay get more applicants.</p>
          </div>
        </section>

        <section class="pcard">
          <header><span class="num">6</span><div><h2>Requirements</h2><p>Pick what matters. Everything here is optional.</p></div></header>
          <div class="fld"><span class="label">Experience</span>${radioPills("reqExperience", REQ_EXPERIENCE, 0)}</div>
          <div class="fld"><span class="label">Education</span>${radioPills("reqEducation", REQ_EDUCATION.map((e) => [e, e]), "Any")}</div>
          <div class="fld"><span class="label">Skills &amp; documents</span><div id="req-chips" class="chips"></div></div>
          <label class="fld">Other requirements<textarea name="requirements" maxlength="2000" rows="3" placeholder="Anything else, one per line"></textarea></label>
        </section>

        <section class="pcard">
          <header><span class="num">7</span><div><h2>Description</h2></div></header>
          <label class="fld">About the job *<textarea name="description" required minlength="30" maxlength="4000" rows="6" placeholder="Duties, household size, what a normal day looks like…"></textarea></label>
        </section>

        <section class="pcard">
          <header><span class="num">8</span><div><h2>Your contact for the person you hire</h2><p>Applicants talk to you through Messages here. This contact is only shown to the person who accepts your job offer.</p></div></header>
          ${radioPills("contactMethod", [["messenger", "Messenger"], ["phone", "Phone / SMS"], ["email", "Email"]], profile.messenger ? "messenger" : "phone", "tight")}
          <label class="fld"><span class="sr">Contact</span><input name="contactValue" required maxlength="200" value="${esc(profile.messenger || profile.phone || "")}"></label>
        </section>

        <section class="pcard agree-box">
          <p class="label">Before you post, confirm that you will:</p>
          <label class="check"><input type="checkbox" name="agreeWage" required><span>Pay at least the legal minimum wage</span></label>
          <label class="check"><input type="checkbox" name="agreeFee" required><span>Never charge applicants any fee, deposit or deduction</span></label>
          <label class="check"><input type="checkbox" name="agreeAge" required><span>Only hire workers aged 18 or older</span></label>
          <label class="check"><input type="checkbox" name="agreeTerms" required><span>Follow Philippine labor law, including the Kasambahay Law, and the <a href="#/terms" target="_blank">Terms</a></span></label>
        </section>
        <p id="form-error" class="error" hidden></p>
        <button class="btn btn-primary btn-lg" type="submit">Submit for review</button>
      </form>
      <aside class="post-side">
        <p class="label">Preview</p>
        <div id="preview"></div>
        <div class="panel tips-panel"><strong>Posts that get more applicants</strong>
          <ul><li>Show the full pay range</li><li>Include SSS, PhilHealth and Pag-IBIG</li><li>Say what's provided: room, meals, uniform</li></ul></div>
      </aside>
    </div>`;

  if (!getAuthState().isAdmin) store.usage().then((u) => { const el = $("#post-usage"); if (el) el.textContent = `${u.postsM || 0} of ${LIMITS.posts} posts used this month`; }).catch(() => {});
  const f = $("#post-form");
  const val = (n) => f.querySelector(`[name=${n}]:checked`)?.value ?? "";
  const workplace = () => val("workplace");
  let touchedBenefits = false;
  let autoTitle = "";

  const renderOptions = () => {
    const wp = workplace() || "household";
    const cats = wp === "household" ? HOUSEHOLD_CATS.concat(["Other"]) : CATEGORIES.filter((c) => !HOUSEHOLD_ONLY.includes(c));
    const curCat = val("category");
    $("#cat-pills").innerHTML = cats.map((c) => `<label class="pill"><input type="radio" name="category" value="${esc(c)}" required ${curCat === c ? "checked" : ""}><span>${esc(c)}</span></label>`).join("");
    const curSched = val("schedule");
    $("#sched-pills").innerHTML = radioPills("schedule", SCHEDULES[wp].map((s) => [s, s]), SCHEDULES[wp].includes(curSched) ? curSched : "Full-time");
    $("#arr-field").hidden = wp !== "household";
    $("#addr-field").hidden = workplace() !== "business"; f.address.required = workplace() === "business";
    $("#loc-hint").textContent = workplace() === "business" ? "Businesses must show their full address so applicants know where they'll work." : "For households, the barangay is enough. Don't include house numbers.";
    f.querySelectorAll("[name=arrangement]").forEach((r) => (r.required = wp === "household"));
    const curReq = [...f.querySelectorAll("[name=reqList]:checked")].map((i) => i.value);
    $("#req-chips").innerHTML = REQ_SKILLS[wp].concat(REQ_SKILLS.common).filter((x) => reqFits(x, curCat)).map((s) => `<label class="chip"><input type="checkbox" name="reqList" value="${esc(s)}" ${curReq.includes(s) ? "checked" : ""}><span>${esc(s)}</span></label>`).join("");
    if (!touchedBenefits) f.querySelectorAll("[name=benefits]").forEach((cb) => { if (RECOMMENDED.includes(cb.value)) cb.checked = wp === "household"; });
    $("#ben-hint").textContent = wp === "household"
      ? "SSS, PhilHealth, Pag-IBIG and 13th month pay are pre-selected because the Kasambahay Law requires them for household workers. Posts that include them get more applicants."
      : "Posts with SSS, PhilHealth, Pag-IBIG and 13th month pay get more applicants.";
  };

  const collect = () => {
    const g = (n) => (f[n] && !(f[n] instanceof RadioNodeList) ? String(f[n].value ?? "").trim() : "");
    const wp = workplace();
    const arrangement = wp === "household" ? val("arrangement") : "";
    const schedule = val("schedule");
    return {
      title: g("title"), category: val("category"), categoryOther: val("category") === "Other" ? g("categoryOther").replace(/\s+/g, " ").replace(/^./, (c) => c.toUpperCase()) : "", employerName: g("employerName"), city: g("city"), area: g("area"),
      address: wp === "business" ? g("address") : "",
      workplace: wp, arrangement, schedule,
      employmentType: wp === "household" ? (arrangement || "Live-in") : (schedule || "Full-time"),
      salaryMin: g("salaryMin") ? Number(g("salaryMin")) : null, salaryMax: g("salaryMax") && (val("salaryPeriod") || "month") === "month" ? Number(g("salaryMax")) : null,
      salaryPeriod: val("salaryPeriod") || "month", hours: g("hours"),
      daysOff: g("daysOff") === "" ? null : Math.max(2, Math.min(15, Number(g("daysOff")))), daysOffPer: "month",
      openings: Math.max(1, Math.min(3, Number(g("openings")) || 1)), startDate: g("startDate"),
      benefits: [...f.querySelectorAll("[name=benefits]:checked")].map((i) => i.value),
      reqExperience: Number(val("reqExperience") || 0), reqEducation: val("reqEducation") || "Any",
      reqList: [...f.querySelectorAll("[name=reqList]:checked")].map((i) => i.value),
      requirements: g("requirements"), description: g("description"),
    };
  };
  const currentMin = () => (f.city.value && workplace() ? minimumPay(f.city.value, workplace(), val("salaryPeriod") || "month") : null);
  const counter = document.createElement("p"); counter.className = "hint"; f.description.after(counter);
  const ph = { messenger: "Messenger username or m.me link", phone: "e.g. 0917 123 4567", email: "you@example.com" };

  const hoursText = () => {
    const len = Number(f.hLen.value) || 8, st = Number(f.hStart.value) || 8;
    const end = st + len + (len > 5 ? 1 : 0);
    return `${len} hours a day, ${clock(st)}–${clock(end)}${len > 5 ? " (1-hr break)" : ""}`;
  };
  const refresh = () => {
    { const per = val("salaryPeriod") || "month"; f.salaryMin.placeholder = per === "month" ? "6,500" : per === "day" ? "525" : "66"; }
    { const other = val("category") === "Other"; $("#cat-other").hidden = !other; f.categoryOther.required = other; }
    const single = (val("salaryPeriod") || "month") !== "month";
    $("#pay-to").hidden = single; $("#pay-from-label").textContent = single ? `Pay per ${val("salaryPeriod")} *` : "From *";
    $(".pay-row").classList.toggle("single", single);
    const liveIn = workplace() === "household" && val("arrangement") !== "Stay-out"; // live-in, or not chosen yet
    $(".hours-fld").hidden = liveIn;
    f.hours.value = liveIn ? "" : hoursText();
    { const len = Number(f.hLen.value) || 8, st = Number(f.hStart.value) || 8;
      $("#wh-start").textContent = clock(st); $("#wh-len").textContent = `${len} hrs`;
      $("#wh-range").textContent = `${clock(st)} – ${clock(st + len + (len > 5 ? 1 : 0))}${len > 5 ? " · incl. 1-hr break" : ""}`;
      const tag = $("#wh-tag"); tag.className = `h-tag ${len <= 8 ? "ok" : len === 10 ? "warn" : "mid"}`;
      tag.textContent = len < 8 ? "Short day" : len === 8 ? "Recommended" : len === 9 ? "Long day" : "Discouraged: 10 hrs is the max"; }
    const n = f.description.value.trim().length; counter.textContent = n < 30 ? `${n}/30 characters minimum` : `${n} characters`;
    f.contactValue.placeholder = ph[val("contactMethod")] || "";
    const box = $("#wage-box"); const min = currentMin(); const pay = Number(f.salaryMin.value) || 0; const per = val("salaryPeriod") || "month";
    // Only speak up when something is wrong: pay below the legal minimum, or pay that looks like a typo.
    const low = min && pay && pay < min.amount;
    const pw = pay ? payWarning({ workplace: workplace(), salaryPeriod: per, salaryMin: f.salaryMin.value, salaryMax: per === "month" ? f.salaryMax.value : "" }) : null;
    box.hidden = !low && !pw;
    box.className = `wage-box ${low ? "low" : pw ? "odd" : ""}`;
    box.innerHTML = low
      ? `<strong>Below the legal minimum</strong><span class="small">The minimum for this job in ${esc(min.region)} is ₱${min.amount.toLocaleString("en-PH")} per ${per}. Please raise the pay.</span>`
      : pw ? `<span class="verdict odd">⚠ Please double-check: ${esc(pw.msg)}</span>` : "";
    const d = collect();
    $("#preview").innerHTML = card({ ...d, id: "preview", title: d.title || "Job title", employerName: d.employerName || "Employer name", city: d.city || "City", category: d.category || "Category", approvedAt: Date.now() }, false, null).replace(/href="[^"]*"/, 'href="#/post" tabindex="-1" aria-hidden="true"');
  };

  f.addEventListener("change", (e) => {
    if (e.target.name === "benefits") touchedBenefits = true;
    if (e.target.name === "workplace") { renderOptions(); if (!val("category") && f.title.value.trim() === autoTitle) { f.title.value = ""; autoTitle = ""; } }
    if (e.target.name === "category") renderOptions();
    if (["category", "arrangement", "workplace"].includes(e.target.name)) {
      const base = TITLE_FOR[val("category")];
      const t = f.title.value.trim();
      if (base && (!t || t === autoTitle)) {
        const arr = workplace() === "household" && ["Kasambahay / Househelper", "Yaya / Nanny", "Caregiver", "Cook"].includes(val("category")) ? val("arrangement") : "";
        autoTitle = arr ? `${arr} ${base}` : base; f.title.value = autoTitle; f.title.classList.remove("invalid");
      }
    }
    if (e.target.name === "contactMethod") {
      const m = e.target.value; f.contactValue.value = m === "phone" ? profile.phone : m === "messenger" ? (profile.messenger || "") : (user.email || "");
    }
    refresh();
  });
  f.addEventListener("input", (e) => { e.target.classList?.remove("invalid"); refresh(); });
  f.addEventListener("click", (e) => {
    const w = e.target.closest("[data-wh]");
    if (w) { const i = f[w.dataset.wh]; const [lo, hi] = w.dataset.wh === "hStart" ? [4, 22] : [4, 10]; i.value = Math.max(lo, Math.min(hi, Number(i.value) + Number(w.dataset.d))); return refresh(); }
    const b = e.target.closest("[data-step]"); if (!b) return;
    const i = f[b.dataset.for]; const v = Math.max(Number(i.min), Math.min(Number(i.max), (Number(i.value) || 0) + Number(b.dataset.step)));
    i.value = v; refresh();
  });
  const cityOf = (v) => { const t = String(v || "").trim().toLowerCase().replace(/ city$/, ""); return cityList.find((c) => c.toLowerCase() === t || c.toLowerCase().replace(/ city$/, "") === t) || ""; };
  autocomplete(f.city, $("#p-city-list"), (term) => {
    const t = term.trim().toLowerCase().replace(/ city$/, "");
    return cityList.filter((c) => !t || c.toLowerCase().startsWith(t) || c.toLowerCase().split(/[\s.-]+/).some((w) => w && w.startsWith(t)))
      .map((c) => ({ value: c, html: hl(c, t), meta: /City$/.test(c) ? "City" : "Town" })).slice(0, 40);
  }, (v) => { f.area.value = ""; refresh(); f.area.focus(); }, true);
  f.city.addEventListener("blur", () => setTimeout(() => { const c = cityOf(f.city.value); if (c) f.city.value = c; refresh(); }, 150));
  autocomplete(f.area, $("#p-area-list"), (term) => {
    const t = term.trim().toLowerCase(); const list = BARANGAYS[cityOf(f.city.value)] || [];
    return list.filter((b) => !t || b.toLowerCase().startsWith(t) || b.toLowerCase().split(/[\s.-]+/).some((w) => w.startsWith(t)))
      .map((b) => ({ value: b, html: hl(b, t), meta: "Barangay" }));
  }, () => refresh(), true);
  renderOptions();
  const draft = loadDraft("post");
  if (draft) {
    applyDraft(f, draft); touchedBenefits = true; renderOptions(); applyDraft(f, draft);
    f.insertAdjacentHTML("afterbegin", draftNote());
    f.querySelector("[data-draft-clear]").addEventListener("click", () => { clearDraft("post"); viewPost(); });
  }
  autosave("post", f);
  refresh();

  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#form-error");
    const fail = (m, el) => { err.textContent = m; err.hidden = false; if (el) { el.classList.add("invalid"); setTimeout(() => el.focus({ preventScroll: true }), 300); } (el || err).scrollIntoView({ block: "center", behavior: "smooth" }); };
    err.hidden = true;
    if (!f.checkValidity()) {
      const bad = f.querySelector("input:invalid, select:invalid, textarea:invalid");
      const msgs = {
        workplace: "Choose who's hiring: a private household or a business.", employerName: "Add the employer or household name.",
        title: "Add a job title (at least 3 characters).", category: "Choose a category.", arrangement: "Choose live-in or stay-out.",
        city: "Choose the city or municipality.", salaryMin: "Enter the pay. It must meet the legal minimum.",
        description: "Write a description of at least 30 characters: duties, schedule, household size.",
        contactValue: "Add how applicants can contact you.",
        agreeWage: "Confirm that you'll pay at least the legal minimum.", agreeFee: "Confirm that you won't charge applicants any fee.",
        agreeAge: "Confirm that you'll only hire workers aged 18 or older.", agreeTerms: "Confirm that you'll follow labor law and the Terms.",
      };
      const target = bad?.type === "radio" ? bad.closest(".pcard, .fld") : bad;
      if (bad?.type === "radio") { target?.classList.add("flash"); setTimeout(() => target?.classList.remove("flash"), 1600); }
      return fail(msgs[bad?.name] || "Please complete the highlighted field.", bad?.type === "radio" ? null : bad);
    }
    const okCity = cityOf(f.city.value);
    if (!okCity) return fail("Pick a city or town in Negros Occidental from the list.", f.city);
    if (val("category") === "Other" && f.categoryOther.value.trim().length < 2) return fail("Tell us what kind of job it is.", f.categoryOther);
    if (workplace() === "business" && f.address.value.trim().length < 8) return fail("Add your full business address: building or unit, and street.", f.address);
    f.city.value = okCity;
    const data = collect();
    if (data.salaryMax && data.salaryMax < data.salaryMin) return fail("The 'To' amount should be higher than 'From'.", f.salaryMax);
    const min = currentMin();
    if (min && data.salaryMin < min.amount) return fail(`The pay is below the legal minimum of ₱${min.amount.toLocaleString("en-PH")} per ${data.salaryPeriod}. Please raise it.`, f.salaryMin);
    if (!(data.daysOff >= 2)) return fail("The minimum is 2 days off per month.", f.daysOff);
    const contact = { contactMethod: val("contactMethod"), contactValue: f.contactValue.value.trim() };
    if (workplace() === "business" && f.hideAddress.checked && data.address) { contact.address = data.address; data.address = ""; data.addressHidden = true; }
    if (!contactLink(contact)) return fail("That contact doesn't look right. Check the username, number or email.", f.contactValue);
    if (contact.contactMethod === "phone" && digits(contact.contactValue).length < 10) return fail("Please enter a complete phone number.", f.contactValue);
    const pw = payWarning(data);
    if (pw) {
      const sure = await showDialog({ title: "Is the pay correct?", body: `${esc(pw.msg)} Applicants will see exactly what you enter, so a typo can attract the wrong people or look like a scam.`, actions: [{ label: "Let me fix it", value: false, primary: true }, { label: "Yes, it's correct", value: true }] });
      if (!sure) { const el = f[pw.field]; el.classList.add("invalid"); el.scrollIntoView({ block: "center", behavior: "smooth" }); setTimeout(() => el.focus({ preventScroll: true }), 300); return; }
    }
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Submitting…";
    try {
      if (!data.address) delete data.address; // older rules don't know this field yet
      if (!data.categoryOther) delete data.categoryOther;
      await store.createJob(data, contact);
      clearDraft("post");
      jobsCache = null;
      app.innerHTML = `<div class="empty"><h1>Thanks! Your post is under review.</h1><p class="muted">We'll check it soon. Applicants will appear under My posts once it's live.</p><p><a class="btn btn-primary" href="#/my">Go to My posts</a> <a class="btn btn-ghost" href="#/post" id="again">Post another</a></p></div>`;
      $("#again").addEventListener("click", (ev) => { ev.preventDefault(); viewPost(); });
    } catch (ex) {
      console.error(ex); btn.disabled = false; btn.textContent = "Submit for review";
      fail(ex.code === "limit-reached" ? limitMsg.posts : ex.code === "permission-denied"
        ? "The database rejected this post. If you just updated the site, publish the latest database rules in Firebase, then try again."
        : `Could not submit (${ex.code || ex.message || "unknown error"}). Please try again.`);
    }
  });
}

/* ---------------- Employer: my posts + applicants ---------------- */
async function viewMy() {
  document.title = "My posts | Job Search PH";
  const { user, profile } = getAuthState();
  if (!user) return goSignIn("Sign in to manage your posts");
  if (!profile) { location.hash = "#/profile"; return; }
  app.innerHTML = `<div class="page-head"><h1>My posts</h1><a class="btn btn-primary" href="#/post">Post a job</a></div><div id="mine">${SK.rows(4)}</div>`;
  const draw = async () => {
    const [list, apps] = await Promise.all([store.myJobs(), store.applicationsForEmployer().catch(() => [])]);
    if (!$("#mine")) return;
    list.sort((a, b) => b.createdAt - a.createdAt);
    const by = {}; apps.forEach((a) => { (by[a.jobId] ||= []).push(a); });
    $("#mine").innerHTML = list.length ? `<div class="table">${list.map((j) => {
      const a = by[j.id] || []; const fresh = a.filter((x) => x.status === "new").length;
      return `
      <div class="trow">
        <div><a href="#/job/${encodeURIComponent(j.id)}"><strong>${esc(j.title)}</strong></a> ${statusBadge(j)}
          <div class="muted small">${esc(j.city)} · posted ${ago(j.createdAt)}${j.expiresAt ? ` · ${isLive(j) ? "expires" : "expired"} ${new Date(j.expiresAt).toLocaleDateString("en-PH")}` : ""}</div>
          ${j.status === "pending" && j.infoNote ? `<div class="info-ask"><strong>We need a bit more before approving this post:</strong> ${esc(j.infoNote)}.<span class="small muted"> Add your Facebook link or permit on your <a href="#/profile">profile</a>, or send the rest to us.</span><a class="btn btn-primary btn-sm" href="#/support" data-reply-info="${esc(j.id)}">Reply to Job Search PH</a></div>` : ""}</div>
        <div><a class="btn btn-ghost btn-sm" href="#/applicants/${encodeURIComponent(j.id)}">${a.length} applicant${a.length === 1 ? "" : "s"}${fresh ? ` <span class="dot">${fresh} new</span>` : ""}</a></div>
        <div class="actions">${j.status === "approved" || j.status === "pending" ? `<button class="btn btn-ghost btn-sm" data-close="${esc(j.id)}">Mark filled / close</button>` : ""}</div>
      </div>`; }).join("")}</div>` : `<div class="empty"><p>You haven't posted any jobs yet.</p></div>`;
  };
  $("#mine").addEventListener("click", async (e) => {
    const r = e.target.closest("[data-reply-info]");
    if (r) { const t = e.target.closest(".trow")?.querySelector("strong")?.textContent || ""; supportPrefill = { topic: "A job post or employer", message: `About my post "${t}" (ID ${r.dataset.replyInfo}):\n`, page: `#/job/${r.dataset.replyInfo}` }; return; }
    const b = e.target.closest("[data-close]"); if (!b) return;
    if (!confirmInline(b, "Click again to close")) return;
    try { await store.updateJob(b.dataset.close, { status: "closed" }); jobsCache = null; toast("Post closed"); draw(); } catch { toast("Could not close post"); }
  });
  draw().catch((e) => { console.error(e); $("#mine").innerHTML = `<p class="error">Could not load your posts (${esc(e.code || e.message)}).</p>`; });
}

function applicantCard(a) {
  const x = a.applicant || {};
  const m = messengerUrl(x.messenger);
  const st = chatState(a);
  const resume = [safeUrl(x.resumeUrl) && `<a href="${esc(safeUrl(x.resumeUrl))}" target="_blank" rel="noopener nofollow">Open resume link</a>`,
    safeUrl(x.resumeFileUrl) && `<a href="${esc(safeUrl(x.resumeFileUrl))}" target="_blank" rel="noopener">${esc(x.resumeFileName || "Resume file")}</a>`].filter(Boolean).join(" · ");
  const exp = x.experienceYears != null && x.experienceYears !== "" ? `${esc(x.experienceYears)} year${Number(x.experienceYears) === 1 ? "" : "s"}` : "";
  const facts = [
    ["Phone", x.phone ? `<span class="copyable">${esc(x.phone)}</span>` : ""],
    ["Email", x.email ? `<a href="mailto:${esc(x.email)}">${esc(x.email)}</a>` : ""],
    ["Messenger", m ? `<a href="${esc(m)}" target="_blank" rel="noopener nofollow">${esc(String(x.messenger).replace(/^https?:\/\/(www\.)?/, ""))}</a>` : ""],
    ["Lives in", esc(x.city || "")],
    ["Experience", exp],
    ["Can start", esc(x.availability || "")],
    ["Education", esc(x.education || "")],
    ["Resume", resume],
  ];
  const cats = wantList(x);
  const dash = `<span class="none">Not added</span>`;
  return `
  <article class="applicant ap2 ${a.status === "new" ? "is-new" : ""} ${DECLINED.includes(a.status) ? "declined" : ""}">
    <header class="ap-head">
      ${avatar(x.fullName, x.photo, "md")}
      <div class="ap-name"><h3>${esc(x.fullName)}${x.age ? `, ${esc(x.age)}` : ""}</h3>
        <p class="muted small">${[x.gender && esc(x.gender), esc(x.city || ""), `applied ${ago(a.createdAt)}`].filter(Boolean).join(" · ")}</p></div>
      <div class="ap-badges">${founderBadge(a.applicantUid, "jobseeker")}${strengthChip(x)}${appBadge(a.status, true)}</div>
    </header>
    ${a.message ? `<div class="ap-msg"><span class="label">Their message</span><p>${nl2br(a.message)}</p></div>` : ""}
    <dl class="ap-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v || dash}</dd></div>`).join("")}</dl>
    <div class="ap-long">
      <div><span class="label">Jobs they want</span>${cats.length ? `<ul class="meta">${cats.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : `<p>${dash}</p>`}</div>
      <div><span class="label">Skills</span><p>${x.skills ? esc(x.skills) : dash}</p></div>
      <div><span class="label">Work history</span><p>${x.workHistory ? nl2br(x.workHistory) : dash}</p></div>
    </div>
    ${a.status === "hired" ? `<div class="actions emp-row">${employmentHtml(a)}</div>` : ""}
    <footer class="ap-foot">
      <div class="ap-contact">
        <a class="btn ${st.open ? "btn-primary" : "btn-ghost"} btn-sm" href="#/chat/${encodeURIComponent(a.id)}">${st.open ? `Message${isUnread(inbox.find((i) => i.id === a.id) || a) ? " · new" : ""}` : "View chat"}</a>
        ${CAN_SMS && x.phone ? `<a class="btn btn-ghost btn-sm" href="tel:${esc(digits(x.phone))}">Call</a><a class="btn btn-ghost btn-sm" href="sms:${esc(digits(x.phone))}">Text</a>` : ""}
        ${DECLINED.includes(a.status) ? `<span class="closing">${chatClosedText(st)}</span>` : ""}
      </div>
      <div class="ap-status">
        ${a.status === "offered" ? `<span class="emp-state">Waiting for ${esc((x.fullName || "them").split(" ")[0])} to accept</span><button class="btn btn-ghost btn-sm" data-st="shortlisted" data-id="${esc(a.id)}">Withdraw offer</button>` : ""}
        ${["new", "not_selected"].includes(a.status) ? `<button class="btn btn-ghost btn-sm" data-st="shortlisted" data-id="${esc(a.id)}">Shortlist</button>` : ""}
        ${["new", "shortlisted"].includes(a.status) ? `<button class="btn btn-ghost btn-sm" data-st="not_selected" data-id="${esc(a.id)}">Not a fit</button>` : ""}
        ${["new", "shortlisted", "not_selected"].includes(a.status) ? `<button class="btn btn-primary btn-sm" data-st="offered" data-id="${esc(a.id)}">Offer the job</button>` : ""}
      </div>
    </footer>
  </article>`;
}

async function viewApplicants(jobId) {
  document.title = "Applicants | Job Search PH";
  const { user } = getAuthState();
  if (!user) return goSignIn("Sign in to see applicants");
  app.innerHTML = SK.page();
  const job = await store.getJob(jobId);
  if (!job || job.ownerUid !== user.uid) { app.innerHTML = `<div class="empty"><h1>Not found</h1><p class="muted">This post isn't yours or no longer exists.</p></div>`; return; }
  let tab = "all";
  const draw = async () => {
    const apps = (await store.applicationsForJob(jobId)).sort((a, b) => b.createdAt - a.createdAt);
    const group = (s) => (s === "offer_declined" ? "not_selected" : s);
    const counts = { all: apps.length, new: 0, shortlisted: 0, offered: 0, hired: 0, not_selected: 0 };
    apps.forEach((a) => counts[group(a.status)]++);
    const shown = tab === "all" ? apps : apps.filter((a) => group(a.status) === tab);
    const openings = Number(job.openings) || 1;
    const filled = job.status === "approved" && counts.hired >= openings;
    app.innerHTML = `
      <p><a href="#/my" class="back">← My posts</a></p>
      <div class="page-head"><div><h1>Applicants</h1><p class="muted">${esc(job.title)} · ${esc(job.city)} ${statusBadge(job)}</p></div></div>
      ${filled ? `<div class="notice filled"><div><strong>All ${openings} opening${openings === 1 ? " is" : "s are"} filled.</strong> Close the post so it leaves search and the other applicants know.</div><button class="btn btn-primary btn-sm" id="close-filled">Close the post</button></div>` : ""}
      <div class="tabs" role="tablist">${[["all", "All"], ["new", "New"], ["shortlisted", "Shortlisted"], ["offered", "Offered"], ["hired", "Hired"], ["not_selected", "Not a fit"]]
        .map(([k, v]) => `<button class="tab ${tab === k ? "active" : ""}" data-tab="${k}">${v} <span class="count">${counts[k]}</span></button>`).join("")}</div>
      <div class="applicants">${shown.length ? shown.map(applicantCard).join("") : `<div class="empty"><p>${apps.length ? "No applicants in this group." : "No applicants yet. Share your post to get more."}</p></div>`}</div>`;
    app.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; draw(); }));
    app.querySelectorAll("[data-emp]").forEach((b) => b.addEventListener("click", () => {
      const a = apps.find((x) => x.id === b.dataset.id); if (a) handleEmployment(b, a, draw);
    }));
    $("#close-filled")?.addEventListener("click", async () => {
      const ok = await showDialog({ title: "Close this job post?", body: "It will leave search. Applicants still waiting will be told the position is filled, and their chats close after 48 hours.", actions: [{ label: "Keep it open", value: false }, { label: "Close the post", value: true, primary: true }] });
      if (!ok) return;
      try {
        await store.updateJob(job.id, { status: "closed" }); job.status = "closed"; jobsCache = null;
        await store.clearReportsFor(job.id).catch(() => {});
        await Promise.all(apps.filter((x) => ["new", "shortlisted", "offered"].includes(x.status)).map((x) =>
          store.setApplicationStatus(x, "not_selected", { note: { type: "job_filled", title: "Position filled", body: `${job.title} has been filled. Your chat with the employer stays open for 48 hours.`, link: `#/chat/${x.id}` } }).catch(() => {})));
        toast("Post closed. Applicants have been told."); draw();
      } catch (err) { console.error(err); toast("Could not close the post"); }
    });
    app.querySelectorAll("[data-st]").forEach((b) => b.addEventListener("click", async () => {
      const a = apps.find((x) => x.id === b.dataset.id); const st = b.dataset.st;
      const first = (a.applicant?.fullName || "them").split(" ")[0];
      if (st === "offered") {
        const ok = await showDialog({ title: `Offer the job to ${esc(first)}?`, body: `${esc(first)} will get a notification and can accept or decline. They're only hired once they accept.`, actions: [{ label: "Cancel", value: false }, { label: "Send offer", value: true, primary: true }] });
        if (!ok) return;
      }
      if (st === "shortlisted" && a.status === "offered") {
        const ok = await showDialog({ title: "Withdraw your offer?", body: `${esc(first)} goes back to Shortlisted and won't be able to accept.`, actions: [{ label: "Keep offer", value: false }, { label: "Withdraw", value: true, primary: true }] });
        if (!ok) return;
      }
      try {
        await store.setApplicationStatus(a, st, a.status === "offered" && st === "shortlisted" ? { note: { type: "offer_withdrawn", title: "Job offer withdrawn", body: `The employer withdrew the ${a.jobTitle} offer for now.`, link: `#/chat/${a.id}` } } : {});
        toast({ shortlisted: a.status === "offered" ? "Offer withdrawn." : "Shortlisted. We let them know.", offered: "Offer sent. We'll let you know when they answer.", not_selected: "Updated. We let them know." }[st] || "Updated");
        draw();
      } catch (err) { console.error(err); toast(err.code === "permission-denied" ? "Couldn't update. Make sure the latest database rules are published." : "Could not update"); }
    }));
  };
  draw().catch((e) => { console.error(e); app.innerHTML = `<p class="error">Could not load applicants (${esc(e.code || e.message)}).</p>`; });
}

/* ---------------- Jobseeker: my applications ---------------- */
async function viewApplications() {
  document.title = "My applications | Job Search PH";
  const { user, profile } = getAuthState();
  if (!user) return goSignIn("Sign in to see your applications");
  if (!profile) { location.hash = "#/profile"; return; }
  app.innerHTML = `<div class="page-head"><h1>My applications</h1><a class="btn btn-ghost" href="#/">Find more jobs</a></div><div id="apps">${SK.rows(4)}</div>`;
  myAppsCache = null;
  const apps = (await getMyApps()).sort((a, b) => b.createdAt - a.createdAt);
  if (!$("#apps")) return;
  $("#apps").innerHTML = apps.length ? `<div class="table">${apps.map((a) => `
    <div class="trow ${DECLINED.includes(a.status) ? "declined" : ""}">
      <div><a href="#/job/${encodeURIComponent(a.jobId)}"><strong>${esc(a.jobTitle)}</strong></a><div class="muted small">${esc(a.jobCity || "")} · applied ${ago(a.createdAt)}${DECLINED.includes(a.status) ? ` · ${chatClosedText(chatState(a))}` : ""}</div></div>
      <div>${a.status === "hired" && a.employmentEnded ? `<span class="badge badge-closed">Job ended</span>` : appBadge(a.status)}</div>
      <div class="actions"><a class="btn btn-ghost btn-sm" href="#/chat/${encodeURIComponent(a.id)}">${chatState(a).open ? "Message" : "View chat"}</a><a class="btn btn-ghost btn-sm" href="#/job/${encodeURIComponent(a.jobId)}">View job</a>${a.status === "hired" && !a.employmentEnded ? employmentHtml(a) : ""}${offerHtml(a)}</div>
    </div>`).join("")}</div>`
    : `<div class="empty"><p><strong>No applications yet.</strong></p><p class="muted">Find a job you like and tap Apply.</p><p><a class="btn btn-primary" href="#/">Browse jobs</a></p></div>`;
  const hiredNow = apps.find((a) => a.status === "hired" && !a.employmentEnded && isFullTime(a.jobSchedule, a.jobArrangement));
  const stg = profileStrength(profile);
  if (stg.score < 90) $("#apps").insertAdjacentHTML("beforebegin", `<a class="s-nudge ${stg.cls}" href="#/profile"><span><strong>Your profile is ${stg.level} (${stg.score}/100).</strong> Employers reply more to complete profiles. Next: ${esc(stg.todo[0]?.todo || "")}.</span><em>Finish my profile</em></a>`);
  if (hiredNow) $("#apps").insertAdjacentHTML("beforebegin", `<p class="notice">You're employed full-time as <strong>${esc(hiredNow.jobTitle)}</strong>. You can apply to part-time jobs. To apply for full-time jobs again, tap <strong>Leave this job</strong> below and your employer confirms.</p>`);
  $("#apps").addEventListener("click", async (e) => {
    const o = e.target.closest("[data-offer]");
    if (o) { const a = apps.find((x) => x.id === o.dataset.id); if (a) handleOffer(o, a, viewApplications); return; }
    const b = e.target.closest("[data-emp]"); if (!b) return;
    const a = apps.find((x) => x.id === b.dataset.id); if (a) handleEmployment(b, a, viewApplications);
  });
}

/* ---------------- Withdrawing (deliberately a few steps) ---------------- */
function withdrawDialog(a) {
  const reasons = ["I found another job", "The pay or schedule doesn't work for me", "The location is too far", "I applied by mistake", "Other reason"];
  return new Promise((resolve) => {
    const wrap = document.createElement("div"); wrap.className = "dlg-backdrop";
    wrap.innerHTML = `<div class="dlg dlg-wd" role="dialog" aria-modal="true" aria-labelledby="wd-t">
      <h2 id="wd-t">Withdraw from ${esc(a.jobTitle)}?</h2>
      <p>${a.status === "shortlisted" ? `<strong>The employer shortlisted you.</strong> They're seriously considering you, so withdrawing now loses that chance.` : "The employer may already be reviewing your profile."}</p>
      <ul class="wd-list"><li>Your application and chat with ${esc(a.employerName || "the employer")} will be deleted.</li><li>The employer will be told you withdrew.</li><li>Applying again uses one of your ${LIMITS.applies} applications for the day.</li></ul>
      <fieldset class="wd-reasons"><legend>Why are you withdrawing?</legend>${reasons.map((r) => `<label class="wd-r"><input type="radio" name="wd" value="${esc(r)}"><span>${esc(r)}</span></label>`).join("")}</fieldset>
      <label class="check wd-ok"><input type="checkbox" id="wd-ok"><span>I understand this can't be undone.</span></label>
      <div class="dlg-actions"><button class="btn btn-primary" data-v="0">Keep my application</button><button class="btn btn-danger" data-v="1" disabled>Withdraw</button></div></div>`;
    const go = wrap.querySelector('[data-v="1"]');
    const check = () => { go.disabled = !(wrap.querySelector("[name=wd]:checked") && wrap.querySelector("#wd-ok").checked); };
    wrap.addEventListener("change", check);
    const done = (v) => { wrap.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") done(false); };
    wrap.addEventListener("click", (e) => { const b = e.target.closest("[data-v]"); if (b && !b.disabled) done(b.dataset.v === "1"); else if (e.target === wrap) done(false); });
    document.addEventListener("keydown", onKey); document.body.appendChild(wrap); wrap.querySelector('[data-v="0"]').focus();
  });
}
// After accepting a full-time job, strongly suggest withdrawing other full-time applications.
async function suggestWithdrawOthers(accepted) {
  if (!isFullTime(accepted.jobSchedule, accepted.jobArrangement)) return;
  myAppsCache = null;
  const others = (await getMyApps()).filter((x) => x.id !== accepted.id && ["new", "shortlisted", "offered"].includes(x.status) && isFullTime(x.jobSchedule, x.jobArrangement));
  if (!others.length) return;
  const ok = await showDialog({
    title: "Withdraw your other full-time applications?",
    body: `You still have ${others.length} other full-time application${others.length === 1 ? "" : "s"} (${others.map((x) => esc(x.jobTitle)).join(", ")}). Since you've accepted a full-time job, we strongly recommend withdrawing them so those employers can hire someone else. Their chats will be deleted, and any job offers will be declined.`,
    actions: [{ label: "Keep them for now", value: false }, { label: `Withdraw ${others.length === 1 ? "it" : `all ${others.length}`} (recommended)`, value: true, primary: true }],
  });
  if (!ok) return toast("Okay. You can withdraw them anytime from each job page.");
  const me = getAuthState().profile?.fullName || "An applicant";
  await Promise.all(others.map(async (x) => {
    try {
      if (x.status === "offered") return store.respondOffer(x, false);
      await store.notify(x.employerUid, { type: "app_withdrawn", title: "An applicant withdrew", body: `${me} accepted another job and withdrew from ${x.jobTitle}.`, link: `#/applicants/${x.jobId}`, appId: x.id, jobId: x.jobId }).catch(() => {});
      await store.withdraw(x.id);
    } catch (e) { console.error(e); }
  }));
  myAppsCache = null; toast("Done. Your other full-time applications were withdrawn.");
}

/* ---------------- Job offers (jobseeker accepts or declines) ---------------- */
function offerHtml(a) {
  if (a.status !== "offered" || a.employerUid === getAuthState().user?.uid) return "";
  return `<span class="emp-state ask">You got a job offer</span><button class="btn btn-primary btn-sm" data-offer="accept" data-id="${esc(a.id)}">Accept</button><button class="btn btn-ghost btn-sm" data-offer="decline" data-id="${esc(a.id)}">Decline</button>`;
}
async function handleOffer(btn, a, after) {
  const accept = btn.dataset.offer === "accept";
  const emp = a.employerName || "the employer";
  if (accept && isFullTime(a.jobSchedule, a.jobArrangement)) {
    myAppsCache = null;
    const other = (await getMyApps()).find((x) => x.id !== a.id && x.status === "hired" && !x.employmentEnded && isFullTime(x.jobSchedule, x.jobArrangement));
    if (other) {
      await showDialog({ title: "You already have a full-time job", body: `You're hired as ${esc(other.jobTitle)}. Leave that job first (in My applications), then accept this offer.`, actions: [{ label: "Okay", value: false, primary: true }] });
      return;
    }
  }
  const ok = await showDialog(accept
    ? { title: `Accept the ${esc(a.jobTitle)} job?`, body: `${esc(emp)} will be told you accepted, and you'll be marked as hired. Agree on your start date and pay in the chat.`, actions: [{ label: "Back", value: false }, { label: "Accept the job", value: true, primary: true }] }
    : { title: "Decline this job offer?", body: `${esc(emp)} will be told. You can't undo this, and your chat closes after 48 hours.`, actions: [{ label: "Back", value: false }, { label: "Decline offer", value: true, primary: true }] });
  if (!ok) return;
  try {
    await store.respondOffer(a, accept); myAppsCache = null;
    toast(accept ? "Congratulations! You accepted the job." : "Offer declined. We let the employer know.");
    if (accept) await suggestWithdrawOthers(a);
    after?.();
  } catch (err) { console.error(err); toast(err.code === "permission-denied" ? "Couldn't update. The offer may have been withdrawn, or the latest database rules aren't published yet." : "Could not update. Try again."); }
}

/* ---------------- Ending a job (both sides confirm) ---------------- */
function employmentHtml(a) {
  if (a.status !== "hired") return "";
  const me = getAuthState().user?.uid; const iAmEmployer = a.employerUid === me;
  const other = iAmEmployer ? (a.applicant?.fullName || "the worker") : (a.employerName || "the employer");
  if (a.employmentEnded) return `<span class="emp-state ended">Job ended${a.endedAt ? ` ${ago(a.endedAt)}` : ""}</span>`;
  if (!a.endRequestedBy) return `<button class="btn btn-ghost btn-sm" data-emp="request" data-id="${esc(a.id)}">${iAmEmployer ? "End employment" : "Leave this job"}</button>`;
  if (a.endRequestedBy === me) return `<span class="emp-state">Waiting for ${esc(other)} to confirm</span><button class="btn btn-ghost btn-sm" data-emp="cancel" data-id="${esc(a.id)}">Cancel request</button>`;
  return `<span class="emp-state ask">${esc(other)} says this job has ended</span><button class="btn btn-primary btn-sm" data-emp="confirm" data-id="${esc(a.id)}">Confirm</button><button class="btn btn-ghost btn-sm" data-emp="decline" data-id="${esc(a.id)}">Not yet</button>`;
}
async function handleEmployment(btn, a, after) {
  const kind = btn.dataset.emp; const iAmEmployer = a.employerUid === getAuthState().user?.uid;
  const other = iAmEmployer ? (a.applicant?.fullName || "the worker") : (a.employerName || "the employer");
  const ask = {
    request: { title: iAmEmployer ? "End this employment?" : "Leave this job?", body: `We'll ask ${esc(other)} to confirm. The job is marked as ended only after they agree.`, yes: "Send request" },
    confirm: { title: "Confirm the job has ended?", body: iAmEmployer ? `${esc(other)} will be able to apply to full-time jobs again.` : "You'll be able to apply to full-time jobs again.", yes: "Yes, it ended" },
    decline: { title: "Say the job hasn't ended?", body: `We'll let ${esc(other)} know it's still going.`, yes: "Not yet" },
    cancel: { title: "Cancel your request?", body: "The job stays active.", yes: "Cancel request" },
  }[kind];
  const ok = await showDialog({ title: ask.title, body: ask.body, actions: [{ label: "Back", value: false }, { label: ask.yes, value: true, primary: true }] });
  if (!ok) return;
  try {
    await store.employment(a, kind); myAppsCache = null;
    toast({ request: "Request sent. Waiting for them to confirm.", confirm: "Job marked as ended.", decline: "Okay, the job stays active.", cancel: "Request cancelled." }[kind]);
    after?.();
  } catch (err) { console.error(err); toast(err.code === "permission-denied" ? "Couldn't update. Make sure the latest database rules are published." : "Could not update. Try again."); }
}

/* ---------------- Messages ---------------- */
const CHAT_GRACE_MS = 48 * 3600000;
let inbox = [];
let unwatchInbox = null;
let inboxRole = null;
function chatState(a) {
  if (!DECLINED.includes(a.status)) return { open: true, declined: false };
  const closesAt = (typeof a.declinedAt === "number" ? a.declinedAt : Date.now()) + CHAT_GRACE_MS; // just declined = full 48h
  const left = closesAt - Date.now();
  return { open: left > 0, declined: true, closesAt, hoursLeft: Math.max(0, Math.ceil(left / 3600000)) };
}
function isUnread(a) {
  const me = getAuthState().user?.uid;
  if (!a.lastMessageAt || a.lastMessageFrom === me) return false;
  const seen = a.employerUid === me ? a.employerSeenAt : a.applicantSeenAt;
  return !seen || a.lastMessageAt > seen;
}
const unreadMessages = () => inbox.filter(isUnread).length;
function startInbox() {
  const { user, profile } = getAuthState();
  const role = user && profile ? profile.role : null;
  if (role === inboxRole && unwatchInbox) return;
  if (unwatchInbox) { unwatchInbox(); unwatchInbox = null; }
  inbox = []; inboxRole = role;
  if (!role) return;
  unwatchInbox = store.watchApplications(role, (list) => {
    inbox = list; myAppsCache = null; renderNav();
    if ((location.hash || "").startsWith("#/messages")) drawInbox();
  });
}
const otherName = (a) => (getAuthState().user?.uid === a.employerUid ? a.applicant?.fullName || "Applicant" : a.employerName || "Employer");
const chatClosedText = (st) => st.open ? `Chat closes in ${st.hoursLeft} hour${st.hoursLeft === 1 ? "" : "s"}` : "Chat closed";

function viewMessages() {
  document.title = "Messages | Job Search PH";
  const { user, profile } = getAuthState();
  if (!user) return goSignIn("Sign in to see your messages");
  if (!profile) { location.hash = "#/profile"; return; }
  app.innerHTML = `<div class="page-head"><div><h1>Messages</h1><p class="muted">${profile.role === "employer" ? "Chat with people who applied to your jobs." : "Chat with employers you applied to."}</p></div></div><div id="inbox">${inbox.length || !inboxRole ? "" : SK.threads(5)}</div>`;
  drawInbox();
}
function drawInbox() {
  const box = $("#inbox"); if (!box) return;
  const list = [...inbox].sort((a, b) => (b.lastMessageAt || b.updatedAt || b.createdAt || 0) - (a.lastMessageAt || a.updatedAt || a.createdAt || 0));
  const me = getAuthState().user?.uid;
  box.innerHTML = list.length ? `<div class="inbox">${list.map((a) => {
    const st = chatState(a); const unread = isUnread(a);
    const name = otherName(a);
    return `<a class="thread ${unread ? "unread" : ""} ${st.declined ? "declined" : ""}" href="#/chat/${encodeURIComponent(a.id)}">
      ${avatar(name, getAuthState().user?.uid === a.employerUid ? a.applicant?.photo : "")}
      <span class="thread-main">
        <span class="thread-top"><strong>${esc(name)}</strong><small>${a.lastMessageAt ? ago(a.lastMessageAt) : ""}</small></span>
        <span class="thread-job">${esc(a.jobTitle)}${a.jobCity ? ` · ${esc(a.jobCity)}` : ""} ${st.declined ? `<em class="closing">${chatClosedText(st)}</em>` : appBadge(a.status, a.employerUid === me)}</span>
        <span class="thread-last">${a.lastMessageText ? `${a.lastMessageFrom === me ? "You: " : ""}${esc(a.lastMessageText)}` : `<i>No messages yet. Say hello.</i>`}</span>
      </span>
      ${unread ? `<span class="unread-dot" aria-label="Unread"></span>` : ""}
    </a>`; }).join("")}</div>`
    : `<div class="empty"><p><strong>No conversations yet.</strong></p><p class="muted">${inboxRole === "employer" ? "When someone applies to your job, you can chat with them here." : "Apply to a job to start chatting with the employer."}</p></div>`;
}

let unwatchChat = null;
async function viewChat(appId) {
  document.title = "Chat | Job Search PH";
  const { user } = getAuthState();
  if (!user) return goSignIn("Sign in to see your messages");
  app.innerHTML = `<div class="chat-wrap"><div class="chat-body">${SK.chat()}</div></div>`;
  const here = location.hash;
  let a = await store.getApplication(appId);
  if (location.hash !== here) return;
  if (!a) { app.innerHTML = `<div class="empty"><h1>Conversation not found</h1><p class="muted">It may have been withdrawn.</p><p><a class="btn btn-primary" href="#/messages">Back to Messages</a></p></div>`; return; }
  const me = user.uid; const iAmEmployer = a.employerUid === me;
  const name = otherName(a);
  const x = a.applicant || {};
  app.innerHTML = `
    <div class="chat-wrap">
      <header class="chat-head">
        <a href="#/messages" class="back" aria-label="Back to messages">←</a>
        ${avatar(name, iAmEmployer ? x.photo : "")}
        <div class="chat-who"><strong>${esc(name)}</strong> ${(iAmEmployer ? founderBadge(a.applicantUid, "jobseeker", { short: true }) : verifiedBadge(a.employerUid, { short: true }) + founderBadge(a.employerUid, "employer", { short: true }))}
          <span class="muted small">${iAmEmployer ? `${x.age ? `${esc(x.age)} · ` : ""}${esc(x.city || "")} · ` : ""}<a href="#/job/${encodeURIComponent(a.jobId)}">${esc(a.jobTitle)}</a></span></div>
        <span id="chat-badge"></span>
      </header>
      <div id="chat-banner"></div>
      <div class="chat-body" id="chat-body">${SK.chat()}</div>
      <form class="chat-form" id="chat-form">
        <textarea id="chat-input" name="text" rows="1" maxlength="1000" placeholder="Write a message…" aria-label="Message"></textarea>
        <button class="btn btn-primary" type="submit" aria-label="Send">Send</button>
      </form>
      <p class="chat-note small muted">Keep chats about this job. Never send money or ID numbers here.</p>
    </div>`;
  const body = $("#chat-body"), form = $("#chat-form"), input = $("#chat-input");
  const paintState = () => {
    const st = chatState(a);
    $("#chat-badge").innerHTML = appBadge(a.status, iAmEmployer);
    const emp = (a.status === "hired" && !a.employmentEnded && a.endRequestedBy ? `<div class="chat-banner emp">${employmentHtml(a)}</div>` : "")
      + (a.status === "offered" ? `<div class="chat-banner emp">${iAmEmployer ? `<span class="emp-state">You offered ${esc(name)} the job. Waiting for them to accept.</span>` : offerHtml(a)}</div>` : "");
    $("#chat-banner").innerHTML = emp + (st.declined
      ? `<p class="chat-banner ${st.open ? "" : "closed"}">${st.open
          ? `${a.status === "offer_declined" ? (iAmEmployer ? `${esc(name)} declined your offer.` : "You declined this offer.") : iAmEmployer ? "You marked this applicant as not a fit." : "The employer chose other applicants."} This chat closes in <strong>${st.hoursLeft} hour${st.hoursLeft === 1 ? "" : "s"}</strong>.`
          : "This chat has closed. You can still read past messages."}</p>` : "");
    input.disabled = !st.open; form.querySelector("button").disabled = !st.open;
    input.placeholder = st.open ? "Write a message…" : "Chat closed";
    form.classList.toggle("closed", !st.open);
  };
  $("#chat-banner").addEventListener("click", (e) => {
    const o = e.target.closest("[data-offer]"); if (o) return handleOffer(o, a, async () => { a = (await store.getApplication(a.id)) || a; paintState(); });
    const b = e.target.closest("[data-emp]"); if (b) handleEmployment(b, a, async () => { a = (await store.getApplication(a.id)) || a; paintState(); });
  });
  paintState();
  const fmt = (ms) => new Date(ms).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  let lastCount = -1;
  if (unwatchChat) unwatchChat();
  unwatchChat = store.watchMessages(a.id, (msgs, err) => {
    if (!$("#chat-body")) { unwatchChat?.(); unwatchChat = null; return; }
    if (!msgs) { body.innerHTML = `<p class="error small">Could not load messages (${esc(err?.code || "error")}).</p>`; return; }
    const intro = `<div class="chat-intro">${iAmEmployer ? `${esc(name)} applied for <strong>${esc(a.jobTitle)}</strong> ${ago(a.createdAt)}.` : `You applied for <strong>${esc(a.jobTitle)}</strong> ${ago(a.createdAt)}.`}${a.message ? `<blockquote>${nl2br(a.message)}</blockquote>` : ""}</div>`;
    let lastDay = "";
    body.innerHTML = intro + msgs.map((m) => {
      const day = new Date(m.createdAt).toDateString(); const sep = day !== lastDay ? `<p class="day">${new Date(m.createdAt).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}</p>` : ""; lastDay = day;
      return `${sep}<div class="msg ${m.fromUid === me ? "mine" : "theirs"}"><p>${nl2br(m.text)}</p><small>${m.pending ? "Sending…" : fmt(m.createdAt)}</small></div>`;
    }).join("");
    if (msgs.length !== lastCount) { body.scrollTop = body.scrollHeight; lastCount = msgs.length; }
    store.markSeen(a);
  });
  // Keep the countdown and status fresh.
  const tick = setInterval(async () => { if (!$("#chat-form")) return clearInterval(tick); const fresh = await store.getApplication(a.id); if (fresh) { a = fresh; paintState(); } }, 60000);
  input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 140) + "px"; });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !CAN_SMS) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim(); if (!text || input.disabled) return;
    input.value = ""; input.style.height = "auto";
    try { await store.sendMessage(a, text); a = (await store.getApplication(a.id)) || a; }
    catch (err) {
      console.error(err); input.value = text;
      toast(err.code === "limit-reached" ? limitMsg.messages : err.code === "too-fast" ? "Slow down a little. Wait a moment before sending again." : err.code === "permission-denied" ? "This chat is closed, so the message wasn't sent." : "Message not sent. Check your connection.");
      const fresh = await store.getApplication(a.id); if (fresh) { a = fresh; paintState(); }
    }
  });
  if (!CAN_SMS) input.focus();
}

/* ---------------- Admin ---------------- */
let adminTab = "analytics";
let supportView = "open";
let anRange = 30;
const adminJobs = {};
/* ---------------- Suspended accounts ---------------- */
function viewSuspended(ban) {
  document.title = "Account suspended | Job Search PH";
  app.innerHTML = `<div class="empty suspended">
    <div class="empty-art">${GI.shield}</div>
    <h1>Your account is suspended</h1>
    <p class="muted">You can't post jobs, apply, send messages or edit your profile right now.</p>
    ${ban.reason ? `<p><strong>Reason:</strong> ${esc(ban.reason)}</p>` : ""}
    <p class="muted small">If you think this is a mistake, contact us and we'll review it.</p>
    <p><a class="btn btn-primary" href="#/support">Contact support</a> <button class="btn btn-ghost" id="sus-out">Sign out</button></p></div>`;
  $("#sus-out").addEventListener("click", async () => { await store.signOut(); location.hash = "#/"; });
}

/* ---------------- Admin: users ---------------- */
const BAN_REASONS = ["Scam or asking for money", "Fake or misleading job posts", "Harassment or abusive messages", "Fake profile or impersonation", "Spam", "Underage user", "Other"];
let usersFilter = { q: "", role: "all", sort: "new" };
async function renderUsers(body) {
  body.innerHTML = SK.rows(6);
  let data;
  try { data = await store.adminAll(); } catch (e) { console.error(e); body.innerHTML = `<div class="empty"><p>Couldn't load users (${esc(e.code || e.message)}).</p></div>`; return; }
  const bans = Object.fromEntries(data.bans.map((b) => [b.id, b]));
  const postsBy = {}, appsBy = {}, reportsBy = {};
  data.jobs.forEach((j) => (postsBy[j.ownerUid] = (postsBy[j.ownerUid] || 0) + 1));
  data.apps.forEach((a) => (appsBy[a.applicantUid] = (appsBy[a.applicantUid] || 0) + 1));
  const jobOwner = Object.fromEntries(data.jobs.map((j) => [j.id, j.ownerUid]));
  data.reports.forEach((r) => { const o = jobOwner[r.jobId]; if (o) reportsBy[o] = (reportsBy[o] || 0) + 1; });
  const draw = () => {
    const q = usersFilter.q.trim().toLowerCase();
    let list = data.users.filter((u) => {
      if (usersFilter.role === "banned") { if (!bans[u.id]) return false; }
      else if (usersFilter.role === "reported") { if (!reportsBy[u.id]) return false; }
      else if (usersFilter.role !== "all" && u.role !== usersFilter.role) return false;
      return !q || [u.fullName, u.email, u.phone, u.city, u.companyName, u.id].some((v) => String(v || "").toLowerCase().includes(q));
    });
    list.sort(usersFilter.sort === "name" ? (a, b) => String(a.fullName).localeCompare(String(b.fullName)) : (a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const n = (f) => data.users.filter(f).length;
    const chips = [["all", "All", data.users.length], ["jobseeker", "Jobseekers", n((u) => u.role === "jobseeker")], ["employer", "Employers", n((u) => u.role === "employer")], ["reported", "Reported", n((u) => reportsBy[u.id])], ["banned", "Banned", n((u) => bans[u.id])]];
    body.innerHTML = `
      <div class="us-bar">
        <label class="us-search">${ICON.search}<input type="search" id="us-q" placeholder="Search name, email, phone or city" value="${esc(usersFilter.q)}" autocomplete="off"></label>
        <select id="us-sort" aria-label="Sort"><option value="new" ${usersFilter.sort === "new" ? "selected" : ""}>Newest first</option><option value="name" ${usersFilter.sort === "name" ? "selected" : ""}>Name A–Z</option></select>
      </div>
      <div class="seg-mini us-chips" role="radiogroup">${chips.map(([k, l, c]) => `<button type="button" role="radio" aria-checked="${usersFilter.role === k}" class="${usersFilter.role === k ? "on" : ""}" data-role-f="${k}">${l} <span class="count">${c}</span></button>`).join("")}</div>
      <div class="us-founders"><span>${STAR}<strong>${Object.keys(FOUNDERS).length}</strong> of 100 founding badges given</span>${Object.keys(FOUNDERS).length < 100 && data.users.some((u) => !FOUNDERS[u.id]) ? `<button type="button" class="btn btn-ghost btn-sm" id="award-founders">Give badges to earliest users</button>` : ""}</div>
      <p class="an-sub us-count">${list.length} user${list.length === 1 ? "" : "s"}</p>
      ${list.length ? `<div class="us-list">${list.slice(0, 300).map((u) => `
        <a class="us-row ${bans[u.id] ? "is-banned" : ""}" href="#/admin/user/${encodeURIComponent(u.id)}">
          ${avatar(u.fullName, u.photo, "sm")}
          <span class="us-main"><strong>${esc(u.fullName || "(no name)")}</strong>${u.role === "employer" && u.companyName ? ` <span class="muted">· ${esc(u.companyName)}</span>` : ""}
            <span class="muted small">${esc(u.email || u.phone || "")}${u.city ? ` · ${esc(u.city)}` : ""} · joined ${u.createdAt ? ago(u.createdAt) : "–"}</span></span>
          <span class="us-tags">${founderBadge(u.id, u.role, { short: true })}
            <span class="badge ${u.role === "employer" ? "badge-app-shortlisted" : "badge-app-new"}">${u.role === "employer" ? "Employer" : "Jobseeker"}</span>
            ${u.role === "jobseeker" ? strengthChip(u) : ""}
            <span class="muted small">${u.role === "employer" ? `${postsBy[u.id] || 0} post${postsBy[u.id] === 1 ? "" : "s"}` : `${appsBy[u.id] || 0} application${appsBy[u.id] === 1 ? "" : "s"}`}</span>
            ${reportsBy[u.id] ? `<span class="badge badge-app-shortlisted">${reportsBy[u.id]} report${reportsBy[u.id] === 1 ? "" : "s"}</span>` : ""}
            ${bans[u.id] ? `<span class="badge badge-banned">Banned</span>` : ""}
          </span>
        </a>`).join("")}</div>${list.length > 300 ? `<p class="muted small">Showing the first 300. Search to narrow it down.</p>` : ""}` : `<div class="empty"><p>No users match.</p></div>`}`;
    const qi = $("#us-q");
    qi.addEventListener("input", () => { usersFilter.q = qi.value; const pos = qi.selectionStart; draw(); const n2 = $("#us-q"); n2.focus(); n2.setSelectionRange(pos, pos); });
    $("#us-sort").addEventListener("change", (e) => { usersFilter.sort = e.target.value; draw(); });
    $("#award-founders")?.addEventListener("click", async () => {
      const left = 100 - Object.keys(FOUNDERS).length, without = data.users.filter((u) => !FOUNDERS[u.id]).length;
      const ok = await showDialog({ title: "Give founding badges?", body: `The ${Math.min(left, without)} earliest user${Math.min(left, without) === 1 ? "" : "s"} without a badge will get the next numbers, in the order they signed up. New sign-ups keep getting badges automatically until all 100 are given.`, actions: [{ label: "Cancel", value: false }, { label: "Give badges", value: true, primary: true }] });
      if (!ok) return;
      try { const r = await store.awardFounders(data.users); FOUNDERS = await store.founders(true); toast(`Gave ${r.awarded} badge${r.awarded === 1 ? "" : "s"} (${r.count} of 100 used)`); draw(); }
      catch (e) { console.error(e); toast(e.code === "permission-denied" ? "Couldn't give badges. Publish the latest database rules first." : "Couldn't give badges. Try again."); }
    });
    body.querySelectorAll("[data-role-f]").forEach((b) => b.addEventListener("click", () => { usersFilter.role = b.dataset.roleF; draw(); }));
  };
  draw();
}

async function viewAdminUser(id) {
  document.title = "User | Admin | Job Search PH";
  const { user, isAdmin } = getAuthState();
  if (!user) return goSignIn("Admin sign in");
  if (!isAdmin) { app.innerHTML = `<div class="empty"><h1>Not authorized</h1></div>`; return; }
  app.innerHTML = SK.rows(5);
  let d;
  try { d = await store.adminUser(id); } catch (e) { console.error(e); app.innerHTML = `<div class="empty"><p>Couldn't load this user (${esc(e.code || e.message)}).</p></div>`; return; }
  const u = d.user;
  if (!u) { app.innerHTML = `<div class="empty"><h1>User not found</h1><p class="muted">They may have deleted their profile.</p><p><a class="btn btn-ghost" href="#/admin/users">Back to users</a></p></div>`; return; }
  const ban = d.ban; const isSeeker = u.role === "jobseeker";
  const fact = (k, v) => `<div><dt>${k}</dt><dd>${v || `<span class="none">Not added</span>`}</dd></div>`;
  const m = messengerUrl(u.messenger);
  const live = d.posts.filter((j) => isLive(j));
  const facts = [
    fact("Email", u.email ? `<a href="mailto:${esc(u.email)}">${esc(u.email)}</a>` : ""), fact("Phone", u.phone ? `<span class="copyable">${esc(u.phone)}</span>` : ""),
    fact("Messenger", m ? `<a href="${esc(m)}" target="_blank" rel="noopener nofollow">${esc(u.messenger)}</a>` : ""), fact("City", esc(u.city || "")),
    fact("Joined", u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : ""),
    fact("Last updated", u.updatedAt ? ago(u.updatedAt) : ""),
    ...(isSeeker ? [fact("Age", ageFrom(u.birthDate) != null ? `${ageFrom(u.birthDate)} (born ${esc(u.birthDate)})` : ""), fact("Gender", esc(u.gender || "")),
      fact("Experience", u.experienceYears != null && u.experienceYears !== "" ? `${esc(u.experienceYears)} years` : ""), fact("Can start", esc(u.availability || "")),
      fact("Education", esc(u.education || "")), fact("Resume", safeUrl(u.resumeUrl) ? `<a href="${esc(safeUrl(u.resumeUrl))}" target="_blank" rel="noopener nofollow">Open link</a>` : "")]
      : [fact("Household / business", esc(u.companyName || "")), fact("Job posts", `${d.posts.length} total · ${live.length} live`),
        fact("Facebook", fbHref(u.fbUrl) ? `<a href="${esc(fbHref(u.fbUrl))}" target="_blank" rel="noopener nofollow">${esc(fbHref(u.fbUrl).replace(/^https?:\/\/(www\.)?/, ""))}</a>` : ""),
        fact("Permit / DTI", esc(u.bizReg || ""))]),
    fact("Signs in with", u.signIn === "google" ? "Google" : u.signIn === "facebook" ? "Facebook" : u.signIn === "password" ? `Email &amp; password${u.emailVerified ? " (confirmed)" : " (not confirmed)"}` : ""),
    fact("User ID", `<span class="copyable small">${esc(u.id)}</span>`),
  ];
  const appRow = (a, who) => `<li><a href="#/job/${encodeURIComponent(a.jobId)}">${esc(a.jobTitle)}</a><span class="muted small">${who} · ${ago(a.createdAt)}</span>${appBadge(a.status, true)}</li>`;
  app.innerHTML = `
    <p><a href="#/admin/users" class="back">← Users</a></p>
    <div class="au-wrap">
      <section class="au-main">
        <header class="au-head ${ban ? "is-banned" : ""}">
          ${avatar(u.fullName, u.photo, "lg")}
          <div><h1>${esc(u.fullName || "(no name)")}</h1>
            <p class="muted">${isSeeker ? "Jobseeker" : "Employer"}${u.companyName && !isSeeker ? ` · ${esc(u.companyName)}` : ""}${u.city ? ` · ${esc(u.city)}` : ""}</p>
            <div class="au-tags">${isSeeker ? "" : verifiedBadge(u.id)}${founderBadge(u.id, u.role)}${isSeeker ? strengthChip(u) : ""}${ban ? `<span class="badge badge-banned">Banned</span>` : `<span class="badge badge-approved">Active</span>`}</div></div>
        </header>
        <dl class="ap-facts au-facts">${facts.join("")}</dl>
        ${isSeeker ? `<div class="ap-long au-long">
          <div><span class="label">Jobs they want</span>${wantList(u).length ? `<ul class="meta">${wantList(u).map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : `<p><span class="none">Not added</span></p>`}</div>
          <div><span class="label">Skills</span><p>${u.skills ? esc(u.skills) : `<span class="none">Not added</span>`}</p></div>
          <div><span class="label">Work history</span><p>${u.workHistory ? nl2br(u.workHistory) : `<span class="none">Not added</span>`}</p></div></div>` : ""}
        ${!isSeeker ? `<h2>Job posts (${d.posts.length})</h2>${d.posts.length ? `<ul class="au-list">${d.posts.sort((a, b) => b.createdAt - a.createdAt).map((j) => `<li><a href="#/job/${encodeURIComponent(j.id)}">${esc(j.title)}</a><span class="muted small">${esc(j.city)} · ${salaryText(j)} · ${ago(j.createdAt)} · ${d.received.filter((a) => a.jobId === j.id).length} applicants</span>${statusBadge(j)}</li>`).join("")}</ul>` : `<p class="muted">No posts.</p>`}` : ""}
        ${isSeeker ? `<h2>Applications (${d.applied.length})</h2>${d.applied.length ? `<ul class="au-list">${d.applied.sort((a, b) => b.createdAt - a.createdAt).map((a) => appRow(a, esc(a.employerName || ""))).join("")}</ul>` : `<p class="muted">No applications.</p>`}` : ""}
      </section>
      <aside class="au-side">
        <div class="an-card au-ban">
          ${ban ? `<h3>Banned</h3><p class="small"><strong>Reason:</strong> ${esc(ban.reason)}</p>${ban.note ? `<p class="small muted">${esc(ban.note)}</p>` : ""}<p class="small muted">Since ${ban.bannedAt ? ago(ban.bannedAt) : "–"}</p>
            <button class="btn btn-ghost btn-block" id="au-unban">Lift ban</button>`
          : `<h3>Ban this user</h3><p class="small muted">They'll still be able to sign in, but can't post, apply, message, report or edit their profile. They'll see a "suspended" screen with a link to support.</p>
            <label class="small">Reason<select id="au-reason">${BAN_REASONS.map((r) => `<option>${esc(r)}</option>`).join("")}</select></label>
            <label class="small">Note (optional, shown only to admins)<textarea id="au-note" rows="2" maxlength="500" placeholder="What happened?"></textarea></label>
            ${!isSeeker && live.length ? `<label class="check small"><input type="checkbox" id="au-close" checked><span>Also close their ${live.length} live post${live.length === 1 ? "" : "s"}</span></label>` : ""}
            <button class="btn btn-danger btn-block" id="au-ban">Ban user</button>`}
        </div>
        ${!isSeeker ? `<div class="an-card au-verify">${VERIFIED[id] ? `<h3>${SHIELD} Verified employer</h3><p class="small muted">${esc(VERIFIED[id].method)}${VERIFIED[id].at ? ` · ${ago(VERIFIED[id].at)}` : ""}</p><button class="btn btn-ghost btn-block" id="au-unverify">Remove Verified badge</button>`
          : `<h3>Verify this employer</h3><p class="small muted">Call their number or check their Facebook first. Verified employers get a badge on every post.</p><button class="btn btn-ghost btn-block" id="au-verify">Verify employer</button>`}</div>` : ""}
        ${user.uid === id ? `<p class="small muted">This is your own account.</p>` : ""}
      </aside>
    </div>`;
  $("#au-ban")?.addEventListener("click", async () => {
    if (id === user.uid) return toast("You can't ban yourself.");
    const reason = $("#au-reason").value, note = $("#au-note").value.trim(), closeAll = $("#au-close")?.checked;
    const ok = await showDialog({ title: `Ban ${esc(u.fullName || "this user")}?`, body: `Reason: ${esc(reason)}.${closeAll ? ` Their ${live.length} live post${live.length === 1 ? "" : "s"} will be closed.` : ""} You can lift the ban later.`, actions: [{ label: "Cancel", value: false }, { label: "Ban user", value: true, primary: true }] });
    if (!ok) return;
    try {
      await store.ban(id, { reason, note, name: u.fullName || "" });
      if (closeAll) await Promise.all(live.map(async (j) => { await store.updateJob(j.id, { status: "closed" }); await store.clearReportsFor(j.id).catch(() => {}); }));
      jobsCache = null; toast("User banned"); viewAdminUser(id);
    } catch (e) { console.error(e); toast(e.code === "permission-denied" ? "Couldn't ban. Publish the latest database rules first." : "Couldn't ban. Try again."); }
  });
  $("#au-verify")?.addEventListener("click", async () => {
    const method = await pickDialog({ title: `Verify ${esc(u.fullName || "this employer")}?`, body: "Only verify after you've confirmed they're a real person or business. How did you check?", options: VERIFY_METHODS, confirm: "Verify" });
    if (!method) return;
    try { VERIFIED = await store.verify(id, method.join(", ").slice(0, 60)); toast("Employer verified"); viewAdminUser(id); }
    catch (e) { console.error(e); toast(e.code === "permission-denied" ? "Couldn't verify. Publish the latest database rules first." : "Couldn't verify. Try again."); }
  });
  $("#au-unverify")?.addEventListener("click", async (e) => {
    if (!confirmInline(e.target, "Click again to remove")) return;
    try { VERIFIED = await store.unverify(id); toast("Badge removed"); viewAdminUser(id); } catch { toast("Couldn't remove. Try again."); }
  });
  $("#au-unban")?.addEventListener("click", async () => {
    const ok = await showDialog({ title: "Lift the ban?", body: "They'll be able to use Job Search PH normally again. Closed posts stay closed.", actions: [{ label: "Cancel", value: false }, { label: "Lift ban", value: true, primary: true }] });
    if (!ok) return;
    try { await store.unban(id); toast("Ban lifted"); viewAdminUser(id); } catch (e) { console.error(e); toast("Couldn't lift the ban. Try again."); }
  });
}

/* ---------------- Admin analytics ---------------- */
const DAYMS = 86400000;
const phDayOf = (ms) => Math.floor((ms + 8 * 3600000) / DAYMS);
const dayLabel = (d) => new Date(d * DAYMS).toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const median = (xs) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const fmtN = (n) => Number(n || 0).toLocaleString("en-PH");
const fmtHrs = (h) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} hrs` : `${Math.round(h / 24)} days`);

function anTile(label, value, sub, delta) {
  const d = delta == null ? "" : `<span class="an-delta ${delta > 0 ? "up" : delta < 0 ? "down" : ""}">${delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} ${delta === 0 ? "same" : `${Math.abs(delta)}%`}</span>`;
  return `<div class="an-tile"><span class="an-label">${label}</span><strong class="an-value">${value}</strong><span class="an-sub">${sub || ""} ${d}</span></div>`;
}
// Daily (or weekly) bars, one series. series: [{label, v, tip}]
function anBars(series, { title, sub }) {
  const max = Math.max(1, ...series.map((x) => x.v));
  const total = series.reduce((n, x) => n + x.v, 0);
  const ticks = [0, Math.ceil(max / 2), max];
  const every = Math.ceil(series.length / 6);
  return `<figure class="an-card an-chart"><figcaption><h3>${title}</h3><span class="an-sub">${sub || `${fmtN(total)} total`}</span></figcaption>
    <div class="an-plot"><div class="an-y">${ticks.reverse().map((t) => `<span>${fmtN(t)}</span>`).join("")}</div>
      <div class="an-bars" style="--n:${series.length}">${series.map((x) => `<div class="an-col" data-tip="${esc(x.tip || `${x.label}: ${x.v}`)}"><i style="height:${(x.v / max) * 100}%"></i></div>`).join("")}</div></div>
    <div class="an-x" style="--n:${series.length}">${series.map((x, i) => `<span>${i % every === 0 ? esc(x.label) : ""}</span>`).join("")}</div>
    <details class="an-table"><summary>View as table</summary><table><tbody>${series.filter((x) => x.v).map((x) => `<tr><td>${esc(x.label)}</td><td>${x.v}</td></tr>`).join("") || `<tr><td>No data yet</td></tr>`}</tbody></table></details>
  </figure>`;
}
// Horizontal ranked bars, one series.
function anRank(rows, { title, sub, unit = "" }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return `<div class="an-card"><h3>${title}</h3>${sub ? `<p class="an-sub">${sub}</p>` : ""}
    ${rows.length ? `<ul class="an-rank">${rows.map((r) => `<li data-tip="${esc(`${r.label}: ${r.tipV ?? fmtN(r.v)}${unit}`)}"><span class="an-rl">${esc(r.label)}</span><span class="an-rb"><i style="width:${(r.v / max) * 100}%"></i></span><span class="an-rv">${r.show ?? fmtN(r.v)}${unit}</span></li>`).join("")}</ul>` : `<p class="muted small">No data yet.</p>`}</div>`;
}

async function renderAnalytics(body) {
  body.innerHTML = `<div class="an-grid">${SK.rows(3)}</div>`;
  let data;
  try { data = await store.adminAll(); } catch (e) { console.error(e); body.innerHTML = `<div class="empty"><p>Couldn't load analytics (${esc(e.code || e.message)}).</p></div>`; return; }
  const draw = () => {
    const now = Date.now(); const today = phDayOf(now);
    const R = anRange; const from = R ? now - R * DAYMS : 0; const prevFrom = R ? now - 2 * R * DAYMS : 0;
    const inR = (t) => t && t >= from; const inPrev = (t) => R && t && t >= prevFrom && t < from;
    const delta = (cur, prev) => (!R ? null : prev ? Math.round(((cur - prev) / prev) * 100) : cur ? 100 : 0);
    const { users, jobs, apps, reports, support } = data;
    const seekers = users.filter((u) => u.role === "jobseeker"), employers = users.filter((u) => u.role === "employer");
    const live = jobs.filter((j) => isLive(j)), pending = jobs.filter((j) => j.status === "pending");
    const newUsers = users.filter((u) => inR(u.createdAt)), prevUsers = users.filter((u) => inPrev(u.createdAt));
    const newJobs = jobs.filter((j) => inR(j.createdAt)), prevJobs = jobs.filter((j) => inPrev(j.createdAt));
    const rApps = apps.filter((a) => inR(a.createdAt)), prevApps = apps.filter((a) => inPrev(a.createdAt));
    const hiredT = (a) => a.acceptedAt || a.updatedAt;
    const hires = apps.filter((a) => a.status === "hired" && inR(hiredT(a))), prevHires = apps.filter((a) => a.status === "hired" && inPrev(hiredT(a)));
    const responded = rApps.filter((a) => a.status !== "new");
    const respTimes = responded.map((a) => (a.updatedAt - a.createdAt) / 3600000).filter((h) => h > 0);
    const offersDone = apps.filter((a) => ["hired", "offer_declined"].includes(a.status) && inR(a.updatedAt));
    const accepted = offersDone.filter((a) => a.status === "hired").length;
    const postsWithApps = new Set(apps.map((a) => a.jobId));
    const approvedEver = jobs.filter((j) => j.approvedAt);
    const fillRate = pct(new Set(apps.filter((a) => a.status === "hired").map((a) => a.jobId)).size, approvedEver.length);
    const chatsActive = apps.filter((a) => a.lastMessageAt && a.lastMessageAt >= now - 7 * DAYMS).length;
    const activeSeekers = new Set(rApps.map((a) => a.applicantUid)).size;

    // daily series
    const span = R || Math.max(7, today - Math.min(today, ...users.map((u) => phDayOf(u.createdAt || now)), ...jobs.map((j) => phDayOf(j.createdAt || now))) + 1);
    const weekly = span > 90; const step = weekly ? 7 : 1; const buckets = Math.ceil(span / step);
    const series = (items, t, split) => Array.from({ length: buckets }, (_, i) => {
      const end = today - (buckets - 1 - i) * step, start = end - step + 1;
      const hit = items.filter((x) => { const d = t(x) ? phDayOf(t(x)) : null; return d != null && d >= start && d <= end; });
      const label = weekly ? `Wk of ${dayLabel(start)}` : dayLabel(end);
      return { label, v: hit.length, tip: `${label}: ${hit.length}${split ? split(hit) : ""}` };
    });
    const splitRole = (hit) => { const s = hit.filter((u) => u.role === "jobseeker").length; return ` (${s} jobseeker${s === 1 ? "" : "s"}, ${hit.length - s} employer${hit.length - s === 1 ? "" : "s"})`; };

    // breakdowns
    const countBy = (xs, key) => { const m = new Map(); xs.forEach((x) => { const k = key(x); if (k) m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].map(([label, v]) => ({ label, v })).sort((a, b) => b.v - a.v); };
    const jobsById = Object.fromEntries(jobs.map((j) => [j.id, j]));
    const catJobs = countBy(newJobs.length ? newJobs : jobs, (j) => j.category).slice(0, 8);
    const catApps = countBy(rApps, (a) => jobsById[a.jobId]?.category).slice(0, 8);
    const cityJobs = countBy(live, (j) => j.city).slice(0, 8);
    const citySeekers = countBy(seekers, (u) => u.city).slice(0, 8);
    const appsPer = (j) => apps.filter((a) => a.jobId === j.id).length;
    const topJobs = live.map((j) => ({ label: `${j.title} · ${j.city}`, v: appsPer(j) })).sort((a, b) => b.v - a.v).slice(0, 6);
    const payRows = countBy(jobs.filter((j) => j.salaryMin), (j) => j.category).slice(0, 8).map((r) => {
      const m = median(jobs.filter((j) => j.category === r.label && j.salaryMin).map(monthlyEquivalent));
      return { label: r.label, v: m, show: `₱${fmtN(Math.round(m))}`, tipV: `₱${fmtN(Math.round(m))}/month median (${r.v} post${r.v === 1 ? "" : "s"})` };
    }).sort((a, b) => b.v - a.v);
    const levels = ["Weak", "Good", "Great", "Excellent"]; const lv = { Weak: 0, Good: 0, Great: 0, Excellent: 0 };
    seekers.forEach((u) => lv[profileStrength(u).level]++);
    const photoPct = pct(seekers.filter((u) => u.photo).length, seekers.length);

    // "Other" categories typed by employers (normalized so "tutor" and "Tutor " count together)
    const otherJobs = jobs.filter((j) => j.category === "Other" && j.categoryOther);
    const otherTotal = otherJobs.length;
    const otherMap = new Map(); otherJobs.forEach((j) => { const k = j.categoryOther.trim().toLowerCase().replace(/\s+/g, " "); const e = otherMap.get(k) || { label: j.categoryOther.trim().replace(/^./, (c) => c.toUpperCase()), v: 0 }; e.v++; otherMap.set(k, e); });
    const otherTypes = [...otherMap.values()].sort((a, b) => b.v - a.v).slice(0, 10);
    const otherLatest = [...otherJobs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
    const seekOther = new Map(); seekers.filter((u) => u.jobCategoryOther).forEach((u) => { const k = u.jobCategoryOther.trim().toLowerCase().replace(/\s+/g, " "); const e = seekOther.get(k) || { label: u.jobCategoryOther.trim().replace(/^./, (c) => c.toUpperCase()), v: 0 }; e.v++; seekOther.set(k, e); });
    const seekOtherRows = [...seekOther.values()].sort((a, b) => b.v - a.v).slice(0, 10);
    // sources (?src= links): sign-ups in range, and what those people did
    const srcOf = Object.fromEntries(users.map((u) => [u.id, u.src || ""]));
    const srcRows = new Map();
    const row = (k) => { if (!srcRows.has(k)) srcRows.set(k, { src: k, users: 0, seekers: 0, employers: 0, posts: 0, apps: 0 }); return srcRows.get(k); };
    newUsers.forEach((u) => { const r = row(u.src || ""); r.users++; if (u.role === "employer") r.employers++; else r.seekers++; });
    newJobs.forEach((j) => { if (srcOf[j.ownerUid] !== undefined) row(srcOf[j.ownerUid]).posts++; });
    rApps.forEach((a) => { if (srcOf[a.applicantUid] !== undefined) row(srcOf[a.applicantUid]).apps++; });
    const sources = [...srcRows.values()].sort((a, b) => b.users - a.users || b.posts + b.apps - (a.posts + a.apps));
    const tracked = sources.filter((r) => r.src).reduce((n, r) => n + r.users, 0);

    // funnel (applications in range, by furthest stage reached)
    const reached = (a, stages) => stages.includes(a.status);
    const funnel = [
      ["Applied", rApps.length],
      ["Employer responded", responded.length],
      ["Shortlisted or further", rApps.filter((a) => reached(a, ["shortlisted", "offered", "hired", "offer_declined"])).length],
      ["Offered the job", rApps.filter((a) => reached(a, ["offered", "hired", "offer_declined"])).length],
      ["Hired", rApps.filter((a) => a.status === "hired").length],
    ];

    // needs attention
    const noApps = live.filter((j) => !postsWithApps.has(j.id) && now - (j.approvedAt || j.createdAt) > 3 * DAYMS);
    const waiting = new Map(); apps.filter((a) => a.status === "new" && now - a.createdAt > 3 * DAYMS).forEach((a) => waiting.set(a.jobId, (waiting.get(a.jobId) || 0) + 1));
    const expiring = live.filter((j) => j.expiresAt && j.expiresAt - now < 5 * DAYMS);
    const oldPending = pending.filter((j) => now - j.createdAt > DAYMS);
    const att = [
      ...oldPending.map((j) => [`Waiting for review over a day`, j, `submitted ${ago(j.createdAt)}`]),
      ...[...waiting.entries()].map(([id, n]) => [`${n} applicant${n === 1 ? "" : "s"} unanswered 3+ days`, jobsById[id], "employer hasn't responded"]).filter((x) => x[1]),
      ...noApps.map((j) => ["No applicants after 3+ days", j, `live ${ago(j.approvedAt || j.createdAt)}`]),
      ...expiring.map((j) => ["Expires within 5 days", j, `expires ${new Date(j.expiresAt).toLocaleDateString("en-PH")}`]),
    ].slice(0, 12);

    const rangeLbl = R ? `last ${R} days` : "all time";
    body.innerHTML = `
      <div class="an-bar">
        <div class="seg-mini" role="radiogroup" aria-label="Time range">${[[7, "7 days"], [30, "30 days"], [90, "90 days"], [0, "All time"]].map(([v, l]) => `<button type="button" role="radio" aria-checked="${R === v}" class="${R === v ? "on" : ""}" data-range="${v}">${l}</button>`).join("")}</div>
        <span class="an-sub">Updated ${new Date().toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })} · <button type="button" class="linkbtn" id="an-refresh">Refresh</button> · <button type="button" class="linkbtn" id="an-csv">Download CSV</button></span>
      </div>
      <h2 class="an-h">Overview <span class="an-sub">${rangeLbl}${R ? ", compared with the period before" : ""}</span></h2>
      <div class="an-tiles">
        ${anTile("New users", fmtN(newUsers.length), `${fmtN(users.length)} total`, delta(newUsers.length, prevUsers.length))}
        ${anTile("Jobseekers", fmtN(seekers.length), `${fmtN(newUsers.filter((u) => u.role === "jobseeker").length)} new`)}
        ${anTile("Employers", fmtN(employers.length), `${fmtN(newUsers.filter((u) => u.role === "employer").length)} new`)}
        ${anTile("Live jobs", fmtN(live.length), `${fmtN(pending.length)} waiting review`)}
        ${anTile("New posts", fmtN(newJobs.length), `${fmtN(jobs.length)} all time`, delta(newJobs.length, prevJobs.length))}
        ${anTile("Applications", fmtN(rApps.length), `${fmtN(activeSeekers)} jobseekers applied`, delta(rApps.length, prevApps.length))}
        ${anTile("Hires", fmtN(hires.length), `${fillRate}% of approved posts filled`, delta(hires.length, prevHires.length))}
        ${anTile("Employer response", `${pct(responded.length, rApps.length)}%`, respTimes.length ? `median ${fmtHrs(median(respTimes))} to respond` : "of applications answered")}
        ${anTile("Offer acceptance", offersDone.length ? `${pct(accepted, offersDone.length)}%` : "–", `${accepted} of ${offersDone.length} offers accepted`)}
        ${anTile("Applicants per post", approvedEver.length ? (apps.length / approvedEver.length).toFixed(1) : "–", `${fmtN(chatsActive)} chats active this week`)}
        ${anTile("Open reports", fmtN(reports.length), reports.length ? `<a href="#/admin" data-goto-tab="reports">Review</a>` : "all clear")}
        ${anTile("Support inbox", fmtN(support.filter((m) => m.status !== "done").length), support.some((m) => m.status !== "done") ? `<a href="#/admin" data-goto-tab="support">Reply</a>` : "all clear")}
      </div>
      <h2 class="an-h">Growth <span class="an-sub">${weekly ? "per week" : "per day"}, ${rangeLbl}</span></h2>
      <div class="an-grid three">
        ${anBars(series(users, (u) => u.createdAt, splitRole), { title: "Sign-ups" })}
        ${anBars(series(jobs, (j) => j.createdAt), { title: "Job posts submitted" })}
        ${anBars(series(apps, (a) => a.createdAt), { title: "Applications" })}
      </div>
      <h2 class="an-h">Hiring <span class="an-sub">applications from the ${rangeLbl}</span></h2>
      <div class="an-grid two">
        <div class="an-card"><h3>Hiring funnel</h3><p class="an-sub">How far applications got</p>
          <ul class="an-funnel">${funnel.map(([l, v], i) => `<li data-tip="${esc(`${l}: ${v} (${pct(v, funnel[0][1])}% of applications)`)}"><span class="an-rl">${l}</span><span class="an-rb"><i style="width:${funnel[0][1] ? (v / funnel[0][1]) * 100 : 0}%"></i></span><span class="an-rv">${fmtN(v)} <em>${i ? `${pct(v, funnel[0][1])}%` : ""}</em></span></li>`).join("")}</ul></div>
        ${anRank(topJobs, { title: "Most-applied live jobs", sub: "All-time applicants" })}
      </div>
      <h2 class="an-h">What's in demand</h2>
      <div class="an-grid two">
        ${anRank(catJobs, { title: "Posts by category", sub: newJobs.length ? rangeLbl : "all time" })}
        ${anRank(catApps, { title: "Applications by category", sub: rangeLbl })}
        ${anRank(cityJobs, { title: "Live jobs by city" })}
        ${anRank(citySeekers, { title: "Jobseekers by city" })}
        ${anRank(payRows, { title: "Median monthly pay by category", sub: "Day and hourly pay converted to monthly" })}
        <div class="an-card"><h3>Jobseeker profile quality</h3><p class="an-sub">${photoPct}% have a profile photo</p>
          <div class="an-stack" role="img" aria-label="${levels.map((l) => `${l} ${lv[l]}`).join(", ")}">${levels.map((l) => lv[l] ? `<i class="s-${l.toLowerCase()}" style="flex:${lv[l]}" data-tip="${l}: ${lv[l]} (${pct(lv[l], seekers.length)}%)"></i>` : "").join("") || `<i class="empty-bar" style="flex:1"></i>`}</div>
          <ul class="an-legend">${levels.map((l) => `<li><span class="sw s-${l.toLowerCase()}"></span>${l} <strong>${lv[l]}</strong> <em>${pct(lv[l], seekers.length)}%</em></li>`).join("")}</ul></div>
      </div>
      <h2 class="an-h">Where users come from <span class="an-sub">sign-ups in the ${rangeLbl}, by the link they first arrived from</span></h2>
      <div class="an-grid two">
        <div class="an-card"><h3>Sources</h3><p class="an-sub">${newUsers.length ? `${pct(tracked, newUsers.length)}% of new sign-ups came from a tracked link` : "No sign-ups in this period"}</p>
          ${sources.length ? `<div class="an-tablewrap"><table class="an-src"><thead><tr><th>Source</th><th>Sign-ups</th><th>Jobseekers</th><th>Employers</th><th>Posts</th><th>Applications</th></tr></thead><tbody>${sources.map((r) => `<tr><td>${r.src ? esc(r.src) : `<span class="muted">Direct / unknown</span>`}</td><td>${r.users}</td><td>${r.seekers}</td><td>${r.employers}</td><td>${r.posts}</td><td>${r.apps}</td></tr>`).join("")}</tbody></table></div>` : ""}</div>
        <div class="an-card"><h3>Make a tracked link</h3><p class="an-sub">Use a different name for each Facebook post or group, then compare them here.</p>
          <label class="small">Name<input id="src-name" maxlength="40" placeholder="e.g. fb-bacolod-jobs-group-oct27"></label>
          <label class="small">Page<select id="src-page"><option value="">Home (find jobs)</option><option value="#/post">Post a job</option><option value="#/signin">Sign up</option></select></label>
          <div class="src-out"><code id="src-link">https://jobsearchph.com/?src=…</code><button type="button" class="btn btn-primary btn-sm" id="src-copy">Copy</button></div>
          <p class="an-sub">Links people share from a job's Share button are tracked as <strong>share</strong>.</p></div>
      </div>
      <h2 class="an-h">"Other" job types <span class="an-sub">what people typed when no category fit, all time — promote the common ones to real categories</span></h2>
      <div class="an-grid two">${anRank(otherTypes, { title: "Employers are hiring for", sub: otherTypes.length ? `${otherTotal} post${otherTotal === 1 ? "" : "s"} used “Other”` : "" })}
        ${anRank(seekOtherRows, { title: "Jobseekers are looking for", sub: seekOtherRows.length ? `${seekers.filter((u) => u.jobCategoryOther).length} jobseeker${seekers.filter((u) => u.jobCategoryOther).length === 1 ? "" : "s"} picked “Other”` : "" })}
        <div class="an-card"><h3>Latest entries</h3>${otherLatest.length ? `<ul class="an-att">${otherLatest.map((j) => `<li><span class="an-why">${esc(j.categoryOther)}</span><a href="#/job/${encodeURIComponent(j.id)}">${esc(j.title)}</a><span class="muted small">${esc(j.city)} · ${ago(j.createdAt)}</span></li>`).join("")}</ul>` : `<p class="muted small">No “Other” posts yet.</p>`}</div></div>
      <h2 class="an-h">Needs attention <span class="an-sub">${att.length ? `${att.length} item${att.length === 1 ? "" : "s"}` : ""}</span></h2>
      <div class="an-card">${att.length ? `<ul class="an-att">${att.map(([why, j, when]) => `<li><span class="an-why">${esc(why)}</span><a href="#/job/${encodeURIComponent(j.id)}">${esc(j.title)}</a><span class="muted small">${esc(j.employerName || "")} · ${esc(j.city)} · ${esc(when)}</span></li>`).join("")}</ul>` : `<p class="muted">Nothing needs attention right now.</p>`}</div>
      <div id="an-tip" class="an-tip" hidden></div>`;

    body.querySelectorAll("[data-range]").forEach((b) => b.addEventListener("click", () => { anRange = Number(b.dataset.range); draw(); }));
    body.querySelectorAll("[data-goto-tab]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); adminTab = a.dataset.gotoTab; viewAdmin(); }));
    $("#an-refresh").addEventListener("click", () => renderAnalytics(body));
    const srcLink = () => { const n = $("#src-name").value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40); return `https://jobsearchph.com/?src=${n || "…"}${$("#src-page").value}`; };
    const paintSrc = () => { $("#src-link").textContent = srcLink(); };
    $("#src-name").addEventListener("input", paintSrc); $("#src-page").addEventListener("change", paintSrc);
    $("#src-copy").addEventListener("click", async () => { if (!$("#src-name").value.trim()) { toast("Give the link a name first"); return $("#src-name").focus(); } try { await navigator.clipboard.writeText(srcLink()); toast("Link copied"); } catch { toast("Copy failed. Select the link and copy it."); } });
    $("#an-csv").addEventListener("click", () => {
      const rows = [["Job ID", "Title", "Employer", "Category", "Other type", "City", "Workplace", "Status", "Posted", "Pay (monthly equiv.)", "Applicants", "Hired"]].concat(jobs.map((j) => [j.id, j.title, j.employerName, j.category, j.categoryOther || "", j.city, j.workplace, j.status, j.createdAt ? new Date(j.createdAt).toISOString().slice(0, 10) : "", Math.round(monthlyEquivalent(j)), appsPer(j), apps.filter((a) => a.jobId === j.id && a.status === "hired").length]));
      const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `jsph-jobs-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    const tip = $("#an-tip");
    body.onpointermove = (e) => {
      const t = e.target.closest("[data-tip]"); if (!t) { tip.hidden = true; return; }
      tip.textContent = t.dataset.tip; tip.hidden = false;
      const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8); tip.style.left = `${x}px`; tip.style.top = `${e.clientY - tip.offsetHeight - 12}px`;
    };
    body.onpointerleave = () => { tip.hidden = true; };
  };
  draw();
}

async function viewAdmin() {
  document.title = "Admin | Job Search PH";
  const { user, isAdmin } = getAuthState();
  if (!user) return goSignIn("Admin sign in");
  if (!isAdmin) { app.innerHTML = `<div class="empty"><h1>Not authorized</h1><p class="muted">This account is not an admin.</p></div>`; return; }
  const tabs = { analytics: "Analytics", users: "Users", pending: "Pending", approved: "Live", reports: "Reports", support: "Support", rejected: "Rejected", closed: "Closed" };
  app.innerHTML = `
    <div class="page-head"><h1>Admin</h1></div>
    <div class="tabs" role="tablist">${Object.entries(tabs).map(([k, v]) => `<button role="tab" class="tab ${adminTab === k ? "active" : ""}" data-tab="${k}">${v}${k === "pending" && pendingForAdmin ? ` <span class="count">${pendingForAdmin}</span>` : ""}</button>`).join("")}</div>
    <div id="admin-body">${SK.rows(4)}</div>`;
  app.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { adminTab = b.dataset.tab; viewAdmin(); }));

  const body = $("#admin-body");
  if (adminTab === "analytics") return renderAnalytics(body);
  if (adminTab === "users") return renderUsers(body);
  if (adminTab === "support") {
    const items = await store.listSupport();
    const open = items.filter((m) => m.status !== "done"), done = items.filter((m) => m.status === "done");
    const list = supportView === "done" ? done : supportView === "all" ? items : open;
    const when = (t) => (t ? new Date(t).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");
    body.innerHTML = `
      <div class="seg-mini sp-tabs" role="radiogroup">${[["open", "Open", open.length], ["done", "Done", done.length], ["all", "All", items.length]].map(([k, l, n]) => `<button type="button" role="radio" aria-checked="${supportView === k}" class="${supportView === k ? "on" : ""}" data-sview="${k}">${l} <span class="count">${n}</span></button>`).join("")}</div>
      ${list.length ? `<div class="sp-list">${list.map((m) => `
        <article class="sp-item ${m.status === "done" ? "is-done" : ""}">
          <header><strong>${esc(m.topic)}</strong>${m.status === "done" ? `<span class="badge badge-closed">Done${m.doneAt ? ` · ${ago(m.doneAt)}` : ""}</span>` : `<span class="badge badge-app-new">Open</span>`}<span class="muted small sp-when">${when(m.createdAt)}</span></header>
          <p class="sp-msg">${nl2br(m.message)}</p>
          <p class="small muted sp-from">From <strong>${esc(m.name)}</strong> · ${/@/.test(m.reply || "") ? `<a href="mailto:${esc(m.reply)}?subject=${encodeURIComponent(`Re: ${m.topic} — Job Search PH`)}">${esc(m.reply)}</a>` : `<span class="copyable">${esc(m.reply)}</span>`}${m.uid ? ` · <a href="#/admin/user/${encodeURIComponent(m.uid)}">View account</a>` : " · not signed in"}${m.page ? ` · sent from ${esc(m.page)}` : ""}</p>
          <div class="actions">${/@/.test(m.reply || "") ? `<a class="btn btn-primary btn-sm" href="mailto:${esc(m.reply)}?subject=${encodeURIComponent(`Re: ${m.topic} — Job Search PH`)}">Reply by email</a>` : ""}
            ${m.status === "done" ? `<button class="btn btn-ghost btn-sm" data-act="supportreopen" data-id="${esc(m.id)}">Reopen</button>` : `<button class="btn btn-ghost btn-sm" data-act="supportdone" data-id="${esc(m.id)}">Mark done</button>`}</div>
        </article>`).join("")}</div>`
      : `<div class="empty"><p>${supportView === "done" ? "Nothing marked done yet." : supportView === "all" ? "No support messages yet." : "No open support messages. 🎉"}</p></div>`}`;
    body.querySelectorAll("[data-sview]").forEach((b) => b.addEventListener("click", () => { supportView = b.dataset.sview; viewAdmin(); }));
  } else if (adminTab === "reports") {
    const reports = await store.listReports();
    const jobs = {};
    await Promise.all([...new Set(reports.map((r) => r.jobId))].map(async (id) => { jobs[id] = await store.getJob(id); }));
    body.innerHTML = reports.length ? `<div class="table">${reports.map((r) => {
      const j = jobs[r.jobId];
      const title = j ? `<a href="#/job/${encodeURIComponent(r.jobId)}"><strong>${esc(j.title)}</strong></a> ${statusBadge(j)}` : `<strong class="muted">Job deleted</strong>`;
      return `
      <div class="trow">
        <div>${title}<div class="small">${esc(REPORT_REASONS[r.reason] || r.reason)}</div>${r.details ? `<div class="muted small">“${esc(r.details)}”</div>` : ""}<div class="muted small">${ago(r.createdAt)}</div></div>
        <div class="actions">${j && j.status !== "closed" ? `<button class="btn btn-danger btn-sm" data-act="closejob" data-id="${esc(r.jobId)}">Close job</button>` : ""}<button class="btn btn-ghost btn-sm" data-act="dismiss" data-id="${esc(r.id)}">Dismiss</button></div>
      </div>`; }).join("")}</div>` : `<div class="empty"><p>No reports.</p></div>`;
  } else {
    const [list0, ctx] = await Promise.all([store.listByStatus(adminTab), store.adminAll().catch(() => null)]);
    const list = list0.sort((a, b) => b.createdAt - a.createdAt);
    list.forEach((j) => (adminJobs[j.id] = j));
    if (ctx) VERIFIED = Object.fromEntries(ctx.verified.map((v) => [v.id, v]));
    const users = ctx ? Object.fromEntries(ctx.users.map((u) => [u.id, u])) : {};
    const contacts = {};
    if (adminTab === "pending") await Promise.all(list.map(async (j) => { contacts[j.id] = await store.getContact(j.id); }));
    if (adminTab === "pending" && pendingForAdmin !== list.length) { pendingForAdmin = list.length; renderBell(); renderNav(); }
    const empPanel = (j) => {
      const o = users[j.ownerUid]; const c = contacts[j.id];
      const flags = ctx ? riskFlags(j, o, ctx) : [];
      const bad = flags.filter((x) => x[0] === "bad").length;
      const fb = fbHref(o?.fbUrl); const m = messengerUrl(o?.messenger);
      const posts = ctx ? ctx.jobs.filter((x) => x.ownerUid === j.ownerUid) : [];
      const row = (k, v) => `<div><dt>${k}</dt><dd>${v || `<span class="none">Not given</span>`}</dd></div>`;
      return `<section class="ec ${bad ? "is-bad" : flags.length ? "is-warn" : "is-ok"}">
        <header><h4>Employer check</h4>${VERIFIED[j.ownerUid] ? `${verifiedBadge(j.ownerUid)}<span class="muted small">${esc(VERIFIED[j.ownerUid].method)}</span>` : `<span class="ec-score">${bad ? `${bad} red flag${bad === 1 ? "" : "s"}` : flags.length ? `${flags.length} thing${flags.length === 1 ? "" : "s"} to check` : "No warning signs"}</span>`}
          ${o ? `<a class="small" href="#/admin/user/${encodeURIComponent(o.id)}">Full profile →</a>` : ""}</header>
        ${o ? `<dl class="ec-facts">
          ${row("Account", `${esc(o.fullName || "")}${o.companyName ? ` · ${esc(o.companyName)}` : ""} ${founderBadge(o.id, "employer", { short: true })}`)}
          ${row("Joined", o.createdAt ? `${new Date(o.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} (${ago(o.createdAt)})` : "")}
          ${row("Phone", o.phone ? `<a href="tel:${esc(digits(o.phone))}">${esc(o.phone)}</a>` : "")}
          ${row("Email", o.email ? `<a href="mailto:${esc(o.email)}">${esc(o.email)}</a> <span class="muted small">${o.signIn === "google" ? "· Google account" : o.signIn === "facebook" ? "· Facebook account" : o.signIn === "password" ? (o.emailVerified ? "· confirmed" : "· not confirmed") : ""}</span>` : "")}
          ${row("Facebook", fb ? `<a href="${esc(fb)}" target="_blank" rel="noopener nofollow">${esc(fb.replace(/^https?:\/\/(www\.)?/, ""))}</a>` : "")}
          ${row("Messenger", m ? `<a href="${esc(m)}" target="_blank" rel="noopener nofollow">${esc(o.messenger)}</a>` : "")}
          ${row("Permit / DTI", esc(o.bizReg || ""))}
          ${row("Lives in", esc(o.city || ""))}
          ${row("Posts", `${posts.length} total · ${posts.filter(isLive).length} live · ${posts.filter((x) => x.status === "rejected").length} rejected`)}
          ${adminTab === "pending" ? row("Applicant contact", c ? `${esc(c.contactMethod)} — ${esc(c.contactValue)}` : "") + (c?.address ? row("Private address", esc(c.address)) : "") : ""}
        </dl>` : ""}
        ${flags.length ? `<ul class="ec-flags">${flags.map(([lv, t]) => `<li class="${lv}">${t}</li>`).join("")}</ul>` : ""}
        ${j.infoNote ? `<p class="ec-asked small"><strong>You asked ${j.infoAt ? ago(j.infoAt) : ""}:</strong> ${esc(j.infoNote)}</p>` : ""}
      </section>`;
    };
    body.innerHTML = list.length ? list.map((j) => `
      <div class="admin-item">
        <div><strong>${esc(j.title)}</strong> ${statusBadge(j)} ${j.featured ? `<span class="badge badge-featured">Featured</span>` : ""}${j.infoNote && j.status === "pending" ? ` <span class="badge badge-app-shortlisted">Waiting for employer</span>` : ""}
          <div class="muted small">${esc(j.employerName)} · ${esc(j.city)} · ${esc(j.category)}${j.categoryOther ? ` (${esc(j.categoryOther)})` : ""} · ${esc(j.employmentType)} · ${salaryText(j)} · submitted ${ago(j.createdAt)}</div></div>
        ${adminTab === "pending" ? empPanel(j) : ""}
        <details data-contact="${esc(j.id)}" ${adminTab === "pending" ? "open" : ""}><summary>${adminTab === "pending" ? "Job details" : "View details"}</summary>
          <p>${nl2br(j.description)}</p>${j.requirements ? `<p class="small"><strong>Requirements:</strong><br>${nl2br(j.requirements)}</p>` : ""}
          ${adminTab !== "pending" ? `<p class="small contact-line"><strong>Contact:</strong> <span>loading…</span></p>${empPanel(j)}` : ""}
        </details>
        <div class="actions">
          ${j.status !== "approved" ? `<button class="btn btn-primary btn-sm" data-act="approve" data-id="${esc(j.id)}">${j.status === "pending" ? "Approve" : "Re-publish"}</button>` : `<button class="btn btn-ghost btn-sm" data-act="approve" data-id="${esc(j.id)}">Renew 30 days</button>`}
          ${j.status === "pending" ? `<button class="btn btn-ghost btn-sm" data-act="askinfo" data-id="${esc(j.id)}">Ask for more info</button><button class="btn btn-ghost btn-sm" data-act="reject" data-id="${esc(j.id)}">Reject</button>` : ""}
          ${VERIFIED[j.ownerUid] ? "" : `<button class="btn btn-ghost btn-sm" data-act="verify" data-id="${esc(j.id)}">Verify employer</button>`}
          ${j.status === "approved" ? `<button class="btn btn-ghost btn-sm" data-act="feature" data-id="${esc(j.id)}" data-on="${j.featured ? 1 : 0}">${j.featured ? "Unfeature" : "Feature"}</button><button class="btn btn-ghost btn-sm" data-act="closejob" data-id="${esc(j.id)}">Close</button>` : ""}
          <button class="btn btn-danger btn-sm" data-act="delete" data-id="${esc(j.id)}">Delete</button>
        </div>
      </div>`).join("") : `<div class="empty"><p>Nothing here.</p></div>`;
    body.querySelectorAll("details[data-contact]").forEach((d) => d.addEventListener("toggle", async () => {
      if (!d.open || d.dataset.loaded || !d.querySelector(".contact-line")) return; d.dataset.loaded = 1;
      const c = await store.getContact(d.dataset.contact);
      d.querySelector(".contact-line span").textContent = c ? `${c.contactMethod} — ${c.contactValue}${c.address ? ` · Private address: ${c.address}` : ""}` : "not set";
    }));
  }

  body.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const { act, id } = b.dataset;
    if ((act === "delete" || act === "closejob") && !confirmInline(b)) return;
    try {
      const aj = adminJobs[id];
      if (act === "verify") {
        if (!aj) return;
        const method = await pickDialog({ title: "Verify this employer?", body: `Only verify after you've confirmed they're a real person or business. A <strong>Verified</strong> badge will show on all their posts. How did you check?`, options: VERIFY_METHODS, confirm: "Verify" });
        if (!method) return;
        await store.verify(aj.ownerUid, method.join(", ").slice(0, 60));
        VERIFIED = await store.verifiedList(); toast("Employer verified"); return viewAdmin();
      }
      if (act === "askinfo") {
        if (!aj) return;
        const picked = await pickDialog({ title: "Ask the employer for more info", body: "The post stays in Pending. They'll get a notification and can reply through support or update their profile.", options: INFO_ASKS, multi: true, other: "Anything else? (optional)", confirm: "Send request" });
        if (!picked) return;
        const note = picked.join("; ").slice(0, 300);
        await store.askInfo(id, note);
        store.notify(aj.ownerUid, { type: "job_info", title: "We need a bit more before approving your post", body: `${aj.title}: please send ${note}`.slice(0, 300), link: "#/my", jobId: id }).catch(() => {});
        toast("Request sent"); return viewAdmin();
      }
      if (act === "approve") {
        await store.approve(id);
        if (aj) store.notify(aj.ownerUid, { type: "job_approved", title: "Your job post is live", body: `${aj.title} is now visible to jobseekers for 30 days.`, link: `#/job/${id}`, jobId: id }).catch(() => {});
      }
      if (act === "reject") {
        await store.updateJob(id, { status: "rejected" });
        if (aj) store.notify(aj.ownerUid, { type: "job_rejected", title: "Your job post wasn't approved", body: `${aj.title} didn't meet our posting rules. Check the pay, details and contact, then post again.`, link: "#/my", jobId: id }).catch(() => {});
      }
      if (act === "closejob") { await store.updateJob(id, { status: "closed" }); await store.clearReportsFor(id); }
      if (act === "feature") await store.updateJob(id, { featured: b.dataset.on !== "1" });
      if (act === "delete") { await store.deleteJob(id); await store.clearReportsFor(id); }
      if (act === "dismiss") await store.dismissReport(id);
      if (act === "supportdone") await store.closeSupport(id);
      if (act === "supportreopen") await store.reopenSupport(id);
      jobsCache = null; toast("Done"); viewAdmin();
    } catch (err) { console.error(err); toast("Action failed: " + (err.code || err.message)); }
  });
}

/* ---------------- Support ---------------- */
let supportPrefill = null;
function viewSupport() {
  document.title = "Contact support | Job Search PH";
  const pre = supportPrefill; supportPrefill = null;
  const { user, profile } = getAuthState();
  const topics = ["Problem with my account", "A job post or employer", "An applicant", "Something isn't working", "Suggestion", "Other"];
  app.innerHTML = `
    <div class="page-head"><div><p class="kicker">Help</p><h1>Contact support</h1><p class="muted">We usually reply within a day. Reach us the way that's easiest for you.</p></div></div>
    <div class="contact-cards">
      <a class="ccard" href="mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Job Search PH support")}"><strong>Email us</strong><span class="copyable">${SUPPORT_EMAIL}</span></a>
      <a class="ccard" href="${SUPPORT_MESSENGER}" target="_blank" rel="noopener"><strong>Message us on Messenger</strong><span>Chat with the Job Search PH page</span></a>
      <a class="ccard" href="${SUPPORT_FACEBOOK}" target="_blank" rel="noopener"><strong>Visit our Facebook page</strong><span>facebook.com/thejobsearchph</span></a>
    </div>
    <h2 class="form-h">Or send us a message here</h2>
    <form id="support-form" class="support-form pcard" novalidate>
      <div class="fld"><span class="label">What's this about?</span><div class="pills" role="radiogroup">${topics.map((t, i) => `<label class="pill"><input type="radio" name="topic" value="${esc(t)}" ${(pre ? pre.topic === t : i === 0) ? "checked" : ""}><span>${esc(t)}</span></label>`).join("")}</div></div>
      <div class="row">
        <label class="fld">Your name<input name="name" maxlength="80" value="${esc(profile?.fullName || user?.displayName || "")}" required></label>
        <label class="fld">Email or mobile to reply to<input name="reply" maxlength="120" value="${esc(user?.email || profile?.phone || "")}" required></label>
      </div>
      <label class="fld">Message<textarea name="message" rows="5" maxlength="2000" required minlength="10" placeholder="Include the job title or person's name if it's about a post or applicant.">${esc(pre?.message || "")}</textarea></label>
      <p class="hint">If you're in danger, contact the PNP (911) or DOLE right away.</p>
      <p id="form-error" class="error" hidden></p>
      <button class="btn btn-primary" type="submit">Send to support</button>
    </form>`;
  $("#support-form").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target; const err = $("#form-error"); err.hidden = true;
    const data = { topic: f.querySelector("[name=topic]:checked").value, name: f.name.value.trim(), reply: f.reply.value.trim(), message: f.message.value.trim(), page: pre?.page || returnTo || "" };
    if (data.name.length < 2 || data.reply.length < 5) { err.textContent = "Add your name and an email or mobile number we can reply to."; err.hidden = false; return; }
    if (data.message.length < 10) { err.textContent = "Write a bit more so we can help."; err.hidden = false; return; }
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Sending…";
    try { await store.sendSupport(data); app.innerHTML = `<div class="empty"><h1>Message sent</h1><p class="muted">Thanks, ${esc(firstName(data.name))}. We'll get back to you at ${esc(data.reply)}.</p><p><a class="btn btn-primary" href="#/">Back to jobs</a></p></div>`; }
    catch (ex) { btn.disabled = false; btn.textContent = "Send to support"; err.textContent = ex.code === "limit-reached" ? limitMsg.support : `Could not send (${ex.code || "error"}). Please try again.`; err.hidden = false; }
  });
}

/* ---------------- Static pages ---------------- */
const SUPPORT_EMAIL = "jobsearchph.official@gmail.com";
const SUPPORT_MESSENGER = "https://m.me/thejobsearchph";
const SUPPORT_FACEBOOK = "https://www.facebook.com/thejobsearchph/";
const UPDATED = "October 26, 2026";
function legalPage(title, intro, sections) {
  return `
    <article class="prose legal">
      <p class="kicker">Job Search PH</p>
      <h1>${title}</h1>
      <p class="muted">${intro}</p>
      <p class="legal-meta"><span>Last updated: ${UPDATED}</span><span>Republic of the Philippines</span></p>
      <nav class="toc" aria-label="Contents"><strong>Contents</strong><ol>${sections.map(([h], i) => `<li><a href="#" data-sec="s${i + 1}">${h}</a></li>`).join("")}</ol></nav>
      ${sections.map(([h, body], i) => `<section id="s${i + 1}"><h2><span class="sec-n">${String(i + 1).padStart(2, "0")}</span>${h}</h2>${body}</section>`).join("")}
      <div class="legal-contact"><strong>Questions?</strong> Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>, message us on <a href="${SUPPORT_MESSENGER}" target="_blank" rel="noopener">Messenger</a> (<a href="${SUPPORT_FACEBOOK}" target="_blank" rel="noopener">facebook.com/thejobsearchph</a>), or use <a href="#/support">Contact support</a>. We're based in Bacolod City and serve Negros Occidental.</div>
    </article>`;
}
function viewStatic(page) {
  const faq = (q, a) => `<details class="faq"><summary>${q}</summary><div>${a}</div></details>`;
  const pages = {
    safety: {
      title: "Safety tips & FAQs",
      html: `
      <article class="prose legal">
        <p class="kicker">Stay safe</p>
        <h1>Safety tips &amp; FAQs</h1>
        <p class="muted">Most people on Job Search PH are honest. These simple habits keep it that way for everyone.</p>
        <div class="tip-grid">
          <section class="tip-card">
            <h2>For jobseekers</h2>
            <ul class="tips">
              <li><strong>Never pay to get a job.</strong> No real employer asks for a processing, training, medical, uniform or "reservation" fee. Under the Kasambahay Law, household workers can't be charged placement fees.</li>
              <li><strong>Keep your IDs and money safe.</strong> Don't send ID photos, bank, GCash or OTP codes before an interview, and never send money to an employer.</li>
              <li><strong>Check the pay.</strong> Every job here must pay at least the legal minimum. In Negros Occidental, that's ₱6,500 a month for household workers.</li>
              <li><strong>Talk here first.</strong> Use the chat on Job Search PH until you trust the employer. It keeps a record if something goes wrong.</li>
              <li><strong>Meet safely.</strong> Go to the first interview in daytime, tell family the address, or bring someone you trust.</li>
              <li><strong>Get it in writing.</strong> Ask for a written contract with pay, hours, days off and benefits (SSS, PhilHealth, Pag-IBIG once covered).</li>
              <li><strong>Be suspicious of offers that are too good.</strong> Very high pay, "start today, no interview", or jobs abroad from someone without a DMW license are red flags.</li>
              <li><strong>Show up or say so.</strong> If you can't make an interview, message the employer as early as you can. It protects your reputation on the site.</li>
            </ul>
          </section>
          <section class="tip-card">
            <h2>For employers</h2>
            <ul class="tips">
              <li><strong>Meet before you hire.</strong> Interview in person or by video call, and check references from past employers.</li>
              <li><strong>Check documents yourself.</strong> Ask for a valid ID and barangay or NBI clearance during the interview, not by chat to strangers.</li>
              <li><strong>Never ask applicants for money</strong> or deductions to apply or be hired. It's against our rules and the Kasambahay Law.</li>
              <li><strong>Be clear and honest.</strong> Post the real pay, hours, days off and duties. Changing them after people apply wastes everyone's time.</li>
              <li><strong>Follow the law.</strong> Pay at least the minimum wage, give a weekly rest day, register household workers with SSS, PhilHealth and Pag-IBIG, and give a written contract.</li>
              <li><strong>Keep applicants' details private.</strong> Use them only for hiring and don't share them.</li>
              <li><strong>Reply to applicants.</strong> Even a quick "not this time" helps people move on.</li>
              <li><strong>Close the post when it's filled</strong> so jobseekers don't keep applying.</li>
            </ul>
          </section>
        </div>
        <div class="notice"><strong>In danger or being forced to work?</strong> Call <strong>911</strong> or the PNP right away. For labor complaints, contact DOLE Negros Occidental, or the DOLE hotline <strong>1349</strong>.</div>
        <h2 class="faq-h">Frequently asked questions</h2>
        ${faq("Is Job Search PH free?", "Yes. Creating a profile, searching and applying are free for jobseekers, always. Posting a job is free for employers.")}
        ${faq("Is Job Search PH a recruitment agency?", "No. We're an online job listing board. Employers post their own jobs and hire directly. We don't recruit, screen, place or employ anyone, and we never charge placement fees.")}
        ${faq("How do I know a job is real?", "Every post is reviewed before it goes live and must meet the legal minimum wage. Still, trust your instincts: if an employer asks for money, pushes you to leave the site quickly, or the details keep changing, stop and report the post.")}
        ${faq("Why can't I see the employer's phone number?", "To protect both sides from spam and scams, you talk to employers through Messages here on Job Search PH. The employer's own contact is shared with you once you accept their job offer.")}
        ${faq("Someone asked me for money. What do I do?", "Don't pay. Tap <strong>Report this post</strong> on the job, or contact support with the details. We'll review it and may remove the post or restrict the account.")}
        ${faq("How many jobs can I apply to?", "Up to 10 a day. Employers can post up to 5 jobs a month. These limits stop spam and keep the site fair.")}
        ${faq("Why did my chat close?", "If an employer chooses other applicants, the chat stays open for 48 hours so you can say goodbye or ask questions, then it closes. You can still read old messages.")}
        ${faq("How does hiring work?", "When an employer picks you, they send a <strong>job offer</strong>. You'll get a notification and can <strong>Accept</strong> or <strong>Decline</strong> it from the job page, My applications, or the chat. You're only marked as hired once you accept. If you decline, the employer is told and the chat closes after 48 hours.")}
        ${faq("How do I leave a job I got here?", "Go to <strong>My applications</strong> and tap <strong>Leave this job</strong>. Your employer confirms, and then you can apply to full-time jobs again. Employers can also start this from the applicant card.")}
        ${faq("What's the minimum pay for a kasambahay?", "In Negros Occidental (Western Visayas), it's ₱6,500 a month, effective November 19, 2025. Employers must also give a weekly rest day and 13th month pay.")}
        ${faq("How do I change or delete my profile?", "Open the gear menu → <strong>My profile</strong>. You can edit everything there, or tap <strong>Delete my profile</strong>. To delete your whole account, email us.")}
        ${faq("I'm under 18. Can I use the site?", "Not yet. Job Search PH is only for people 18 and older.")}
        <div class="legal-contact"><strong>Still need help?</strong> Message us on <a href="${SUPPORT_MESSENGER}" target="_blank" rel="noopener">Messenger</a>, email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>, or <a href="#/support">contact support</a>.</div>
      </article>`,
    },
    terms: {
      title: "Terms of use",
      html: legalPage("Terms of use", "Please read these terms before using Job Search PH. By creating an account or using the site, you agree to them and to our <a href=\"#/privacy\">Privacy policy</a>.", [
        ["What Job Search PH is", `<p>Job Search PH ("JSPH", "we", "us") is an online job listing board that connects employers and jobseekers in Negros Occidental, Philippines. Employers post jobs, jobseekers apply with their profiles, and both sides talk directly.</p>
          <div class="callout"><strong>We are not an agency or an employer.</strong> We don't recruit, screen, endorse, place, employ, supervise or manage anyone, and we're not a party to any job agreement made between users.</div>`],
        ["Free to use", `<ul><li>Searching and applying for jobs is free for jobseekers. <strong>We never charge jobseekers</strong>, in line with the Domestic Workers Act (RA 10361).</li><li>Posting a job is currently free for employers.</li><li>If we add optional paid features for employers later (for example, featured posts), the price will be shown clearly before you pay, and nothing already free will become paid without notice.</li><li>We don't charge placement fees.</li></ul>`],
        ["Your account", `<ul><li>You must be at least 18 years old.</li><li>Give true, current information. Use your real name and a mobile number you can be reached on.</li><li>Use one account per person. Don't create accounts to get around limits or restrictions.</li><li>Keep your password safe. You're responsible for what happens on your account.</li></ul>`],
        ["Job post rules", `<p>Employers agree that every post:</p><ul><li>Is a real, current job they will hire for directly;</li><li>Pays at least the legal minimum wage and states the pay honestly;</li><li>Never asks applicants for any fee, deposit or deduction to apply or be hired;</li><li>Is only for workers aged 18 and older;</li><li>Has accurate duties, hours, days off and benefits, and isn't changed in a misleading way after people apply;</li><li>Doesn't include discriminatory requirements, such as age limits (Anti-Age Discrimination Act, RA 10911);</li><li>Isn't posted on behalf of a recruitment agency or for work abroad unless the agency is licensed by DOLE or DMW and the license number is included.</li></ul><p>Posts are reviewed before going live and stay up for 30 days. We may reject, edit, close or remove any post.</p>`],
        ["Employer responsibilities", `<ul><li>Interview applicants and make your own hiring decisions;</li><li>Follow Philippine labor law, including the Kasambahay Law: minimum wage, weekly rest day, 13th month pay, a written contract, and SSS, PhilHealth and Pag-IBIG registration;</li><li>Provide safe, humane and respectful working conditions;</li><li>Use applicants' personal details only to consider them for your job, and don't share them.</li></ul><p>JSPH isn't responsible for employer decisions, pay disputes, working conditions or private agreements.</p>`],
        ["Jobseeker responsibilities", `<ul><li>Give truthful information in your profile and applications;</li><li>Apply only to jobs you're genuinely interested in;</li><li>Communicate politely and honor interviews and job commitments, or tell the employer early if you can't;</li><li>Use "Leave this job" when a job ends so records stay accurate.</li></ul><p>JSPH isn't responsible for false information given by jobseekers or for their behavior or work performance.</p>`],
        ["Messages and conduct", `<ul><li>Keep chats about the job. No harassment, threats, hate speech, sexual content, or requests for money or sensitive personal data.</li><li>Chats with applicants who weren't selected close 48 hours after the decision.</li><li>To prevent spam, there are daily limits on applications, posts, messages and reports.</li><li>We may review chats when investigating a report.</li></ul>`],
        ["Reviews, reports and moderation", `<p>We review job posts and look into reports, but we can't check every user or guarantee anything they say. We may warn, restrict, suspend or remove accounts and posts for fraud, misrepresentation, abuse, spam or breaking these terms. If you think we made a mistake, <a href="#/support">contact support</a> to appeal.</p>`],
        ["Safety and risk", `<p>We don't supervise or control users. By using JSPH, you agree that:</p><ul><li>JSPH isn't liable for theft, loss, damage, injury, harassment, abuse or misconduct by any user;</li><li>Any job arrangement is made at your own risk;</li><li>Employers should do their own checks, and jobseekers should judge whether an employer is safe and legitimate.</li></ul><div class="callout">JSPH isn't a party to any relationship or agreement between an employer and a jobseeker, and accepts no liability for any dispute, loss or harm between them, on or off the platform.</div><p>Read our <a href="#/safety">Safety tips</a>.</p>`],
        ["No guarantee", `<ul><li>We don't guarantee that jobseekers will be hired or that employers will find workers.</li><li>We don't guarantee any user's identity, behavior, reliability or performance.</li></ul>`],
        ["Off-platform communication", `<p>Anything arranged outside Job Search PH, such as calls, texts, Messenger or meetings, is the responsibility of the people involved.</p>`],
        ["Limitation of liability", `<p>To the fullest extent the law allows, JSPH isn't liable for employment disputes, financial losses, damages caused by users, or job performance. If we are found liable, our total liability is limited to the amount you paid JSPH in the 12 months before the claim, if any.</p>`],
        ["Service availability", `<p>We try to keep the site running, but we don't guarantee it will always be available or error-free. We're not liable for delays or failures caused by events beyond our control, such as natural disasters, power or internet outages.</p>`],
        ["Intellectual property", `<p>The Job Search PH name, logo, design and site content belong to Job Search PH. Don't copy or use them without permission. You keep ownership of what you post, and you let us display it on the site to run the service.</p>`],
        ["Changes to these terms", `<p>We may update these terms. We'll announce important changes on the site. Continuing to use JSPH after changes take effect means you accept them.</p>`],
        ["Governing law", `<p>These terms are governed by the laws of the Republic of the Philippines. Disputes will be brought before the proper courts of Negros Occidental.</p>`],
      ]),
    },
    privacy: {
      title: "Privacy policy",
      html: legalPage("Privacy policy", "How Job Search PH collects, uses and protects your personal data, in line with the Data Privacy Act of 2012 (RA 10173) and the rules of the National Privacy Commission.", [
        ["Data we collect", `<ul><li><strong>Account:</strong> your email and sign-in method (Google or email and password).</li><li><strong>Jobseeker profile:</strong> name, photo (optional), birthdate (we show employers your age, not your birthdate), gender, mobile number, city, Messenger, jobs wanted, experience, skills, work history, education and resume link.</li><li><strong>Employer profile:</strong> name, photo (optional), household or business name, mobile number, city and Messenger.</li><li><strong>Activity on the site:</strong> job posts, applications, chat messages, interview and hiring status, notifications, reports and support messages.</li><li><strong>Anti-spam counters:</strong> how many applications, posts, messages and reports you sent today.</li><li><strong>On your device only:</strong> your light or dark mode choice.</li></ul><p>We don't use advertising trackers, and we don't sell your data.</p>`],
        ["Why we use it", `<ul><li>To run your account and show your posts, applications and messages;</li><li>To share your profile with employers you apply to, and employer contact details with the worker they hire;</li><li>To review job posts, prevent spam, fraud and abuse, and handle reports and appeals;</li><li>To reply to support requests and improve the site;</li><li>If you turn on job alerts, to email you new jobs that match the jobs and city on your profile. Emails are sent through our email provider, Resend. Unsubscribe with the link in any email or in My profile.</li></ul>`],
        ["Who can see it", `<ul><li><strong>Everyone:</strong> live job posts (title, employer or household name, area, pay and details). Employer contact details are not public.</li><li><strong>Employers you apply to:</strong> your profile, photo, age, contact details, message, experience and resume.</li><li><strong>The worker you hire:</strong> the employer contact you entered on the post, once they accept your job offer.</li><li><strong>The person you're chatting with:</strong> your messages.</li><li><strong>Job Search PH admins:</strong> all data, only to run and keep the site safe.</li><li><strong>Service provider:</strong> the site runs on Google Firebase, which stores data for us under its own security and privacy terms.</li></ul><p>We may also disclose data when the law requires it, such as a lawful order from the authorities.</p>`],
        ["How long we keep it", `<ul><li>Your profile stays until you delete it.</li><li>Job posts expire after 30 days and stay in your account until removed.</li><li>Applications and chats stay so both sides can refer back to them. Chats with declined applicants close after 48 hours but remain readable.</li><li>Reports and safety records are kept as long as needed to protect users, then deleted.</li></ul>`],
        ["How we protect it", `<p>Data is stored on Google Firebase with access rules that let each person see only what they're allowed to. Admin access is limited to authorized Job Search PH staff. No system is perfectly secure, so please use a strong password and keep it private.</p>`],
        ["Your rights", `<p>Under the Data Privacy Act, you can:</p><ul><li>Ask what data we have about you and get a copy;</li><li>Correct wrong information (most of it you can edit in My profile);</li><li>Delete your profile (My profile → Delete my profile) or ask us to delete your whole account;</li><li>Object to how we use your data, or withdraw consent;</li><li>File a complaint with the National Privacy Commission (privacy.gov.ph).</li></ul><p>To make a request, email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>`],
        ["Age limit", `<p>Job Search PH is for people 18 and older. We don't knowingly collect data from anyone younger. If you think a minor has an account, tell us and we'll remove it.</p>`],
        ["Changes to this policy", `<p>We may update this policy. We'll post the new version here with a new date, and announce important changes on the site.</p>`],
      ]),
    },
  };
  const p = pages[page];
  document.title = `${p.title} | Job Search PH`;
  app.innerHTML = p.html;
  app.querySelectorAll("[data-sec]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); document.getElementById(a.dataset.sec)?.scrollIntoView({ behavior: "smooth", block: "start" }); }));
}

/* ---------------- Unsubscribe from job alert emails (link in every email, works signed out) ---------------- */
async function viewUnsubscribe(token) {
  document.title = "Unsubscribe | Job Search PH";
  app.innerHTML = `<div class="empty"><h1>Stopping job alerts…</h1></div>`;
  try {
    await store.unsubscribe(token);
    app.innerHTML = `<div class="empty"><h1>You're unsubscribed</h1><p class="muted">We won't send you job alert emails anymore. Changed your mind? Turn them back on in <a href="#/profile">My profile</a>.</p><p><a class="btn btn-primary" href="#/">Browse jobs</a></p></div>`;
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="empty"><h1>That link didn't work</h1><p class="muted">Sign in and switch off <strong>Job alerts by email</strong> in <a href="#/profile">My profile</a>, or email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> and we'll do it for you.</p></div>`;
  }
}

/* ---------------- Router ---------------- */
let lastUid;
async function route() {
  renderNav();
  $("#nav").classList.remove("open"); $("#nav-toggle").setAttribute("aria-expanded", "false");
  const [, page, arg, arg2] = (location.hash || "#/").split("/");
  window.scrollTo(0, 0);
  const { user, profile, banned, isAdmin } = getAuthState();
  if (page === "unsubscribe") return viewUnsubscribe(arg || "");
  if (user && banned && !isAdmin && !["support", "safety", "terms", "privacy"].includes(page || "")) return viewSuspended(banned);
  // New accounts finish their profile first; browsing jobs and reading info pages still work.
  if (user && !profile && !["", "job", "profile", "signin", "safety", "terms", "privacy", "support"].includes(page || "")) {
    if (!returnTo) returnTo = location.hash;
    location.hash = "#/profile"; return;
  }
  if (!page) return viewList();
  // Keep only the ID: share menus sometimes glue the title/text onto the link ("…/job/abc123%20Live-in%20Yaya").
  if (page === "job" && arg) { let raw = arg; try { raw = decodeURIComponent(arg); } catch {} const id = (raw.match(/^[A-Za-z0-9_-]+/) || [""])[0]; if (id && id !== raw) { history.replaceState(null, "", `${location.pathname}${location.search}#/job/${id}`); } return viewJob(id); }
  if (page === "signin") return viewSignIn();
  if (page === "profile") return viewProfile();
  if (page === "post") return viewPost();
  if (page === "my") return viewMy();
  if (page === "applicants" && arg) return viewApplicants(decodeURIComponent(arg));
  if (page === "applications") return viewApplications();
  if (page === "messages") return viewMessages();
  if (page === "support") return viewSupport();
  if (page === "chat" && arg) return viewChat(decodeURIComponent(arg));
  if (page === "admin" && arg === "user" && arg2) return viewAdminUser(decodeURIComponent(arg2));
  if (page === "admin") { if (["analytics", "users", "pending", "approved", "reports", "support", "rejected", "closed"].includes(arg)) adminTab = arg; return viewAdmin(); }
  if (["safety", "terms", "privacy"].includes(page)) return viewStatic(page);
  location.hash = "#/";
}

window.addEventListener("hashchange", route);
setTheme(getTheme());
let foundersLoaded = false;
onAuth(async (s) => {
  if (!foundersLoaded) { foundersLoaded = true; [FOUNDERS, VERIFIED] = await Promise.all([store.founders().catch(() => ({})), store.verifiedList().catch(() => ({}))]); }
  const uidNow = s.user?.uid || null;
  const changed = uidNow !== lastUid; lastUid = uidNow;
  if (changed) { myAppsCache = null; startNotifications(); }
  startInbox();
  if (changed && uidNow && location.hash === "#/signin") return finishAuthFlow();
  route();
});
// Test site: loud banner, and keep it out of Google.
if (IS_STAGING) {
  document.body.insertAdjacentHTML("afterbegin", `<div class="staging-banner"><strong>TEST SITE</strong> · Not the real Job Search PH. Everything here is test data. <a href="https://jobsearchph.com">Go to the real site →</a></div>`);
  const m = document.createElement("meta"); m.name = "robots"; m.content = "noindex, nofollow"; document.head.appendChild(m);
  document.title = `[TEST] ${document.title}`;
}
store.init().catch((err) => {
  console.error(err);
  app.innerHTML = `<p class="error">${IS_STAGING ? esc(err.message) : "Could not start the site. Please refresh."}</p>`;
});
