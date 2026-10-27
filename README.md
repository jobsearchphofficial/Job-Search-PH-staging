# Job Search PH — Job Board

A free job listing board for household, service and local jobs in Negros Occidental. Live at https://jobsearchph.com (Beta v1).

- **Jobseekers** create a free profile, apply to jobs on the site, and message employers in the built-in chat. The employer's own contact is shared only after they accept a job offer. No fees, ever.
- **Employers** post jobs for free (5 posts per calendar month). Every post is reviewed before going live and expires after 30 days. Employers review applicants, send job offers, and chat with applicants.
- **Admins** see analytics, review posts, handle reports and support, and can ban users.

Job Search PH only publishes listings. It does not recruit, screen, match or place workers.

Plain HTML/CSS/JS on GitHub Pages, with Firebase Auth (Google and email/password) and Firestore on the free plan. No build step for the app.

## Run it locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

This talks to the live Firebase project. For testing without touching real data, run the Firebase emulators (Firestore on port 8085, Auth on 9099) and open `http://localhost:8000/?emu`.

## Test site first, then live

Real people use jobsearchph.com, so every change goes to the **test site** first:

1. `scripts/deploy-staging.sh` publishes the current code to https://staging.jobsearchph.com (repo `Job-Search-PH-staging`). It uses a separate Firebase project with test data only, shows a yellow TEST SITE banner, and is hidden from Google.
2. Check it there (both phones if it's a big change). Publish any rules change to the **test** Firebase project first.
3. When it's good, push to this repo to update the live site, and publish the rules to the **live** Firebase project.

`assets/firebase-config.js` picks the database by address: `staging.*` uses the test project and never falls back to the real one.

## Important: publish the rules after every change

All security (who can read what, daily and monthly limits, bans, chat closing) lives in `firestore.rules`. After any change to that file, paste it into Firebase console → Firestore Database → Rules → **Publish**. The site breaks in confusing ways if the published rules are older than the code.

## Limits (anti-spam)

| What | Limit |
|---|---|
| Applications | 10 per day |
| Job posts | 5 per calendar month (Philippine time) |
| Chat messages | 200 per day |
| Reports | 5 per day |
| Support messages | 3 per day (signed in) |

Set in `assets/store.js` (`LIMITS`) and enforced in `firestore.rules`. Change both together.

## Tracked links

Add `?src=<name>` to any link, e.g. `https://jobsearchph.com/?src=fb-bacolod-group`. The name is saved on the person's profile when they sign up, and **Admin → Analytics → Where users come from** shows sign-ups, posts and applications per source. Admin → Analytics also has a link maker.

## Public job pages (Google for Jobs)

`scripts/build-job-pages.mjs` builds `/jobs/<id>/` pages and `sitemap.xml` from live jobs. The GitHub Action `.github/workflows/job-pages.yml` runs it every 2 hours. Private households appear as "Private household in <city>" on these pages; only businesses show their name and street address.

## Files

| File | What it does |
|---|---|
| `index.html` | Page shell |
| `assets/app.js` | Pages, forms, chat, admin tools and analytics |
| `assets/store.js` | Firebase data layer and limits |
| `assets/firebase-config.js` | Firebase keys, listing length |
| `assets/styles.css` | Styles (light and dark) |
| `firestore.rules` | Database security rules |
| `scripts/build-job-pages.mjs` | Static job pages for search engines |

## Job alert emails

Jobseekers tick **Job alerts by email** on their profile and choose "only my city" or "anywhere in Negros Occidental". Every morning (6:41 AM PH) `.github/workflows/job-alerts.yml` runs `scripts/send-job-alerts.mjs`, which emails each of them the jobs approved since their last alert whose category is one they picked. No new matches means no email. Emails go out through Resend from `alerts@jobsearchph.com`, with links tagged `?src=job-alert`.

- **Secrets** (repo → Settings → Secrets and variables → Actions): `FIREBASE_SERVICE_ACCOUNT` (Firebase → Project settings → Service accounts → Generate new private key; paste the whole JSON) and `RESEND_API_KEY`. The script picks the Firebase project from the key, so the staging repo uses the staging project's key.
- **Variable** (staging repo only): `SITE_URL` = `https://staging.jobsearchph.com`.
- **Unsubscribe** works without signing in: the link writes `unsubscribes/{token}`, and the next run turns alerts off on that profile. `alertState/{uid}` records when each person was last emailed.
- **Test**: Actions → Job alert emails → Run workflow → `dry-run` prints the emails without sending. Locally: `node scripts/send-job-alerts.mjs --fixture scripts/sample-alerts.json`.
- **Limit**: Resend's free plan allows 100 emails a day and 3,000 a month. The script stops at `MAX_EMAILS` (90), and anyone it skips gets their alert on the next run.

## Checking employers

Every pending post in **Admin → Pending** shows an *Employer check*: account age, sign-in method, phone, Facebook link, permit/DTI number, past posts, and warning signs (brand-new account, scam words like "fee" or "GCash", pay that's too high, a phone number shared with other accounts, earlier rejections or reports).

- **Ask for more info** keeps the post pending and notifies the employer, who can reply through support or update their profile.
- **Verify employer** (after a call or a Facebook check) adds a green *Verified* badge to all their posts. Remove it from their page in Admin → Users.

## Making someone an admin

In Firestore, create a document in the `admins` collection whose ID is their User UID (from Authentication → Users). Add any field, e.g. `name: "Mark"`.

## Still to do outside the code

- Have a lawyer review the Terms and Privacy pages.
- Register a DTI business name, then BIR and a mayor's permit, before charging for anything.
