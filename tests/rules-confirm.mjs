import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, writeBatch, serverTimestamp } from "firebase/firestore";
const env = await initializeTestEnvironment({ projectId: "demo-jsph", firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8085 } });
const job = (uid) => ({ title: "Live-in Yaya", category: "Yaya / Nanny", employerName: "Reyes", city: "Bacolod City", employmentType: "Live-in", salaryMin: 8000, salaryMax: null, salaryPeriod: "month",
  description: "Care for one baby and light cleaning, family of four.", requirements: "", ownerUid: uid, status: "pending", featured: false, plan: "unpaid", appCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), approvedAt: null, expiresAt: null });
const now = new Date(Date.now() + 8 * 3600000); const month = now.getUTCFullYear() * 12 + now.getUTCMonth() + 1; const day = Math.floor((Date.now() + 28800000) / 86400000);
const post = async (uid, token, id) => { const db = env.authenticatedContext(uid, token).firestore(); const b = writeBatch(db);
  b.set(doc(db, "jobs", id), job(uid)); b.set(doc(db, "limits", uid), { day, month, applies: 0, posts: 0, messages: 0, reports: 0, support: 0, postsM: 1 }); await b.commit(); };
let bad = 0; const t = async (n, p) => { try { await p; console.log("PASS", n); } catch (e) { bad++; console.log("FAIL", n, e.message?.slice(0, 100)); } };
await t("unconfirmed email+password can't post", assertFails(post("u1", { email_verified: false, firebase: { sign_in_provider: "password" } }, "a")));
await t("confirmed email+password can post", assertSucceeds(post("u2", { email_verified: true, firebase: { sign_in_provider: "password" } }, "b")));
await t("Google sign-in can post", assertSucceeds(post("u3", { email_verified: true, firebase: { sign_in_provider: "google.com" } }, "c")));
await t("Facebook sign-in can post (Facebook emails often show unconfirmed)", assertSucceeds(post("u4", { email_verified: false, firebase: { sign_in_provider: "facebook.com" } }, "d")));
console.log(bad ? `${bad} FAILED` : "all passed"); await env.cleanup(); process.exit(bad ? 1 : 0);
