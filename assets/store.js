// Data layer: Firebase Auth + Firestore (+ Storage for resume files when enabled).
import { firebaseConfig, IS_STAGING, LISTING_DAYS, RESUME_UPLOADS, HELPER_URL, SMS_ON } from "./firebase-config.js?v=1793254020";

const CDN = "https://www.gstatic.com/firebasejs/10.12.2";
const DAY = 86400000;
const USE_EMULATORS = ["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).has("emu");

let A, F, S, auth, db, storage;
let state = { user: null, profile: null, isAdmin: false, banned: null, ready: false };
let foundersCache = null;
let verifiedCache = null;
const listeners = new Set();
const emit = () => listeners.forEach((cb) => cb({ ...state }));

export const onAuth = (cb) => { listeners.add(cb); if (state.ready) cb({ ...state }); return () => listeners.delete(cb); };
export const getAuthState = () => ({ ...state });
export const uploadsEnabled = RESUME_UPLOADS;
const HELPER = USE_EMULATORS ? "http://127.0.0.1:8787" : HELPER_URL;
export const smsEnabled = !!HELPER && (SMS_ON || USE_EMULATORS);
// A real name: at least two words with letters (first and last name).
export const isFullName = (n) => String(n || "").trim().split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w)).length >= 2;
async function callHelper(path, body = {}, signedIn = true) {
  const headers = { "content-type": "application/json" };
  if (signedIn) headers.authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
  let res;
  try { res = await fetch(`${HELPER}/${path}`, { method: "POST", headers, body: JSON.stringify(body) }); }
  catch { throw Object.assign(new Error("We couldn't connect. Check your internet and try again."), { code: "network" }); }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(out.message || (out.error === "wait" ? `Wait ${out.wait}s before asking again.` : "Something went wrong. Try again.")), { code: out.error || "error", wait: out.wait, status: res.status });
  return out;
}
// Same rule as the SMS helper: 09XXXXXXXXX / 639XXXXXXXXX / +639XXXXXXXXX → +639XXXXXXXXX
export const normPhone = (v) => { const m = String(v || "").replace(/\D/g, "").match(/^(?:0|63)?(9\d{9})$/); return m ? `+63${m[1]}` : null; };

// Fields an employer submits for the public post. Contact details are stored privately.
// Everything an employer may change when editing a post (keep in sync with firestore.rules).
const EDITABLE = ["title", "category", "categoryOther", "employerName", "city", "area", "address", "addressHidden", "workplace", "arrangement", "schedule", "employmentType",
  "salaryMin", "salaryMax", "salaryPeriod", "hours", "daysOff", "daysOffPer", "openings", "startDate", "benefits", "reqExperience", "reqEducation", "reqList", "requirements", "description"];
export const JOB_FIELDS = ["title", "category", "employerName", "city", "area", "employmentType", "salaryMin", "salaryMax", "salaryPeriod", "hours", "daysOff", "openings", "startDate", "description", "requirements"];
export const PROFILE_FIELDS = {
  common: ["role", "fullName", "phone", "city", "messenger"],
  jobseeker: ["photo", "birthDate", "gender", "jobCategories", "jobTypes", "experienceYears", "skills", "workHistory", "education", "availability", "resumeUrl", "resumeFileUrl", "resumeFileName"],
  employer: ["companyName"],
};

const toMs = (v) => (v && typeof v.toMillis === "function" ? v.toMillis() : v ?? null);
const norm = (snap) => {
  const d = snap.data();
  const out = { id: snap.id, ...d };
  ["createdAt", "approvedAt", "expiresAt", "updatedAt", "declinedAt", "lastMessageAt", "applicantSeenAt", "employerSeenAt", "endRequestedAt", "endedAt", "acceptedAt", "bannedAt", "doneAt", "infoAt", "editedAt", "decidedAt", "at"].forEach((k) => { if (k in d) out[k] = toMs(d[k]); });
  return out;
};
const jobsQ = async (...c) => (await F.getDocs(F.query(F.collection(db, "jobs"), ...c))).docs.map(norm);
const appsQ = async (...c) => (await F.getDocs(F.query(F.collection(db, "applications"), ...c))).docs.map(norm);
const uid = () => auth.currentUser?.uid;

export function ageFrom(birthDate) {
  if (!birthDate) return null;
  const b = new Date(birthDate + "T00:00:00"); if (isNaN(b)) return null;
  const n = new Date(); let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

// Signed in with email + password and hasn't clicked the confirmation link yet.
// (Same test as firestore.rules uses before allowing a new job post.)
async function needsConfirm(user) {
  if (!user || user.emailVerified) return false;
  try { return (await user.getIdTokenResult()).signInProvider === "password"; } catch { return false; }
}

async function loadProfile(user) {
  if (!user) return { profile: null, isAdmin: false, banned: null };
  const [p, a, b] = await Promise.all([
    F.getDoc(F.doc(db, "users", user.uid)).catch(() => null),
    F.getDoc(F.doc(db, "admins", user.uid)).catch(() => null),
    F.getDoc(F.doc(db, "bans", user.uid)).catch(() => null),
  ]);
  return { profile: p?.exists() ? norm(p) : null, isAdmin: !!a?.exists(), banned: b?.exists() ? norm(b) : null };
}

/* ---- Where visitors came from (?src=fb-ad-yaya-nov). First touch, kept 60 days, no personal data. ----
   Also understands Facebook/Google ad tags: utm_campaign (or utm_source) becomes the source name. */
const slug = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
let landedFrom = ""; // a tracked link brought this visit (counted once per link per day in visits/)
(() => {
  try {
    const q = new URLSearchParams(location.search);
    const raw = q.get("src") || q.get("utm_campaign") || q.get("utm_source") || q.get("ref") || (q.has("fbclid") ? "facebook" : "");
    const clean = slug(raw);
    landedFrom = clean;
    const cur = JSON.parse(localStorage.getItem("jsph-src") || "null");
    if (clean && (!cur || Date.now() - cur.at > 60 * 86400000)) localStorage.setItem("jsph-src", JSON.stringify({ src: clean, at: Date.now() }));
    if (raw || q.has("fbclid")) { ["src", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id", "ref", "fbclid"].forEach((k) => q.delete(k)); const qs = q.toString(); history.replaceState(null, "", location.pathname + (qs ? `?${qs}` : "") + location.hash); }
  } catch {}
})();
const phDate = (t = Date.now()) => new Date(t + 8 * 3600000).toISOString().slice(0, 10);
// One count per browser, per link, per day. Admin → Analytics adds these up as "visits".
async function recordVisit() {
  if (!landedFrom) return;
  const day = phDate(), key = `jsph-v-${landedFrom}-${day}`;
  try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch {}
  await F.setDoc(F.doc(db, "visits", `${landedFrom}__${day}`), { src: landedFrom, day, n: F.increment(1) }, { merge: true }).catch(() => {});
}
export const visitSource = () => { try { const c = JSON.parse(localStorage.getItem("jsph-src") || "null"); return c && Date.now() - c.at < 60 * 86400000 ? c.src : ""; } catch { return ""; } };

// applies, messages, reports, support: per day. posts: per calendar month (Pro may raise this later; also update the 5 in firestore.rules mcnt).
export const LIMITS = { applies: 10, posts: 5, messages: 200, reports: 5, support: 3 };
const phDay = () => Math.floor((Date.now() + 8 * 3600000) / 86400000);
// Philippine calendar month as one number (year * 12 + month 1–12). Job posts are limited per month.
const phMonth = () => { const d = new Date(Date.now() + 8 * 3600000); return d.getUTCFullYear() * 12 + d.getUTCMonth() + 1; };
export class LimitError extends Error { constructor(kind) { super(`limit:${kind}`); this.kind = kind; this.code = "limit-reached"; } }

export const store = {
  async usage() {
    const base = { day: phDay(), month: phMonth(), applies: 0, posts: 0, messages: 0, reports: 0, support: 0, postsM: 0 };
    if (!uid()) return base;
    const snap = await F.getDoc(F.doc(db, "limits", uid())).catch(() => null);
    const d = snap?.exists() ? snap.data() : null;
    if (!d) return base;
    const daily = d.day === phDay() ? { applies: d.applies || 0, posts: d.posts || 0, messages: d.messages || 0, reports: d.reports || 0, support: d.support || 0 } : {};
    return { ...base, ...daily, postsM: d.month === phMonth() ? d.postsM || 0 : 0, msgAt: d.msgAt ?? null };
  },
  // Adds "bump the counter" to a batch. Posts count per month (postsM); everything else per day.
  // Throws LimitError when the cap is reached.
  async _bump(batch, kind, extra = {}) {
    const u = await this.usage();
    const field = kind === "posts" ? "postsM" : kind;
    if ((u[field] || 0) >= LIMITS[kind]) throw new LimitError(kind);
    const next = { day: phDay(), month: phMonth(), applies: u.applies, posts: u.posts, messages: u.messages, reports: u.reports, support: u.support, postsM: u.postsM, [field]: (u[field] || 0) + 1, ...extra };
    if (u.msgAt && !("msgAt" in extra)) next.msgAt = u.msgAt;
    batch.set(F.doc(db, "limits", uid()), next);
  },
  async init() {
    if (!firebaseConfig && !USE_EMULATORS) throw new Error(IS_STAGING ? "The test site's database isn't set up yet." : "Missing Firebase config.");
    const mods = [import(`${CDN}/firebase-app.js`), import(`${CDN}/firebase-auth.js`), import(`${CDN}/firebase-firestore.js`)];
    if (RESUME_UPLOADS) mods.push(import(`${CDN}/firebase-storage.js`));
    const [appMod, authMod, fsMod, stMod] = await Promise.all(mods);
    A = authMod; F = fsMod; S = stMod;
    const app = appMod.initializeApp(USE_EMULATORS ? { ...firebaseConfig, projectId: "demo-jsph" } : firebaseConfig);
    auth = A.getAuth(app);
    db = F.getFirestore(app);
    if (S) storage = S.getStorage(app);
    if (USE_EMULATORS) {
      A.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      F.connectFirestoreEmulator(db, "127.0.0.1", 8085);
    }
    recordVisit();
    A.onAuthStateChanged(auth, async (user) => {
      const [extra, mustConfirmEmail] = await Promise.all([loadProfile(user), needsConfirm(user)]);
      state = { user: user ? { uid: user.uid, displayName: user.displayName, email: user.email } : null, ...extra, mustConfirmEmail, ready: true };
      emit();
    });
  },

  /* ---- Auth ---- */
  async signInGoogle() { await A.signInWithPopup(auth, new A.GoogleAuthProvider()); },
  // Facebook: popup normally; full-page redirect inside the Facebook/Messenger app, where popups don't work.
  async signInFacebook({ redirect = false } = {}) {
    const fb = new A.FacebookAuthProvider(); fb.addScope("email");
    if (redirect) return A.signInWithRedirect(auth, fb);
    await A.signInWithPopup(auth, fb);
  },
  // Errors from a redirect sign-in show up on the next page load.
  async redirectError() { try { await A.getRedirectResult(auth); return null; } catch (e) { return e; } },
  // Which sign-in methods this account has: ["google.com", "facebook.com", "password"].
  providers() { return (auth.currentUser?.providerData || []).map((p) => p.providerId); },
  async linkFacebook() {
    const fb = new A.FacebookAuthProvider(); fb.addScope("email");
    await A.linkWithPopup(auth.currentUser, fb);
    await auth.currentUser.reload();
    if (state.profile) await this.saveProfile({}).catch(() => {}); // refresh "signs in with" on the profile
  },
  async unlinkFacebook() {
    if (this.providers().length < 2) throw Object.assign(new Error("last-method"), { code: "last-method" });
    await A.unlink(auth.currentUser, "facebook.com");
    if (state.profile) await this.saveProfile({}).catch(() => {});
  },
  async signInEmail(email, pw) { await A.signInWithEmailAndPassword(auth, email, pw); },
  async signUpEmail(email, pw, name) {
    const cred = await A.createUserWithEmailAndPassword(auth, email, pw);
    if (name) await A.updateProfile(cred.user, { displayName: name }).catch(() => {});
    this.sendVerification().catch(() => {});
  },
  // Email confirmation for email + password accounts.
  // Mobile number confirmation (text message code). phoneVerified/{uid} is written only by the SMS helper.
  async phoneStatus() {
    const u = auth.currentUser; if (!u) return null;
    const d = await F.getDoc(F.doc(db, "phoneVerified", u.uid)).catch(() => null);
    return d?.exists() ? norm(d) : null;
  },
  async phoneStatusFor(id) { const d = await F.getDoc(F.doc(db, "phoneVerified", id)).catch(() => null); return d?.exists() ? norm(d) : null; },
  async sms(path, body = {}) {
    if (!HELPER) throw Object.assign(new Error("off"), { code: "off" });
    return callHelper(path, body);
  },
  // Branded "confirm your email" email from noreply@jobsearchph.com (helper); Firebase's plain one if the helper is off or down.
  async sendVerification() {
    if (HELPER) { try { return await callHelper("email/verify"); } catch (e) { if (e.code === "wait" || e.code === "limit") throw e; console.warn("helper email failed, using Firebase", e); } }
    await A.sendEmailVerification(auth.currentUser, { url: `${location.origin}/#/profile` });
  },
  // After they click the link: refresh the account (and its token, which the database rules read).
  async refreshVerified() {
    const u = auth.currentUser; if (!u) return false;
    await u.reload(); await u.getIdToken(true);
    const must = await needsConfirm(auth.currentUser);
    state = { ...state, mustConfirmEmail: must };
    if (!must && state.profile && !state.profile.emailVerified) await this.saveProfile({}).catch(() => {});
    else emit();
    return !must;
  },
  async resetPassword(email) {
    if (HELPER) { try { return await callHelper("email/reset", { email, project: USE_EMULATORS ? "demo-jsph" : firebaseConfig.projectId }, false); } catch (e) { if (e.code === "wait") throw e; console.warn("helper email failed, using Firebase", e); } }
    await A.sendPasswordResetEmail(auth, email);
  },
  // Links in account emails open jobsearchph.com/?mode=…&oobCode=… and are finished here.
  async applyEmailCode(code) {
    await A.applyActionCode(auth, code);
    if (auth.currentUser) return this.refreshVerified();
    return true;
  },
  async checkResetCode(code) { return A.verifyPasswordResetCode(auth, code); }, // → the account's email
  async confirmReset(code, pw) { await A.confirmPasswordReset(auth, code, pw); },
  async signOut() { await A.signOut(auth); },

  /* ---- Profile ---- */
  async saveProfile(data) {
    const ref = F.doc(db, "users", uid());
    const exists = !!state.profile;
    const cu = auth.currentUser;
    const has = (id) => cu?.providerData?.some((p) => p.providerId === id);
    const signIn = has("google.com") ? "google" : has("facebook.com") ? "facebook" : has("password") ? "password" : "";
    const payload = { ...data, consent: true, email: cu?.email || "", signIn, emailVerified: !!cu?.emailVerified, updatedAt: F.serverTimestamp() };
    if (!exists) { payload.createdAt = F.serverTimestamp(); const src = visitSource(); if (src) payload.src = src; }
    try { await F.setDoc(ref, payload, { merge: true }); }
    catch (e) { // older published rules don't know the newest optional fields yet: save without them
      if (e.code !== "permission-denied") throw e;
      ["src", "jobCategoryOther", "fbUrl", "bizReg", "signIn", "emailVerified", "alerts", "alertsScope", "alertsToken", "emailNotify"].forEach((k) => delete payload[k]);
      await F.setDoc(ref, payload, { merge: true });
    }
    const extra = await loadProfile(auth.currentUser);
    state = { ...state, ...extra }; emit();
  },
  /* ---- Founding members (#1–#100) ---- */
  async founders(force = false) {
    if (!force && foundersCache) return foundersCache;
    try { const snap = await F.getDocs(F.collection(db, "founders")); foundersCache = Object.fromEntries(snap.docs.map((d) => [d.id, d.data().no])); }
    catch { foundersCache = foundersCache || {}; }
    return foundersCache;
  },
  // Claims the next number if any are left. Returns the number, or null.
  async claimFounder() {
    if (!uid()) return null;
    try {
      const no = await F.runTransaction(db, async (tx) => {
        const mine = await tx.get(F.doc(db, "founders", uid()));
        if (mine.exists()) return null;
        const meta = await tx.get(F.doc(db, "meta", "founders"));
        const count = meta.exists() ? meta.data().count || 0 : 0;
        if (count >= 100) return null;
        tx.set(F.doc(db, "meta", "founders"), { count: count + 1 });
        tx.set(F.doc(db, "founders", uid()), { no: count + 1, at: F.serverTimestamp() });
        return count + 1;
      });
      if (no) { foundersCache = { ...(foundersCache || {}), [uid()]: no }; }
      return no;
    } catch (e) { console.warn("founder claim skipped", e.code || e.message); return null; }
  },
  // Admin: give numbers to the earliest existing profiles that don't have one yet.
  async awardFounders(users) {
    const meta = await F.getDoc(F.doc(db, "meta", "founders"));
    let count = meta.exists() ? meta.data().count || 0 : 0;
    const have = await this.founders(true);
    const todo = users.filter((u) => !have[u.id]).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).slice(0, Math.max(0, 100 - count));
    for (let i = 0; i < todo.length; i += 400) {
      const b = F.writeBatch(db);
      todo.slice(i, i + 400).forEach((u) => { count++; b.set(F.doc(db, "founders", u.id), { no: count, at: F.serverTimestamp() }); });
      b.set(F.doc(db, "meta", "founders"), { count });
      await b.commit();
    }
    await this.founders(true);
    return { awarded: todo.length, count };
  },
  // Job alert emails: the unsubscribe link works without signing in. The daily alert job applies it.
  async unsubscribe(token) {
    if (!/^[A-Za-z0-9]{32}$/.test(token || "")) throw Object.assign(new Error("bad-token"), { code: "bad-token" });
    await F.setDoc(F.doc(db, "unsubscribes", token), { at: F.serverTimestamp() });
    // Signed in as the same person? Turn it off on the profile right away too.
    const p = state.profile;
    if (p && p.alertsToken === token && p.alerts) {
      await F.updateDoc(F.doc(db, "users", uid()), { alerts: false, updatedAt: F.serverTimestamp() }).catch(() => {});
      const extra = await loadProfile(auth.currentUser); state = { ...state, ...extra }; emit();
    }
  },
  async deleteProfile() {
    await F.deleteDoc(F.doc(db, "users", uid()));
    state = { ...state, profile: null }; emit();
  },
  async uploadResume(file) {
    if (!storage) throw new Error("Uploads are not enabled");
    const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-60);
    const ref = S.ref(storage, `resumes/${uid()}/${Date.now()}-${safe}`);
    await S.uploadBytes(ref, file, { contentType: file.type });
    return { url: await S.getDownloadURL(ref), name: file.name };
  },

  /* ---- Jobs ---- */
  async listPublic() { return jobsQ(F.where("status", "==", "approved"), F.limit(500)); },
  async getJob(id) {
    try { const s = await F.getDoc(F.doc(db, "jobs", id)); return s.exists() ? norm(s) : null; }
    catch { return null; }
  },
  async getContact(jobId) {
    try { const s = await F.getDoc(F.doc(db, "jobs", jobId, "private", "contact")); return s.exists() ? s.data() : null; }
    catch { return null; }
  },
  async createJob(data, contact) {
    const ref = F.doc(F.collection(db, "jobs"));
    const b = F.writeBatch(db);
    b.set(ref, { ...data, ownerUid: uid(), status: "pending", featured: false, createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp(), approvedAt: null, expiresAt: null });
    b.set(F.doc(db, "jobs", ref.id, "private", "contact"), contact);
    if (!state.isAdmin) await this._bump(b, "posts");
    await b.commit();
    return { id: ref.id };
  },
  async myJobs() { return jobsQ(F.where("ownerUid", "==", uid())); },
  async listByStatus(status) { return jobsQ(F.where("status", "==", status)); },
  async updateJob(id, patch) { await F.updateDoc(F.doc(db, "jobs", id), { ...patch, updatedAt: F.serverTimestamp() }); },
  // An edited post that was already live keeps its original posting date and expiry,
  // so editing can't bump a post to the top or extend it for free.
  async approve(id, job = null) {
    const keep = job && job.approvedAt && job.expiresAt && job.expiresAt > Date.now();
    await F.updateDoc(F.doc(db, "jobs", id), keep
      ? { status: "approved", updatedAt: F.serverTimestamp() }
      : { status: "approved", approvedAt: F.serverTimestamp(), updatedAt: F.serverTimestamp(), expiresAt: F.Timestamp.fromMillis(Date.now() + LISTING_DAYS * DAY) });
  },
  // Employer edits their own post. It goes back to review (status pending) until an admin re-approves it.
  async editJob(id, data, contact) {
    const patch = { status: "pending", editedAt: F.serverTimestamp(), updatedAt: F.serverTimestamp() };
    EDITABLE.forEach((k) => { patch[k] = k in data && data[k] !== undefined ? data[k] : F.deleteField(); });
    const b = F.writeBatch(db);
    b.update(F.doc(db, "jobs", id), patch);
    b.set(F.doc(db, "jobs", id, "private", "contact"), contact);
    await b.commit();
  },
  async deleteJob(id) {
    await F.deleteDoc(F.doc(db, "jobs", id, "private", "contact")).catch(() => {});
    await F.deleteDoc(F.doc(db, "jobs", id));
  },

  /* ---- Applications ---- */
  async apply(job, message) {
    const p = state.profile;
    const applicant = {
      fullName: p.fullName, phone: p.phone, city: p.city, messenger: p.messenger || "",
      email: auth.currentUser.email || "", age: ageFrom(p.birthDate), gender: p.gender || "",
      jobCategories: p.jobCategories || [], jobCategoryOther: p.jobCategoryOther || "", jobTypes: p.jobTypes || [], experienceYears: p.experienceYears ?? null,
      skills: p.skills || "", workHistory: p.workHistory || "", education: p.education || "",
      availability: p.availability || "", resumeUrl: p.resumeUrl || "",
      resumeFileUrl: p.resumeFileUrl || "", resumeFileName: p.resumeFileName || "", photo: p.photo || "",
    };
    const appId = `${job.id}_${uid()}`;
    const b = F.writeBatch(db);
    b.set(F.doc(db, "applications", appId), {
      jobId: job.id, jobTitle: job.title, jobCity: job.city, jobSchedule: job.schedule || job.employmentType || "",
      jobArrangement: job.arrangement || "", employerName: job.employerName || "", employerUid: job.ownerUid, applicantUid: uid(),
      applicant, message: message || "", status: "new", createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp(),
    });
    await this._bump(b, "applies");
    await b.commit();
    await this.notify(job.ownerUid, { type: "application", title: `New applicant for ${job.title}`, body: `${p.fullName} applied.`, link: `#/applicants/${job.id}`, appId, jobId: job.id }).catch(() => {});
  },
  async myApplications() { return appsQ(F.where("applicantUid", "==", uid())); },
  async applicationsForJob(jobId) { return appsQ(F.where("jobId", "==", jobId), F.where("employerUid", "==", uid())); },
  // Admin: everyone who applied to any post (read-only view).
  async applicationsForJobAdmin(jobId) { return appsQ(F.where("jobId", "==", jobId)); },
  async applicationsForEmployer() { return appsQ(F.where("employerUid", "==", uid())); },
  async setApplicationStatus(a, status, { silent = false, note } = {}) {
    await F.updateDoc(F.doc(db, "applications", a.id), { status, updatedAt: F.serverTimestamp(), declinedAt: status === "not_selected" ? F.serverTimestamp() : null });
    if (silent) return;
    if (note) return this.notify(a.applicantUid, { ...note, appId: a.id, jobId: a.jobId }).catch(() => {});
    const msg = {
      shortlisted: ["You're shortlisted", `The employer shortlisted you for ${a.jobTitle}. Expect a call or message soon.`],
      offered: ["You got a job offer!", `${a.employerName || "The employer"} offered you the ${a.jobTitle} job. Accept or decline it.`],
      not_selected: ["Application update", `The employer chose other applicants for ${a.jobTitle}. Your chat with them stays open for 48 hours.`],
    }[status];
    if (msg) await this.notify(a.applicantUid, { type: `app_${status}`, title: msg[0], body: msg[1], link: `#/chat/${a.id}`, appId: a.id, jobId: a.jobId }).catch(() => {});
  },
  // Jobseeker answers a job offer.
  async respondOffer(a, accept) {
    await F.updateDoc(F.doc(db, "applications", a.id), accept
      ? { status: "hired", acceptedAt: F.serverTimestamp(), updatedAt: F.serverTimestamp() }
      : { status: "offer_declined", declinedAt: F.serverTimestamp(), updatedAt: F.serverTimestamp() });
    const who = a.applicant?.fullName || "The applicant";
    await this.notify(a.employerUid, accept
      ? { type: "offer_accepted", title: `${who} accepted your offer`, body: `${who} accepted the ${a.jobTitle} job. You're all set!`, link: `#/applicants/${a.jobId}`, appId: a.id, jobId: a.jobId }
      : { type: "offer_declined", title: `${who} declined your offer`, body: `${who} declined the ${a.jobTitle} job. Your chat stays open for 48 hours.`, link: `#/applicants/${a.jobId}`, appId: a.id, jobId: a.jobId }).catch(() => {});
  },
  // Ending employment needs both sides. kind: "request" | "cancel" | "decline" | "confirm"
  async employment(a, kind) {
    const ref = F.doc(db, "applications", a.id); const me = uid(); const iAmEmployer = a.employerUid === me;
    const patch = { updatedAt: F.serverTimestamp() };
    if (kind === "request") Object.assign(patch, { endRequestedBy: me, endRequestedAt: F.serverTimestamp() });
    if (kind === "cancel" || kind === "decline") Object.assign(patch, { endRequestedBy: null });
    if (kind === "confirm") Object.assign(patch, { employmentEnded: true, endedAt: F.serverTimestamp() });
    await F.updateDoc(ref, patch);
    const other = iAmEmployer ? a.applicantUid : a.employerUid;
    const who = iAmEmployer ? (a.employerName || "The employer") : (a.applicant?.fullName || "Your worker");
    const msg = {
      request: [`${who} says the job has ended`, `Please confirm that the ${a.jobTitle} job has ended.`],
      decline: ["Job hasn't ended yet", `${who} says the ${a.jobTitle} job is still going.`],
      confirm: ["Job ended", `${who} confirmed the ${a.jobTitle} job has ended.`],
    }[kind];
    if (msg) await this.notify(other, { type: `emp_${kind}`, title: msg[0], body: msg[1], link: iAmEmployer ? "#/applications" : `#/applicants/${a.jobId}`, appId: a.id, jobId: a.jobId }).catch(() => {});
  },
  async withdraw(id) { await F.deleteDoc(F.doc(db, "applications", id)); },

  /* ---- Delete my account ---- */
  // Firebase only deletes a sign-in account that signed in within the last few minutes, so ask first.
  async reauth(password) {
    const u = auth.currentUser, p = this.providers();
    if (p.includes("password")) {
      if (!password) throw Object.assign(new Error("Enter your password."), { code: "need-password" });
      return A.reauthenticateWithCredential(u, A.EmailAuthProvider.credential(u.email, password));
    }
    if (p.includes("google.com")) return A.reauthenticateWithPopup(u, new A.GoogleAuthProvider());
    if (p.includes("facebook.com")) return A.reauthenticateWithPopup(u, new A.FacebookAuthProvider());
  },
  // Deletes everything about this person that the site can: posts, applications, notifications, ID check,
  // phone check, profile, then the sign-in account. step(text) reports progress.
  async deleteAccount(step = () => {}) {
    const me = uid(), now = F.serverTimestamp();
    const commitAll = async (ops) => { for (let i = 0; i < ops.length; i += 400) { const b = F.writeBatch(db); ops.slice(i, i + 400).forEach((op) => op(b)); await b.commit(); } };
    step("Removing your applications…");
    const mine = await F.getDocs(F.query(F.collection(db, "applications"), F.where("applicantUid", "==", me)));
    await commitAll(mine.docs.map((d) => (b) => d.data().lastMessageAt
      ? b.update(d.ref, { applicant: { fullName: "Deleted user" }, applicantDeleted: true, deletedAt: now, updatedAt: now })
      : b.delete(d.ref)));
    step("Removing your job posts…");
    const received = await F.getDocs(F.query(F.collection(db, "applications"), F.where("employerUid", "==", me)));
    await commitAll(received.docs.map((d) => (b) => b.update(d.ref, { employerName: "Deleted user", employerDeleted: true, deletedAt: now, updatedAt: now })));
    const jobs = await F.getDocs(F.query(F.collection(db, "jobs"), F.where("ownerUid", "==", me)));
    for (const j of jobs.docs) { await F.deleteDoc(F.doc(db, "jobs", j.id, "private", "contact")).catch(() => {}); await F.deleteDoc(j.ref); }
    step("Removing your notifications…");
    const notes = await F.getDocs(F.query(F.collection(db, "notifications"), F.where("toUid", "==", me)));
    await commitAll(notes.docs.map((d) => (b) => b.delete(d.ref)));
    step("Removing your profile…");
    await Promise.all(["verifyRequests", "phoneVerified", "verified"].map((c) => F.deleteDoc(F.doc(db, c, me)).catch(() => {})));
    await F.deleteDoc(F.doc(db, "users", me));
    step("Deleting your sign-in…");
    await auth.currentUser.delete();
  },

  /* ---- Messages ---- */
  watchApplications(role, cb) {
    const field = role === "employer" ? "employerUid" : "applicantUid";
    return F.onSnapshot(F.query(F.collection(db, "applications"), F.where(field, "==", uid())),
      (s) => cb(s.docs.map((d) => { const x = norm(d); ["lastMessageAt", "applicantSeenAt", "employerSeenAt", "declinedAt"].forEach((k) => (x[k] = toMs(d.data()[k]))); return x; })), () => cb([]));
  },
  async getApplication(id) {
    try { const s = await F.getDoc(F.doc(db, "applications", id)); if (!s.exists()) return null; const x = norm(s); ["lastMessageAt", "applicantSeenAt", "employerSeenAt", "declinedAt"].forEach((k) => (x[k] = toMs(s.data()[k]))); return x; }
    catch { return null; }
  },
  watchMessages(appId, cb) {
    return F.onSnapshot(F.query(F.collection(db, "applications", appId, "messages"), F.orderBy("createdAt", "asc"), F.limit(500)),
      (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toMs(d.data().createdAt) || Date.now(), pending: d.metadata.hasPendingWrites }))), (e) => cb(null, e));
  },
  async sendMessage(a, text, photo = "") {
    const me = uid(); const iAmEmployer = a.employerUid === me;
    const u = await this.usage();
    if (u.msgAt && typeof u.msgAt.toMillis === "function" && Date.now() - u.msgAt.toMillis() < 2500) throw Object.assign(new Error("slow"), { code: "too-fast" });
    const b = F.writeBatch(db);
    b.set(F.doc(F.collection(db, "applications", a.id, "messages")), { fromUid: me, text, createdAt: F.serverTimestamp(), ...(photo ? { photo } : {}) });
    const preview = photo ? `📷 Photo${text ? `: ${text}` : ""}` : text;
    await this._bump(b, "messages", { msgAt: F.serverTimestamp() });
    await b.commit();
    const otherSeen = iAmEmployer ? a.applicantSeenAt : a.employerSeenAt;
    const otherCaughtUp = !a.lastMessageAt || a.lastMessageFrom === (iAmEmployer ? a.applicantUid : a.employerUid) || (otherSeen && otherSeen >= a.lastMessageAt);
    await F.updateDoc(F.doc(db, "applications", a.id), {
      lastMessageAt: F.serverTimestamp(), lastMessageFrom: me, lastMessageText: preview.slice(0, 140),
      [iAmEmployer ? "employerSeenAt" : "applicantSeenAt"]: F.serverTimestamp(),
    });
    if (otherCaughtUp) {
      const fromName = iAmEmployer ? (a.employerName || "The employer") : (a.applicant?.fullName || "An applicant");
      await this.notify(iAmEmployer ? a.applicantUid : a.employerUid, { type: "message", title: `New message from ${fromName}`, body: preview.slice(0, 120), link: `#/chat/${a.id}`, appId: a.id, jobId: a.jobId }).catch(() => {});
    }
  },
  async markSeen(a) {
    const field = a.employerUid === uid() ? "employerSeenAt" : "applicantSeenAt";
    await F.updateDoc(F.doc(db, "applications", a.id), { [field]: F.serverTimestamp() }).catch(() => {});
  },

  /* ---- Notifications ---- */
  async notify(toUid, n) {
    if (!toUid || toUid === uid()) return;
    await F.addDoc(F.collection(db, "notifications"), {
      toUid, fromUid: uid(), type: n.type, title: n.title.slice(0, 120), body: (n.body || "").slice(0, 300),
      link: n.link || "", appId: n.appId || "", jobId: n.jobId || "", read: false, createdAt: F.serverTimestamp(),
    });
  },
  watchNotifications(cb) {
    return F.onSnapshot(F.query(F.collection(db, "notifications"), F.where("toUid", "==", uid()), F.limit(60)),
      (s) => cb(s.docs.map(norm).sort((a, b) => (b.createdAt || Date.now()) - (a.createdAt || Date.now()))), () => cb([]));
  },
  async markRead(ids) { await Promise.all(ids.map((id) => F.updateDoc(F.doc(db, "notifications", id), { read: true }))); },
  async pendingCount() { try { return (await jobsQ(F.where("status", "==", "pending"))).length; } catch { return 0; } },

  /* ---- Support ---- */
  async sendSupport(d) {
    if (!uid()) return void (await F.addDoc(F.collection(db, "support"), { ...d, uid: "", createdAt: F.serverTimestamp() }));
    const b = F.writeBatch(db);
    b.set(F.doc(F.collection(db, "support")), { ...d, uid: uid(), createdAt: F.serverTimestamp() });
    await this._bump(b, "support");
    await b.commit();
  },
  // Admin analytics: everything in one go (fine at early scale; capped per collection).
  async adminAll() {
    const q = async (c) => (await F.getDocs(F.query(F.collection(db, c), F.limit(5000)))).docs.map(norm);
    const [users, jobs, apps, reports, support, bans, verified, visits, campaigns] = await Promise.all([q("users"), q("jobs"), q("applications"), q("reports").catch(() => []), q("support").catch(() => []), q("bans").catch(() => []), q("verified").catch(() => []), q("visits").catch(() => []), q("campaigns").catch(() => [])]);
    return { users, jobs, apps, reports, support, bans, verified, visits, campaigns };
  },
  // Tracked links / ad campaigns (admin only): name = the ?src= value.
  async saveCampaign(src, data) { await F.setDoc(F.doc(db, "campaigns", src), { ...data, updatedAt: F.serverTimestamp() }, { merge: true }); },
  async deleteCampaign(src) { await F.deleteDoc(F.doc(db, "campaigns", src)); },
  async adminUser(id) {
    const [u, b, posts, applied] = await Promise.all([
      F.getDoc(F.doc(db, "users", id)), F.getDoc(F.doc(db, "bans", id)).catch(() => null),
      jobsQ(F.where("ownerUid", "==", id)), appsQ(F.where("applicantUid", "==", id)),
    ]);
    const received = (await appsQ(F.where("employerUid", "==", id)).catch(() => []));
    return { user: u.exists() ? norm(u) : null, ban: b?.exists() ? norm(b) : null, posts, applied, received };
  },
  async ban(id, { reason, note, name }) {
    await F.setDoc(F.doc(db, "bans", id), { reason, note: note || "", name: name || "", bannedAt: F.serverTimestamp(), bannedBy: uid() });
  },
  async unban(id) { await F.deleteDoc(F.doc(db, "bans", id)); },
  /* ---- Verified employers (checked by an admin) ---- */
  async verifiedList(force = false) {
    if (!force && verifiedCache) return verifiedCache;
    try { const snap = await F.getDocs(F.collection(db, "verified")); verifiedCache = Object.fromEntries(snap.docs.map((d) => [d.id, norm(d)])); }
    catch { verifiedCache = verifiedCache || {}; }
    return verifiedCache;
  },
  /* ---- Get Verified: employer sends an ID photo + selfie; an admin approves or rejects ---- */
  async myVerifyRequest() {
    try { const s = await F.getDoc(F.doc(db, "verifyRequests", uid())); return s.exists() ? norm(s) : null; } catch { return null; }
  },
  async submitVerify({ idType, idPhoto, selfie, fbUrl }) {
    await F.setDoc(F.doc(db, "verifyRequests", uid()), { idType, idPhoto, selfie, fbUrl: fbUrl || "", consent: true, status: "pending", createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp() });
  },
  async withdrawVerify() { await F.deleteDoc(F.doc(db, "verifyRequests", uid())); },
  async listVerifyRequests() { return (await F.getDocs(F.query(F.collection(db, "verifyRequests"), F.where("status", "==", "pending")))).docs.map(norm); },
  // Approve or reject. Either way the ID photo and selfie are deleted right away; only the decision is kept.
  async decideVerify(id, { approve, reason = "", idType = "" }) {
    const b = F.writeBatch(db);
    b.update(F.doc(db, "verifyRequests", id), { status: approve ? "approved" : "rejected", reason: reason.slice(0, 200), decidedAt: F.serverTimestamp(), updatedAt: F.serverTimestamp(), idPhoto: F.deleteField(), selfie: F.deleteField() });
    if (approve) b.set(F.doc(db, "verified", id), { method: `ID + selfie${idType ? ` (${idType})` : ""}`.slice(0, 60), at: F.serverTimestamp(), by: uid() });
    await b.commit();
    return this.verifiedList(true);
  },
  async verify(id, method) {
    await F.setDoc(F.doc(db, "verified", id), { method, at: F.serverTimestamp(), by: uid() });
    return this.verifiedList(true);
  },
  async unverify(id) { await F.deleteDoc(F.doc(db, "verified", id)); return this.verifiedList(true); },
  // Admin asks the employer for more before approving. The post stays pending.
  async askInfo(jobId, note) { await this.updateJob(jobId, { infoNote: note, infoAt: F.serverTimestamp() }); },
  async listSupport() {
    const s = await F.getDocs(F.query(F.collection(db, "support"), F.orderBy("createdAt", "desc"), F.limit(200)));
    return s.docs.map(norm);
  },
  async closeSupport(id) { await F.updateDoc(F.doc(db, "support", id), { status: "done", doneAt: F.serverTimestamp() }); },
  async reopenSupport(id) { await F.updateDoc(F.doc(db, "support", id), { status: "open", doneAt: null }); },

  /* ---- Reports ---- */
  async report(jobId, reason, details) {
    const b = F.writeBatch(db);
    b.set(F.doc(F.collection(db, "reports")), { jobId, reason, details, createdAt: F.serverTimestamp() });
    await this._bump(b, "reports");
    await b.commit();
  },
  async listReports() {
    const s = await F.getDocs(F.query(F.collection(db, "reports"), F.orderBy("createdAt", "desc"), F.limit(200)));
    return s.docs.map(norm);
  },
  // Chat messages flagged by the email robot (scripts/send-emails.mjs).
  async listFlags() {
    const s = await F.getDocs(F.query(F.collection(db, "flags"), F.orderBy("createdAt", "desc"), F.limit(200)));
    return s.docs.map(norm);
  },
  async dismissFlag(id) { await F.deleteDoc(F.doc(db, "flags", id)); },
  async dismissReport(id) { await F.deleteDoc(F.doc(db, "reports", id)); },
  async clearReportsFor(jobId) {
    const s = await F.getDocs(F.query(F.collection(db, "reports"), F.where("jobId", "==", jobId)));
    await Promise.all(s.docs.map((d) => F.deleteDoc(d.ref)));
  },
};
