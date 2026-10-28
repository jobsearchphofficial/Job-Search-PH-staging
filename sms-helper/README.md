# SMS helper (phone confirmation)

A small Cloudflare Worker (free plan) that texts a 6-digit code through UniSMS and checks it.
One helper serves both sites; the Firebase project inside the user's sign-in token picks the database.

- Code: `worker.js` (single file — paste it into the Cloudflare editor, or `wrangler deploy`).
- Settings (Workers → jsph-sms → Settings → Variables and secrets):
  - `UNISMS_KEY` (secret) — UniSMS → API keys
  - `SA_LIVE` (secret) — service-account JSON of `job-search-ph-website`
  - `SA_STAGING` (secret) — service-account JSON of `job-search-ph-staging`
  - `SENDER_ID` (text) — sender name from the UniSMS dashboard
  - `DAILY_CAP` (text, optional) — most texts per day for the whole site (default 150)
- Then put the worker's URL in `SMS_URL` in `assets/firebase-config.js`. Empty = feature off and hidden.

Limits: 1 code per minute, 3 per account per day, 3 per number per day, `DAILY_CAP` site-wide.
Codes expire after 10 minutes, 5 wrong tries max, stored only as a hash.
Writes `phoneVerified/{uid}` = `{ phone, at }` (clients can read their own, can't write it).

Local test: `wrangler dev` with vars `EMULATOR_HOST=127.0.0.1:8085` and `DRY=1` (no real text; the code comes back in the response).
