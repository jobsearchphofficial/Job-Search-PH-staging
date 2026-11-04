SP="$(cd "$(dirname "$0")" && pwd)"
echo "##### RULES"
for t in test.mjs rules-fb.mjs rules-edit.mjs rules-confirm.mjs rules-chat.mjs rules-verify.mjs; do echo "== $t: $(node $t 2>&1 | grep -cE '^PASS') passed, $(node -e 0; true) $(node $t 2>&1 | grep -E 'FAIL' | head -3)"; done
