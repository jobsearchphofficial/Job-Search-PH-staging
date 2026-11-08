// Paid plans: one free post (5 applicants), Pro by payment or Monthly/Enterprise, payments only admins approve.
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, setDoc, getDoc, updateDoc, writeBatch, serverTimestamp, Timestamp } from "firebase/firestore";
const env = await initializeTestEnvironment({ projectId: "demo-jsph", firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8085 } });
await env.clearFirestore();
const tok = { email_verified: true, firebase: { sign_in_provider: "google.com" } };
const ctx = (u) => env.authenticatedContext(u, tok).firestore();
const now = new Date(Date.now() + 8 * 3600000); const month = now.getUTCFullYear() * 12 + now.getUTCMonth() + 1; const day = Math.floor((Date.now() + 28800000) / 86400000);
const job = (uid, extra = {}) => ({ title: "Live-in Yaya", category: "Yaya / Nanny", employerName: "Reyes", city: "Bacolod City", employmentType: "Live-in", salaryMin: 8000, salaryMax: null, salaryPeriod: "month",
  description: "Care for one baby and light cleaning, family of four.", requirements: "", ownerUid: uid, status: "pending", featured: false, appCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), approvedAt: null, expiresAt: null, ...extra });
const lim = (n, extra = {}) => ({ day, month, applies: 0, posts: 0, messages: 0, reports: 0, support: 0, postsM: n, ...extra });
const post = async (uid, id, plan, { free = false, n = 1, extra = {} } = {}) => { const db = ctx(uid); const b = writeBatch(db);
  b.set(doc(db, "jobs", id), job(uid, { plan, ...extra })); b.set(doc(db, "limits", uid), lim(n));
  if (free) b.set(doc(db, "freeUsed", uid), { jobId: id, at: serverTimestamp() }); await b.commit(); };
const admin = (fn) => env.withSecurityRulesDisabled((c) => fn(c.firestore()));
let bad = 0; const t = async (n, p) => { try { await p; console.log("PASS", n); } catch (e) { bad++; console.log("FAIL", n, e.message?.slice(0, 120)); } };

// Posting
await t("first post free (marks the free post used)", assertSucceeds(post("e1", "f1", "free", { free: true })));
await t("second free post refused", assertFails(post("e1", "f2", "free", { free: true, n: 2 })));
await t("free post without marking it used refused", assertFails(post("e2", "f3", "free")));
await t("free post with 5 openings refused", assertFails(post("e2", "f4", "free", { free: true, extra: { openings: 5 } })));
await t("unpaid post (pay next) allowed, with 10 openings", assertSucceeds(post("e1", "u1", "unpaid", { n: 2, extra: { openings: 10 } })));
await t("can't claim Pro without a plan", assertFails(post("e1", "p1", "pro", { n: 3 })));
await t("can't create a post with applicants already counted", assertFails(post("e1", "u2", "unpaid", { n: 3, extra: { appCount: 3 } })));
await t("can't give yourself a plan", assertFails(setDoc(doc(ctx("e1"), "subs/e1"), { plan: "enterprise", until: Timestamp.fromMillis(Date.now() + 9e9) })));
await t("can't delete your free-post marker", assertFails((async () => { const { deleteDoc } = await import("firebase/firestore"); await deleteDoc(doc(ctx("e1"), "freeUsed/e1")); })()));
await admin((db) => setDoc(doc(db, "subs/e3"), { plan: "monthly", until: Timestamp.fromMillis(Date.now() + 864e5 * 30) }));
await t("Pro monthly: post is Pro", assertSucceeds(post("e3", "p2", "pro")));
await admin((db) => setDoc(doc(db, "limits/e3"), lim(5)));
await t("Pro monthly: 6th post this month refused", assertFails(post("e3", "p3", "pro", { n: 6 })));
await admin((db) => setDoc(doc(db, "subs/e4"), { plan: "enterprise", until: Timestamp.fromMillis(Date.now() + 864e5 * 30) }));
await admin((db) => setDoc(doc(db, "limits/e4"), lim(5)));
await t("Enterprise: 6th post this month allowed", assertSucceeds(post("e4", "p4", "pro", { n: 6 })));
await admin((db) => setDoc(doc(db, "subs/e5"), { plan: "monthly", until: Timestamp.fromMillis(Date.now() - 1000) }));
await t("expired plan: can't post as Pro", assertFails(post("e5", "p5", "pro")));
await t("owner can't make their own post Pro", assertFails(updateDoc(doc(ctx("e1"), "jobs/u1"), { plan: "pro" })));
await t("owner edit can't add openings over 3 on a free post", assertFails(updateDoc(doc(ctx("e1"), "jobs/f1"), { openings: 6, status: "pending", editedAt: serverTimestamp(), updatedAt: serverTimestamp() })));

// Applying to a free post: counted, stops at 5
await admin((db) => setDoc(doc(db, "jobs/f1"), { ...job("e1", { plan: "free", appCount: 0, status: "approved" }), createdAt: Timestamp.now(), updatedAt: Timestamp.now() }));
const apply = async (u, jobId, { bump = true, count = null } = {}) => {
  const db = ctx(u); let j; await admin(async (a) => { j = (await getDoc(doc(a, "jobs", jobId))).data(); }); const b = writeBatch(db);
  b.set(doc(db, "applications", `${jobId}_${u}`), { jobId, jobTitle: j.title, employerUid: j.ownerUid, applicantUid: u, applicant: { fullName: "Maria Santos", phone: "09171234567" }, message: "", status: "new", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  b.set(doc(db, "limits", u), { day, month, applies: 1, posts: 0, messages: 0, reports: 0, support: 0, postsM: 0 });
  if (bump) b.update(doc(db, "jobs", jobId), { appCount: count ?? (j.appCount || 0) + 1 });
  await b.commit(); };
await t("apply to a free post without counting refused", assertFails(apply("s0", "f1", { bump: false })));
await t("apply can't add 2 to the count", assertFails(apply("s0", "f1", { count: 2 })));
for (let i = 1; i <= 5; i++) await t(`applicant ${i} of 5`, assertSucceeds(apply(`s${i}`, "f1")));
await t("6th applicant refused (post is full)", assertFails(apply("s6", "f1")));
await t("can't raise the count without applying", assertFails(updateDoc(doc(ctx("s7"), "jobs/f1"), { appCount: 6 })));
await admin((db) => setDoc(doc(db, "jobs/pp"), { ...job("e1", { plan: "pro", status: "approved" }), createdAt: Timestamp.now(), updatedAt: Timestamp.now() }));
await t("apply to a Pro post (no count needed)", assertSucceeds(apply("s6", "pp", { bump: false })));
await admin((db) => setDoc(doc(db, "jobs/old"), { ...job("e9", { status: "approved" }), createdAt: Timestamp.now(), updatedAt: Timestamp.now() }));
await t("apply to an older post with no plan", assertSucceeds(apply("s8", "old", { bump: false })));

// Payments
const pay = (u, extra = {}) => ({ uid: u, kind: "post", jobId: "u1", jobTitle: "Live-in Yaya", amount: 199, ref: "1234 5678 9012", payerName: "Ana Reyes", src: "", status: "pending", createdAt: serverTimestamp(), ...extra });
const sendPay = async (u, id, extra = {}, pays = 1) => { const db = ctx(u); const b = writeBatch(db); b.set(doc(db, "payments", id), pay(u, extra)); b.set(doc(db, "limits", u), lim(2, { pays })); await b.commit(); };
await t("employer sends a ₱199 payment for their post", assertSucceeds(sendPay("e1", "pay1")));
await t("wrong amount refused", assertFails(sendPay("e1", "pay2", { amount: 1 }, 2)));
await t("monthly must be ₱499", assertSucceeds(sendPay("e1", "pay3", { kind: "monthly", jobId: null, amount: 499 }, 2)));
await t("can't send it already approved", assertFails(sendPay("e1", "pay4", { status: "approved" }, 3)));
await t("can't pay for someone else's post", assertFails(sendPay("e2", "pay5", {}, 1)));
await t("can't pay in someone else's name", assertFails(sendPay("e2", "pay6", { uid: "e1" }, 1)));
await t("employer reads their payment", assertSucceeds(getDoc(doc(ctx("e1"), "payments/pay1"))));
await t("others can't read it", assertFails(getDoc(doc(ctx("e2"), "payments/pay1"))));
await t("employer can't approve it", assertFails(updateDoc(doc(ctx("e1"), "payments/pay1"), { status: "approved" })));
await admin((db) => setDoc(doc(db, "admins/boss"), { name: "Mark" }));
await t("admin approves it", assertSucceeds(updateDoc(doc(ctx("boss"), "payments/pay1"), { status: "approved", decidedAt: serverTimestamp() })));
await t("admin makes the post Pro", assertSucceeds(updateDoc(doc(ctx("boss"), "jobs/u1"), { plan: "pro", paidAt: serverTimestamp() })));
await t("admin gives Enterprise", assertSucceeds(setDoc(doc(ctx("boss"), "subs/e2"), { plan: "enterprise", until: Timestamp.fromMillis(Date.now() + 864e5 * 30) })));
// Closing a post with a reason
await t("owner closes: hired someone", assertSucceeds(updateDoc(doc(ctx("e1"), "jobs/u1"), { status: "closed", closedReason: "filled", updatedAt: serverTimestamp() })));
await admin((db) => setDoc(doc(db, "jobs/c2"), { ...job("e1", { plan: "free", status: "approved" }), createdAt: Timestamp.now(), updatedAt: Timestamp.now() }));
await t("owner closes with a made-up reason refused", assertFails(updateDoc(doc(ctx("e1"), "jobs/c2"), { status: "closed", closedReason: "whatever", updatedAt: serverTimestamp() })));
await t("owner closes: no longer hiring", assertSucceeds(updateDoc(doc(ctx("e1"), "jobs/c2"), { status: "closed", closedReason: "closed", updatedAt: serverTimestamp() })));
console.log(bad ? `${bad} FAILED` : "all passed"); await env.cleanup(); process.exit(bad ? 1 : 0);
