// How a job ends: each side's reason, the 7-day close, replies, reviews, and employer records.
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, setDoc, updateDoc, getDoc, serverTimestamp, Timestamp } from "firebase/firestore";
const env = await initializeTestEnvironment({ projectId: "demo-jsph", firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8085 } });
const emp = env.authenticatedContext("emp").firestore(), seek = env.authenticatedContext("seek").firestore(), other = env.authenticatedContext("x").firestore(), anon = env.unauthenticatedContext().firestore();
const hired = (id, extra = {}) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "applications", id), {
  jobId: "j1", jobTitle: "Yaya", employerUid: "emp", applicantUid: "seek", employerName: "Private household", applicant: { fullName: "Maria Santos", phone: "09171234567" },
  status: "hired", createdAt: Timestamp.now(), updatedAt: Timestamp.now(), acceptedAt: Timestamp.now(), ...extra }));
const ts = serverTimestamp;
let bad = 0; const t = async (n, p) => { try { await p; console.log("PASS", n); } catch (e) { bad++; console.log("FAIL", n, e.message?.slice(0, 120)); } };
const A = (db, id) => doc(db, "applications", id);

await hired("a1");
await t("employer can't ask to end without a reason", assertFails(updateDoc(A(emp, "a1"), { endRequestedBy: "emp", endRequestedAt: ts(), updatedAt: ts() })));
await t("employer can't use a worker's reason", assertFails(updateDoc(A(emp, "a1"), { endRequestedBy: "emp", endRequestedAt: ts(), endReasonEmployer: "unpaid", updatedAt: ts() })));
await t("employer can't write the worker's reason", assertFails(updateDoc(A(emp, "a1"), { endRequestedBy: "emp", endRequestedAt: ts(), endReasonWorker: "resigned", updatedAt: ts() })));
await t("employer asks to end: they stopped showing up", assertSucceeds(updateDoc(A(emp, "a1"), { endRequestedBy: "emp", endRequestedAt: ts(), endReasonEmployer: "no_show", updatedAt: ts() })));
await t("employer can't close it before 7 days", assertFails(updateDoc(A(emp, "a1"), { employmentEnded: true, endedAt: ts(), endUnanswered: true, updatedAt: ts() })));
await t("a stranger can't touch it", assertFails(updateDoc(A(other, "a1"), { endRequestedBy: null, updatedAt: ts() })));
await env.withSecurityRulesDisabled((c) => updateDoc(A(c.firestore(), "a1"), { endRequestedAt: Timestamp.fromMillis(Date.now() - 8 * 864e5) }));
await t("worker can't close the employer's request", assertFails(updateDoc(A(seek, "a1"), { employmentEnded: true, endedAt: ts(), endUnanswered: true, updatedAt: ts() })));
await t("employer can't change their reason while closing", assertFails(updateDoc(A(emp, "a1"), { employmentEnded: true, endedAt: ts(), endUnanswered: true, endReasonEmployer: "finished", updatedAt: ts() })));
await t("after 7 days with no answer, employer closes it", assertSucceeds(updateDoc(A(emp, "a1"), { employmentEnded: true, endedAt: ts(), endUnanswered: true, updatedAt: ts() })));
await t("worker adds their side", assertSucceeds(updateDoc(A(seek, "a1"), { replyWorker: "I was in the hospital and my phone was lost.", updatedAt: ts() })));
await t("worker can't write the employer's reply", assertFails(updateDoc(A(seek, "a1"), { replyEmployer: "x", updatedAt: ts() })));
await t("worker can't change the employer's reason", assertFails(updateDoc(A(seek, "a1"), { endReasonEmployer: "finished", updatedAt: ts() })));
await t("worker asks for a review", assertSucceeds(updateDoc(A(seek, "a1"), { disputeWorker: true, disputeWorkerAt: ts(), updatedAt: ts() })));
await t("worker can't hide the reason themselves", assertFails(updateDoc(A(seek, "a1"), { hideEmployerReason: true, updatedAt: ts() })));
await t("worker can't mark the review done", assertFails(updateDoc(A(seek, "a1"), { disputeWorkerDone: true, updatedAt: ts() })));
await t("reply over 300 characters refused", assertFails(updateDoc(A(seek, "a1"), { replyWorker: "x".repeat(301), updatedAt: ts() })));

await hired("a2");
await t("worker asks to leave: they didn't pay", assertSucceeds(updateDoc(A(seek, "a2"), { endRequestedBy: "seek", endRequestedAt: ts(), endReasonWorker: "unpaid", updatedAt: ts() })));
await t("employer can't confirm without a reason", assertFails(updateDoc(A(emp, "a2"), { employmentEnded: true, endedAt: ts(), updatedAt: ts() })));
await t("employer can't fake 'unanswered' when confirming", assertFails(updateDoc(A(emp, "a2"), { employmentEnded: true, endedAt: ts(), endReasonEmployer: "resigned", endUnanswered: true, updatedAt: ts() })));
await t("employer confirms: they resigned", assertSucceeds(updateDoc(A(emp, "a2"), { employmentEnded: true, endedAt: ts(), endReasonEmployer: "resigned", updatedAt: ts() })));
await t("employer adds their side", assertSucceeds(updateDoc(A(emp, "a2"), { replyEmployer: "Paid in full on the 15th; receipt available.", updatedAt: ts() })));
await t("employer asks for a review", assertSucceeds(updateDoc(A(emp, "a2"), { disputeEmployer: true, disputeEmployerAt: ts(), updatedAt: ts() })));

await hired("a3");
await t("employer asks: contract finished", assertSucceeds(updateDoc(A(emp, "a3"), { endRequestedBy: "emp", endRequestedAt: ts(), endReasonEmployer: "finished", updatedAt: ts() })));
await t("employer can't cancel and keep the reason", assertFails(updateDoc(A(emp, "a3"), { endRequestedBy: null, updatedAt: ts() })));
await t("worker says 'not yet' (employer's reason stays)", assertSucceeds(updateDoc(A(seek, "a3"), { endRequestedBy: null, updatedAt: ts() })));
await t("employer asks again", assertSucceeds(updateDoc(A(emp, "a3"), { endRequestedBy: "emp", endRequestedAt: ts(), endReasonEmployer: "finished", updatedAt: ts() })));
await t("employer cancels (reason cleared)", assertSucceeds(updateDoc(A(emp, "a3"), { endRequestedBy: null, endReasonEmployer: null, updatedAt: ts() })));
await t("worker can't write the job history field", assertFails(updateDoc(A(seek, "a3"), { jsphHistory: [], updatedAt: ts() })));

await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "employerRecord/emp"), { hires: 1, items: [] }));
await t("signed-in user reads an employer's record", assertSucceeds(getDoc(doc(seek, "employerRecord/emp"))));
await t("visitor can't read it", assertFails(getDoc(doc(anon, "employerRecord/emp"))));
await t("employer can't write their own record", assertFails(setDoc(doc(emp, "employerRecord/emp"), { hires: 99, items: [] })));
console.log(bad ? `${bad} FAILED` : "all passed"); await env.cleanup(); process.exit(bad ? 1 : 0);
