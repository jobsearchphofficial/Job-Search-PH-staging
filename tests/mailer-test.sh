set -e
FS="http://127.0.0.1:8085/v1/projects/demo-jsph/databases/(default)/documents"
H='-H "authorization: Bearer owner" -H "content-type: application/json"'
put() { curl -s -X PATCH -H "authorization: Bearer owner" -H "content-type: application/json" "$FS/$1" -d "$2" >/dev/null; }
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ); AGO=$(date -u -d '-5 min' +%Y-%m-%dT%H:%M:%SZ); AGO2=$(date -u -d '-3 min' +%Y-%m-%dT%H:%M:%SZ); AGO3=$(date -u -d '-1 min' +%Y-%m-%dT%H:%M:%SZ)
put users/emp '{"fields":{"role":{"stringValue":"employer"},"fullName":{"stringValue":"Rea Alvarez"},"email":{"stringValue":"rea@example.com"}}}'
put users/emp2 '{"fields":{"role":{"stringValue":"employer"},"fullName":{"stringValue":"No Mail"},"email":{"stringValue":"nomail@example.com"},"emailNotify":{"booleanValue":false}}}'
put jobs/j1 "{\"fields\":{\"title\":{\"stringValue\":\"Live-in Yaya\"},\"category\":{\"stringValue\":\"Yaya / Nanny\"},\"city\":{\"stringValue\":\"Bacolod City\"},\"area\":{\"stringValue\":\"Mandalagan\"},\"employerName\":{\"stringValue\":\"Alvarez family\"},\"arrangement\":{\"stringValue\":\"Live-in\"},\"schedule\":{\"stringValue\":\"Full-time\"},\"reqExperience\":{\"integerValue\":\"2\"},\"reqEducation\":{\"stringValue\":\"High school\"},\"reqList\":{\"arrayValue\":{\"values\":[{\"stringValue\":\"Childcare experience\"},{\"stringValue\":\"Can cook\"}]}},\"salaryMin\":{\"integerValue\":\"10000\"},\"salaryMax\":{\"integerValue\":\"12000\"},\"salaryPeriod\":{\"stringValue\":\"month\"},\"ownerUid\":{\"stringValue\":\"emp\"},\"status\":{\"stringValue\":\"pending\"},\"createdAt\":{\"timestampValue\":\"$AGO\"},\"updatedAt\":{\"timestampValue\":\"$AGO\"}}}"
put jobs/j2 "{\"fields\":{\"title\":{\"stringValue\":\"Cook\"},\"category\":{\"stringValue\":\"Cook\"},\"city\":{\"stringValue\":\"Silay City\"},\"employerName\":{\"stringValue\":\"No Mail Inc\"},\"ownerUid\":{\"stringValue\":\"emp2\"},\"status\":{\"stringValue\":\"pending\"},\"salaryMin\":{\"integerValue\":\"500\"},\"salaryPeriod\":{\"stringValue\":\"day\"},\"createdAt\":{\"timestampValue\":\"$AGO\"},\"updatedAt\":{\"timestampValue\":\"$AGO\"}}}"
app() { put "applications/j1_$1" "{\"fields\":{\"jobId\":{\"stringValue\":\"j1\"},\"employerUid\":{\"stringValue\":\"emp\"},\"applicantUid\":{\"stringValue\":\"$1\"},\"status\":{\"stringValue\":\"new\"},\"createdAt\":{\"timestampValue\":\"$2\"},\"applicant\":{\"mapValue\":{\"fields\":$3}}}}"; }
app seekerA "$AGO" '{"fullName":{"stringValue":"Bea Cruz"},"city":{"stringValue":"Talisay City"},"jobCategories":{"arrayValue":{"values":[{"stringValue":"Yaya / Nanny"}]}},"experienceYears":{"integerValue":"1"},"availability":{"stringValue":"Within a month"}}'
app seekerB "$AGO2" '{"fullName":{"stringValue":"Ana Reyes"},"age":{"integerValue":"29"},"city":{"stringValue":"Bacolod City"},"jobCategories":{"arrayValue":{"values":[{"stringValue":"Yaya / Nanny"}]}},"jobTypes":{"arrayValue":{"values":[{"stringValue":"Live-in"},{"stringValue":"Full-time"}]}},"experienceYears":{"integerValue":"4"},"education":{"stringValue":"High school graduate"},"skills":{"stringValue":"cooking, babies"},"availability":{"stringValue":"Available now"}}'
app seekerC "$AGO3" '{"fullName":{"stringValue":"Cy Lim"},"city":{"stringValue":"Kabankalan City"},"jobCategories":{"arrayValue":{"values":[{"stringValue":"Driver"}]}}}'
put support/s1 "{\"fields\":{\"topic\":{\"stringValue\":\"Account\"},\"name\":{\"stringValue\":\"Juan\"},\"message\":{\"stringValue\":\"I cannot log in on my phone, please help.\"},\"createdAt\":{\"timestampValue\":\"$AGO2\"}}}"
put reports/r1 "{\"fields\":{\"jobId\":{\"stringValue\":\"j1\"},\"reason\":{\"stringValue\":\"fee\"},\"details\":{\"stringValue\":\"Asked for a deposit\"},\"createdAt\":{\"timestampValue\":\"$AGO3\"}}}"
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8085
cd /home/claude/job-search-ph
echo "=== run 1"; SITE_URL=http://localhost:8000 EMAIL_OUTBOX=./outbox1 node scripts/send-emails.mjs
ls ./outbox1; head -1 ./outbox1/*.html | grep subject
echo "=== run 2 (nothing new expected)"; EMAIL_OUTBOX=./outbox2 node scripts/send-emails.mjs; ls ./outbox2 2>/dev/null | wc -l
NOW2=$(date -u +%Y-%m-%dT%H:%M:%SZ); EXP=$(date -u -d '+30 day' +%Y-%m-%dT%H:%M:%SZ)
put "jobs/j1?updateMask.fieldPaths=status&updateMask.fieldPaths=approvedAt&updateMask.fieldPaths=expiresAt&updateMask.fieldPaths=updatedAt" "{\"fields\":{\"status\":{\"stringValue\":\"approved\"},\"approvedAt\":{\"timestampValue\":\"$NOW2\"},\"expiresAt\":{\"timestampValue\":\"$EXP\"},\"updatedAt\":{\"timestampValue\":\"$NOW2\"}}}"
put "jobs/j2?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt" "{\"fields\":{\"status\":{\"stringValue\":\"rejected\"},\"updatedAt\":{\"timestampValue\":\"$NOW2\"}}}"
echo "=== run 3 (approve j1 -> live; reject j2 but emails off)"; EMAIL_OUTBOX=./outbox3 node scripts/send-emails.mjs; head -1 ./outbox3/*.html 2>/dev/null | grep subject
NOW3=$(date -u +%Y-%m-%dT%H:%M:%SZ)
put "jobs/j1?updateMask.fieldPaths=featured&updateMask.fieldPaths=updatedAt" "{\"fields\":{\"featured\":{\"booleanValue\":true},\"updatedAt\":{\"timestampValue\":\"$NOW3\"}}}"
echo "=== run 4 (featured toggle: no email expected)"; EMAIL_OUTBOX=./outbox4 node scripts/send-emails.mjs; ls ./outbox4 2>/dev/null | wc -l
