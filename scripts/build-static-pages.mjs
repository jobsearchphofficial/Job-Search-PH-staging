// Writes the information pages search engines can index: /about/, /how-it-works/, /employers/,
// /safety/, /faq/, /contact/, /terms/ and /privacy/.
//
// Their text lives in scripts/seo/pages.mjs and assets/content.js. After editing either file, run:
//     node scripts/build-static-pages.mjs
// and commit the result. `node scripts/seo-check.mjs` fails if the committed pages are out of date.
// No dependencies.

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { trustPages } from "./seo/pages.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function writeTrustPages(out = ROOT, { check = false } = {}) {
  const stale = [];
  for (const p of trustPages()) {
    const file = p.path.endsWith(".html") ? join(out, p.path) : join(out, p.path, "index.html");
    if (check) {
      const current = existsSync(file) ? await readFile(file, "utf8") : null;
      if (current !== p.html) stale.push(p.path);
    } else {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, p.html);
    }
  }
  return stale;
}

import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await writeTrustPages();
  console.log(`Wrote ${trustPages().length} information pages.`);
}
