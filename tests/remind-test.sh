FS="http://127.0.0.1:8085/v1/projects/demo-jsph/databases/(default)/documents"
put() { curl -s -X PATCH -H "authorization: Bearer owner" -H "content-type: application/json" "$FS/$1" -d "$2" >/dev/null; }
OLD=$(date -u -d '-45 day' +%Y-%m-%dT%H:%M:%SZ); RECENT=$(date -u -d '-3 day' +%Y-%m-%dT%H:%M:%SZ); WEEK=$(date -u -d '-10 day' +%Y-%m-%dT%H:%M:%SZ); NEW=$(date -u -d '-2 day' +%Y-%m-%dT%H:%M:%SZ); FUT=$(date -u -d '+20 day' +%Y-%m-%dT%H:%M:%SZ)
u() { put "users/$1" "{\"fields\":{\"role\":{\"stringValue\":\"employer\"},\"fullName\":{\"stringValue\":\"$2\"},\"email\":{\"stringValue\":\"$1@example.com\"},\"createdAt\":{\"timestampValue\":\"$3\"}$4}}"; }
j() { put "jobs/$1" "{\"fields\":{\"title\":{\"stringValue\":\"$2\"},\"city\":{\"stringValue\":\"Bacolod City\"},\"ownerUid\":{\"stringValue\":\"$3\"},\"status\":{\"stringValue\":\"$4\"},\"createdAt\":{\"timestampValue\":\"$5\"},\"updatedAt\":{\"timestampValue\":\"$5\"},\"expiresAt\":{\"timestampValue\":\"$6\"}}}"; }
u oldposter "Old Poster" "$OLD"; j jo "Cook" oldposter closed "$OLD" "$OLD"
u liveposter "Live Poster" "$OLD"; j jl "Driver" liveposter approved "$OLD" "$FUT"
u recentposter "Recent Poster" "$OLD"; j jr "Yaya" recentposter closed "$RECENT" "$RECENT"
u neverposted "Never Posted" "$WEEK"
u brandnew "Brand New" "$NEW"
u optedout "Opted Out" "$OLD" ',"emailNotify":{"booleanValue":false}'; j jx "Laundry" optedout closed "$OLD" "$OLD"
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 FORCE_REMINDERS=1
cd /home/claude/job-search-ph
O=./outbox-r
echo "=== reminders run 1"; EMAIL_OUTBOX=$O node scripts/send-emails.mjs | grep -E "Sent|Done"; head -qn1 $O/*.html | sed 's/<!-- //; s/ -->//'
echo "=== run 2 (no repeats)"; EMAIL_OUTBOX=${O}2 node scripts/send-emails.mjs | grep -E "Sent|Done"
