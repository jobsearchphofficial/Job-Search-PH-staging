#!/usr/bin/env bash
# Publish the current code to the TEST site (staging.jobsearchph.com) only.
# The live site (jobsearchph.com) is untouched until you push to the main repo.
set -euo pipefail
STAGING_REPO="${STAGING_REPO:-https://github.com/jobsearchphofficial/Job-Search-PH-staging.git}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mktemp -d)"
git clone -q "$STAGING_REPO" "$OUT" 2>/dev/null || { mkdir -p "$OUT"; git -C "$OUT" init -q -b main; git -C "$OUT" remote add origin "$STAGING_REPO"; }
# Copy the site, minus things that belong only to the live site.
rsync -a --delete --exclude .git --exclude CNAME --exclude sitemap.xml --exclude 'jobs/' --exclude '.github/' --exclude '__/' "$SRC"/ "$OUT"/
# Only the email workflows run on the test site (not the live site's job-pages builder).
mkdir -p "$OUT/.github/workflows"
for w in job-alerts.yml emails.yml; do cp "$SRC/.github/workflows/$w" "$OUT/.github/workflows/" 2>/dev/null || true; done
echo "staging.jobsearchph.com" > "$OUT/CNAME"
printf 'User-agent: *\nDisallow: /\n' > "$OUT/robots.txt"
cd "$OUT"
git add -A
git commit -qm "Test site: $(git -C "$SRC" log -1 --format='%h %s')" || { echo "Nothing new for the test site."; exit 0; }
git push -q origin HEAD:main
echo "Pushed to the test site. Live in about a minute at https://staging.jobsearchph.com"
