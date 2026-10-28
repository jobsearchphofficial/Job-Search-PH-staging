// Tiny Firestore REST client for the email scripts. No dependencies.
// Signs in with the FIREBASE_SERVICE_ACCOUNT secret (a service-account JSON key), which can read and
// write everything, so security rules don't apply to these scripts.
// For local tests, set FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 (and optionally FIREBASE_PROJECT).

import { createSign } from "node:crypto";

let TOKEN = "", BASE = "";

export function hasFirebaseKey() { return !!process.env.FIREBASE_SERVICE_ACCOUNT || !!process.env.FIRESTORE_EMULATOR_HOST; }

export async function connect() {
  const emu = process.env.FIRESTORE_EMULATOR_HOST;
  if (emu) {
    const project = process.env.FIREBASE_PROJECT || "demo-jsph";
    TOKEN = "owner"; BASE = `http://${emu}/v1/projects/${project}/databases/(default)/documents`;
    console.log(`Firestore emulator: ${emu} (${project})`);
    return project;
  }
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "null");
  if (!sa?.private_key || !sa?.client_email || !sa?.project_id) throw new Error("FIREBASE_SERVICE_ACCOUNT secret is missing or not a service account JSON key.");
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const iat = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 })}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  if (!res.ok) throw new Error(`Google sign-in failed: ${res.status} ${await res.text()}`);
  TOKEN = (await res.json()).access_token;
  BASE = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
  console.log(`Firebase project: ${sa.project_id}`);
  return sa.project_id;
}

async function api(method, path, body, okMissing = false) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (okMissing && res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore ${method} ${path.split("?")[0]} failed: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

export function fromValue(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return Date.parse(v.timestampValue);
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromValue);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromValue(x)]));
  return null;
}
export const toValue = (v) => v === null || v === undefined ? { nullValue: null }
  : typeof v === "boolean" ? { booleanValue: v }
  : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : v instanceof Date ? { timestampValue: v.toISOString() }
  : Array.isArray(v) ? { arrayValue: { values: v.map(toValue) } }
  : typeof v === "object" ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } }
  : { stringValue: String(v) };
const docOut = (d) => ({ id: d.name.split("/").pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, fromValue(v)])) });

// filters: list of [field, op, value]. op is a Firestore REST operator: EQUAL, GREATER_THAN, …
// value may be a string, boolean, number or Date. All filters are ANDed. Equality + one range field works
// without a custom index; anything else may need one, so the scripts keep queries simple.
// parent: a document path for subcollections, e.g. "applications/abc" to query its "messages".
export async function query(collectionId, filters = [], limit = 5000, parent = "") {
  const sq = { from: [{ collectionId }], limit };
  const fs = filters.map(([f, op, v]) => ({ fieldFilter: { field: { fieldPath: f }, op, value: toValue(v) } }));
  if (fs.length === 1) sq.where = fs[0];
  if (fs.length > 1) sq.where = { compositeFilter: { op: "AND", filters: fs } };
  const rows = await api("POST", `${parent ? `/${parent}` : ""}:runQuery`, { structuredQuery: sq });
  return rows.filter((r) => r.document).map((r) => docOut(r.document));
}

export async function get(path) {
  const d = await api("GET", `/${path}`, null, true);
  return d ? docOut(d) : null;
}

// Sets only the given fields (creates the document if needed).
export async function patch(path, data) {
  const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  await api("PATCH", `/${path}?${mask}`, { fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)])) });
}

export const remove = (path) => api("DELETE", `/${path}`, null, true);
