import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, setDoc, updateDoc, serverTimestamp, Timestamp, writeBatch, deleteField } from "firebase/firestore";
const env = await initializeTestEnvironment({ projectId: "demo-jsph", firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8085 } });
const job = { title: "Live-in Yaya", category: "Yaya / Nanny", employerName: "Reyes Family", city: "Bacolod City", employmentType: "Live-in", salaryMin: 8000, salaryMax: 9000, salaryPeriod: "month",
  description: "Take care of a 2 year old, light housework, family of four.", requirements: "", ownerUid: "emp", status: "approved", featured: false,
  createdAt: Timestamp.fromMillis(Date.now() - 86400000), updatedAt: Timestamp.now(), approvedAt: Timestamp.fromMillis(Date.now() - 3600000), expiresAt: Timestamp.fromMillis(Date.now() + 20 * 86400000),
  workplace: "household", arrangement: "Live-in", schedule: "Full-time", infoNote: "Facebook link", infoAt: Timestamp.now() };
const seed = async (id, extra = {}) => env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "jobs", id), { ...job, ...extra }); });
const emp = env.authenticatedContext("emp").firestore();
const other = env.authenticatedContext("other").firestore();
const edit = (db, id, extra = {}) => updateDoc(doc(db, "jobs", id), { salaryMin: 9000, salaryMax: 10000, status: "pending", editedAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra });
let bad = 0; const t = async (n, p) => { try { await p; console.log("PASS", n); } catch (e) { bad++; console.log("FAIL", n, e.message?.slice(0, 120)); } };
await seed("j1"); await t("owner edits live post -> back to pending", assertSucceeds(edit(emp, "j1")));
await seed("j2"); await t("edit that keeps it approved is refused", assertFails(edit(emp, "j2", { status: "approved" })));
await seed("j3"); await t("edit can't change expiry", assertFails(edit(emp, "j3", { expiresAt: Timestamp.fromMillis(Date.now() + 99 * 86400000) })));
await seed("j4"); await t("edit can't set featured", assertFails(edit(emp, "j4", { featured: true })));
await seed("j5"); await t("edit can't change approvedAt", assertFails(edit(emp, "j5", { approvedAt: serverTimestamp() })));
await seed("j6"); await t("edit can't change owner", assertFails(edit(emp, "j6", { ownerUid: "other" })));
await seed("j7"); await t("edit can't clear admin note", assertFails(edit(emp, "j7", { infoNote: deleteField() })));
await seed("j8", { status: "closed" }); await t("closed post can't be edited", assertFails(edit(emp, "j8")));
await seed("j9"); await t("someone else can't edit", assertFails(edit(other, "j9")));
await seed("j10"); await t("edit needs editedAt = now", assertFails(edit(emp, "j10", { editedAt: Timestamp.fromMillis(0) })));
await seed("j11"); await t("edit must still be a valid post (short description)", assertFails(edit(emp, "j11", { description: "too short" })));
await seed("j12", { status: "rejected" }); await t("rejected post can be fixed and resubmitted", assertSucceeds(edit(emp, "j12")));
await seed("j13"); await t("removing optional field (area) works", assertSucceeds(edit(emp, "j13", { area: deleteField() })));
await seed("j14"); await t("owner can still close a post", assertSucceeds(updateDoc(doc(emp, "jobs", "j14"), { status: "closed", updatedAt: serverTimestamp() })));
await seed("j15"); await env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), "bans", "emp"), { reason: "x" }));
await t("banned owner can't edit", assertFails(edit(emp, "j15")));
await env.withSecurityRulesDisabled(async (c) => { const { deleteDoc } = await import("firebase/firestore"); await deleteDoc(doc(c.firestore(), "bans", "emp")); });
await seed("j16"); await t("edit + contact update in one batch", assertSucceeds((async () => { const b = writeBatch(emp); b.update(doc(emp, "jobs", "j16"), { salaryMin: 9500, status: "pending", editedAt: serverTimestamp(), updatedAt: serverTimestamp() }); b.set(doc(emp, "jobs", "j16", "private", "contact"), { contactMethod: "phone", contactValue: "09171234567" }); await b.commit(); })()));
console.log(`\n${bad ? bad + " FAILED" : "all passed"}`);
await env.cleanup(); process.exit(bad ? 1 : 0);
