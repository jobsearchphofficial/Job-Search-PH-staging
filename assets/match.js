// Fit score: how well an applicant's profile fits a job post, 0–100, with plain reasons.
// Used by the site (employer's applicant list) and by scripts/send-emails.mjs (new-applicant emails),
// so both always agree. No dependencies; works in the browser and in Node.
//
// It only ranks people who applied to the employer's own post. It's a guide: the employer decides.
//
// Points: job type 30 · location 20 · experience 15 · live-in/schedule 10 · education 10 · skills 10 · availability 5

export const METRO_BACOLOD = ["Bacolod City", "Talisay City", "Silay City", "Bago City", "Murcia"];

const EDU_RANK = {
  "Elementary level": 0.5, "Elementary graduate": 1, "High school level": 1.5, "High school graduate": 2,
  "Senior high school graduate": 3, "Vocational / TESDA certificate": 3, "College level": 3.5, "College graduate": 4, "Post-graduate": 5,
};
const REQ_EDU_RANK = { "Elementary": 1, "High school": 2, "Senior high school": 3, "Vocational / TESDA": 3, "College": 4 };

// Words that show a requirement in what the applicant wrote (English, Tagalog, Hiligaynon).
const SKILL_WORDS = {
  "Can cook": /cook|luto|kusin|chef|kitchen/i,
  "Laundry & ironing": /laundry|iron|plantsa|laba|labada/i,
  "Childcare experience": /child|bab(y|ies)|bata|kids|yaya|nanny|toddler|infant/i,
  "Elderly care experience": /elder|senior|lola|lolo|caregiver|patient|bedridden/i,
  "Professional driver's license": /driver|license|lisensya|driving|drive/i,
  "Pet care": /pet|dog|cat|ido|iro/i,
  "Gardening": /garden|plant|tanim|landscap/i,
  "Customer service": /customer|cashier|sales|service crew|front desk/i,
  "Cash handling": /cash|cashier|money|teller/i,
  "Food handling": /food|kitchen|cook|crew|restaurant|carinderia/i,
  "Computer skills": /computer|excel|word|typing|encod|office/i,
  "Heavy lifting": /lift|heavy|warehouse|construction|helper|loader|porter/i,
  "Own motorcycle": /motor|rider|motorcycle/i,
  "Speaks Hiligaynon": /hiligaynon|ilonggo/i,
  "Speaks English": /english/i,
};

const low = (s) => String(s || "").trim().toLowerCase();
const first = (s) => String(s || "").split("·")[0].trim();

export function fitScore(job, a) {
  a = a || {};
  const good = [], gaps = [];
  let score = 0;

  // 1. Job type (30)
  const cats = Array.isArray(a.jobCategories) ? a.jobCategories : [];
  const kind = job.category === "Other" && job.categoryOther ? job.categoryOther : job.category;
  if (job.category === "Other" ? (cats.includes("Other") && low(a.jobCategoryOther) && low(a.jobCategoryOther) === low(job.categoryOther)) : cats.includes(job.category)) {
    score += 30; good.push(`Looking for ${kind} work`);
  } else if (!cats.length) { score += 10; gaps.push("Didn't say which jobs they want"); }
  else gaps.push(`Didn't list ${kind} as a job they want`);

  // 2. Location (20)
  if (!a.city) { score += 8; }
  else if (low(a.city) === low(job.city)) { score += 20; good.push(`Lives in ${job.city}`); }
  else if (METRO_BACOLOD.includes(a.city) && METRO_BACOLOD.includes(job.city)) { score += 12; good.push(`Lives nearby, in ${a.city}`); }
  else { score += 4; gaps.push(`Lives in ${a.city}`); }

  // 3. Experience (15)
  const need = Number(job.reqExperience) || 0;
  const has = a.experienceYears === "" || a.experienceYears == null ? null : Number(a.experienceYears);
  if (need === 0) { score += 15; if (has) good.push(`${has} year${has === 1 ? "" : "s"} of experience`); }
  else if (has == null) { score += 4; gaps.push(`Didn't say how much experience (you want ${need}+ years)`); }
  else if (has >= need) { score += 15; good.push(`${has} years of experience (you want ${need}+)`); }
  else { score += Math.round((15 * has) / need); gaps.push(`${has} year${has === 1 ? "" : "s"} of experience (you want ${need}+)`); }

  // 4. Live-in / schedule (10)
  const types = Array.isArray(a.jobTypes) ? a.jobTypes : [];
  if (!types.length) score += 5;
  else {
    let pts = 0, missing = [];
    if (job.arrangement) { if (types.includes(job.arrangement)) { pts += 6; good.push(`OK with ${job.arrangement.toLowerCase()}`); } else missing.push(job.arrangement.toLowerCase()); }
    const sched = job.schedule || "";
    if (sched && sched !== "Shifts") { if (types.includes(sched)) { pts += job.arrangement ? 4 : 10; if (!job.arrangement) good.push(`Wants ${sched.toLowerCase()} work`); } else missing.push(sched.toLowerCase()); }
    else pts += job.arrangement ? 2 : 5;
    score += Math.min(10, pts);
    if (missing.length) gaps.push(`Didn't pick ${missing.join(" or ")}`);
  }

  // 5. Education (10)
  const needEdu = REQ_EDU_RANK[job.reqEducation] || 0;
  const hasEdu = EDU_RANK[first(a.education)];
  if (!needEdu) score += 10;
  else if (hasEdu == null) { score += 4; gaps.push(`Didn't add their education (you want ${job.reqEducation.toLowerCase()})`); }
  else if (hasEdu >= needEdu) { score += 10; good.push(`${first(a.education)}`); }
  else { score += 3; gaps.push(`${first(a.education)} (you want ${job.reqEducation.toLowerCase()})`); }

  // 6. Skills from the post's checklist (10): only the ones a profile can show
  const text = `${a.skills || ""} ${a.workHistory || ""}`;
  const checkable = (job.reqList || []).filter((r) => SKILL_WORDS[r]);
  if (!checkable.length) score += 10;
  else {
    const hit = checkable.filter((r) => SKILL_WORDS[r].test(text));
    score += Math.round((10 * hit.length) / checkable.length);
    if (hit.length) good.push(`Mentions: ${hit.map((h) => h.toLowerCase()).join(", ")}`);
    const miss = checkable.filter((r) => !hit.includes(r));
    if (miss.length) gaps.push(`Doesn't mention: ${miss.map((h) => h.toLowerCase()).join(", ")}`);
  }

  // 7. Availability (5)
  const av = a.availability || "";
  if (av === "Available now") { score += 5; good.push("Available now"); }
  else if (av === "Within 2 weeks") score += 4;
  else if (av) score += 2;
  else score += 2;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = score >= 80 ? "Great fit" : score >= 60 ? "Good fit" : score >= 40 ? "Possible fit" : "Weak fit";
  return { score, label, good, gaps };
}

// Highest score first; ties go to whoever applied first.
export function rankApplicants(job, apps) {
  return apps.map((a) => ({ ...a, fit: fitScore(job, a.applicant) }))
    .sort((x, y) => y.fit.score - x.fit.score || (x.createdAt || 0) - (y.createdAt || 0));
}
