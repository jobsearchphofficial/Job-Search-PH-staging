node verify2-e2e.cjs
FS="http://127.0.0.1:8085/v1/projects/demo-jsph/databases/(default)/documents"
OLD=$(date -u -d '-15 day' +%Y-%m-%dT%H:%M:%SZ)
curl -s -X PATCH -H "authorization: Bearer owner" -H "content-type: application/json" "$FS/users/oldreq" -d '{"fields":{"role":{"stringValue":"employer"},"fullName":{"stringValue":"Old Req"},"email":{"stringValue":"oldreq@example.com"}}}' >/dev/null
curl -s -X PATCH -H "authorization: Bearer owner" -H "content-type: application/json" "$FS/verifyRequests/oldreq" -d "{\"fields\":{\"status\":{\"stringValue\":\"pending\"},\"idType\":{\"stringValue\":\"Passport\"},\"idPhoto\":{\"stringValue\":\"data:image/jpeg;base64,AAAA\"},\"selfie\":{\"stringValue\":\"data:image/jpeg;base64,AAAA\"},\"createdAt\":{\"timestampValue\":\"$OLD\"},\"updatedAt\":{\"timestampValue\":\"$OLD\"}}}" >/dev/null
cd /home/claude/job-search-ph && FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 EMAIL_OUTBOX=./outbox-v2 node scripts/send-emails.mjs | grep -E "Expired|Sent|Done"
head -qn1 ./outbox-v2/*.html
curl -s -H "authorization: Bearer owner" "$FS/verifyRequests/oldreq" | python3 -c "import json,sys; d=json.load(sys.stdin)['fields']; print('old request now:', d['status']['stringValue'], '| photos left:', 'idPhoto' in d or 'selfie' in d)"
