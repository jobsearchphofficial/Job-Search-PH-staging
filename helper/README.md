# Job Search PH helper (Cloudflare Worker)

A small Cloudflare Worker (free plan) that does what a static site can't:

1. **Mobile number confirmation** — texts a 6-digit code through UniSMS and checks it.
2. **Account emails** — "Confirm your email" and "Reset your password", sent from noreply@jobsearchph.com
   through Resend in the Job Search PH design, with links to jobsearchph.com instead of firebaseapp.com.

One helper serves both sites; the Firebase project in the request picks the database.

- Code: `worker.js` (single file — paste it into the Cloudflare editor).
- Settings (Workers → jsph-helper → Settings → Variables and secrets):
  - `UNISMS_KEY` (secret, only for text codes) — UniSMS → API keys. Also set `SMS_ON = true` in firebase-config.js
  - `RESEND_KEY` (secret) — Resend API key
  - `SA_LIVE` (secret) — service-account JSON of `job-search-ph-website`
  - `SA_STAGING` (secret) — service-account JSON of `job-search-ph-staging`
  - `SENDER_ID` (text) — sender name from the UniSMS dashboard
  - `DAILY_CAP` (text, optional) — most texts per day for the whole site (default 150)
- Then put the worker's URL in `HELPER_URL` in `assets/firebase-config.js`. Empty = phone confirmation hidden,
  and account emails fall back to Firebase's own plain emails.
- Firebase console → Authentication → Templates → (pencil) → Customize action URL: `https://jobsearchph.com/`
  (staging: `https://staging.jobsearchph.com/`), so even Firebase's fallback emails open our own page.

Limits: texts — 1 per minute, 3 per account per day, 3 per number per day, `DAILY_CAP` site-wide.
Emails — 1 per minute and 5 per day per account/address, 300 per day site-wide.
Codes expire after 10 minutes, 5 wrong tries max, stored only as a hash.
Password reset always answers "ok", so nobody can use it to find out who has an account.

Local test: `wrangler dev` with vars `EMULATOR_HOST=127.0.0.1:8085`, `AUTH_EMULATOR_HOST=127.0.0.1:9099` and `DRY=1`
(nothing is really sent; the code or link comes back in the response).
