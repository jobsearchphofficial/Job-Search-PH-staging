// Data layer: Firebase Auth + Firestore (+ Storage for resume files when enabled).
import { firebaseConfig, IS_STAGING, LISTING_DAYS, RESUME_UPLOADS } from "./firebase-config.js?v=1793122887";

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

// Fields an employer submits for the public post. Contact details are stored privately.
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
  ["createdAt", "approvedAt", "expiresAt", "updatedAt", "declinedAt", "lastMessageAt", "applicantSeenAt", "employerSeenAt", "endRequestedAt", "endedAt", "acceptedAt", "bannedAt", "doneAt", "infoAt", "at"].forEach((k) => { if (k in d) out[k] = toMs(d[k]); });
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

async function loadProfile(user) {
  if (!user) return { profile: null, isAdmin: false, banned: null };
  const [p, a, b] = await Promise.all([
    F.getDoc(F.doc(db, "users", user.uid)).catch(() => null),
    F.getDoc(F.doc(db, "admins", user.uid)).catch(() => null),
    F.getDoc(F.doc(db, "bans", user.uid)).catch(() => null),
  ]);
  return { profile: p?.exists() ? norm(p) : null, isAdmin: !!a?.exists(), banned: b?.exists() ? norm(b) : null };
}

/* ---- Where visitors came from (?src=fb-bacolod-group). First touch, kept 60 days, no personal data. ---- */
(() => {
  try {
    const q = new URLSearchParams(location.search);
    const raw = q.get("src") || q.get("utm_source") || q.get("ref") || (q.has("fbclid") ? "facebook" : "");
    const clean = String(raw).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    const cur = JSON.parse(localStorage.getItem("jsph-src") || "null");
    if (clean && (!cur || Date.now() - cur.at > 60 * 86400000)) localStorage.setItem("jsph-src", JSON.stringify({ src: clean, at: Date.now() }));
    if (raw || q.has("fbclid")) { ["src", "utm_source", "utm_medium", "utm_campaign", "ref", "fbclid"].forEach((k) => q.delete(k)); const qs = q.toString(); history.replaceState(null, "", location.pathname + (qs ? `?${qs}` : "") + location.hash); }
  } catch {}
})();
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
    A.onAuthStateChanged(auth, async (user) => {
      const extra = await loadProfile(user);
      state = { user: user ? { uid: user.uid, displayName: user.displayName, email: user.email } : null, ...extra, ready: true };
      emit();
    });
  },

  /* ---- Auth ---- */
  async signInGoogle() { await A.signInWithPopup(auth, new A.GoogleAuthProvider()); },
  async signInEmail(email, pw) { await A.signInWithEmailAndPassword(auth, email, pw); },
  async signUpEmail(email, pw, name) {
    const cred = await A.createUserWithEmailAndPassword(auth, email, pw);
    if (name) await A.updateProfile(cred.user, { displayName: name }).catch(() => {});
  },
  async resetPassword(email) { await A.sendPasswordResetEmail(auth, email); },
  async signOut() { await A.signOut(auth); },

  /* ---- Profile ---- */
  async saveProfile(data) {
    const ref = F.doc(db, "users", uid());
    const exists = !!state.profile;
    const cu = auth.currentUser;
    const signIn = cu?.providerData?.some((p) => p.providerId === "google.com") ? "google" : cu?.providerData?.some((p) => p.providerId === "password") ? "password" : "";
    const payload = { ...data, consent: true, email: cu?.email || "", signIn, emailVerified: !!cu?.emailVerified, updatedAt: F.serverTimestamp() };
    if (!exists) { payload.createdAt = F.serverTimestamp(); const src = visitSource(); if (src) payload.src = src; }
    try { await F.setDoc(ref, payload, { merge: true }); }
    catch (e) { // older published rules don't know the newest optional fields yet: save without them
      if (e.code !== "permission-denied") throw e;
      ["src", "jobCategoryOther", "fbUrl", "bizReg", "signIn", "emailVerified", "alerts", "alertsScope", "alertsToken"].forEach((k) => delete payload[k]);
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
  async approve(id) {
    await F.updateDoc(F.doc(db, "jobs", id), {
      status: "approved", approvedAt: F.serverTimestamp(), updatedAt: F.serverTimestamp(),
      expiresAt: F.Timestamp.fromMillis(Date.now() + LISTING_DAYS * DAY),
    });
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
      jobCategories: p.jobCategories || [], jobCategoryOther: p.jobCategoryOther || "", experienceYears: p.experienceYears ?? null,
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
  async sendMessage(a, text) {
    const me = uid(); const iAmEmployer = a.employerUid === me;
    const u = await this.usage();
    if (u.msgAt && typeof u.msgAt.toMillis === "function" && Date.now() - u.msgAt.toMillis() < 2500) throw Object.assign(new Error("slow"), { code: "too-fast" });
    const b = F.writeBatch(db);
    b.set(F.doc(F.collection(db, "applications", a.id, "messages")), { fromUid: me, text, createdAt: F.serverTimestamp() });
    await this._bump(b, "messages", { msgAt: F.serverTimestamp() });
    await b.commit();
    const otherSeen = iAmEmployer ? a.applicantSeenAt : a.employerSeenAt;
    const otherCaughtUp = !a.lastMessageAt || a.lastMessageFrom === (iAmEmployer ? a.applicantUid : a.employerUid) || (otherSeen && otherSeen >= a.lastMessageAt);
    await F.updateDoc(F.doc(db, "applications", a.id), {
      lastMessageAt: F.serverTimestamp(), lastMessageFrom: me, lastMessageText: text.slice(0, 140),
      [iAmEmployer ? "employerSeenAt" : "applicantSeenAt"]: F.serverTimestamp(),
    });
    if (otherCaughtUp) {
      const fromName = iAmEmployer ? (a.employerName || "The employer") : (a.applicant?.fullName || "An applicant");
      await this.notify(iAmEmployer ? a.applicantUid : a.employerUid, { type: "message", title: `New message from ${fromName}`, body: text.slice(0, 120), link: `#/chat/${a.id}`, appId: a.id, jobId: a.jobId }).catch(() => {});
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
    const [users, jobs, apps, reports, support, bans, verified] = await Promise.all([q("users"), q("jobs"), q("applications"), q("reports").catch(() => []), q("support").catch(() => []), q("bans").catch(() => []), q("verified").catch(() => [])]);
    return { users, jobs, apps, reports, support, bans, verified };
  },
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
  async dismissReport(id) { await F.deleteDoc(F.doc(db, "reports", id)); },
  async clearReportsFor(jobId) {
    const s = await F.getDocs(F.query(F.collection(db, "reports"), F.where("jobId", "==", jobId)));
    await Promise.all(s.docs.map((d) => F.deleteDoc(d.ref)));
  },
};
