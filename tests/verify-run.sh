node verify-e2e.cjs
cd /home/claude/job-search-ph && FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 EMAIL_OUTBOX=./outbox-v node scripts/send-emails.mjs | grep -E "Sent|Done"
head -qn1 ./outbox-v/*.html
