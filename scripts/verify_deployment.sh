#!/usr/bin/env bash
# Verify a live deployment end to end.
#   ./scripts/verify_deployment.sh https://chexnet-api-xxxx.onrender.com [xray.png]
set -uo pipefail

API="${1:-}"
IMG="${2:-}"
[ -z "$API" ] && { echo "usage: $0 <API_URL> [image.png]"; exit 2; }
API="${API%/}"

pass=0; fail=0
chk() { if [ "$1" = "0" ]; then echo "  PASS  $2"; pass=$((pass+1)); else echo "  FAIL  $2"; fail=$((fail+1)); fi; }

echo "== /health (allowing up to 90s for a cold start) =="
t0=$(date +%s)
body=$(curl -s --max-time 90 "$API/health")
t1=$(date +%s)
echo "  responded in $((t1-t0))s: $body"
echo "$body" | grep -q '"status":"ok"'; chk $? "status ok"
echo "$body" | grep -q '"model_loaded":true'; chk $? "model_loaded true (checkpoint present)"

echo
echo "== /meta =="
meta=$(curl -s --max-time 30 "$API/meta")
[ "$(echo "$meta" | grep -o '"label"' | wc -l)" -eq 14 ]; chk $? "14 classes returned"
echo "$meta" | grep -qi "not a medical device"; chk $? "disclaimer present"
echo "$meta" | grep -q '"paper_auc"'; chk $? "paper AUC shipped for comparison"

if [ -n "$IMG" ] && [ -f "$IMG" ]; then
  echo
  echo "== /predict?cam=true&top_k=3 =="
  out=$(curl -s --max-time 120 -F "file=@$IMG" "$API/predict?cam=true&top_k=3")
  [ "$(echo "$out" | grep -o '"label"' | wc -l)" -eq 14 ]; chk $? "14 predictions returned"
  echo "$out" | grep -q '"heatmaps":{"'; chk $? "heatmaps returned"
  echo "$out" | grep -q '"input_preview":"data:image/png;base64'; chk $? "preview is a png data URL"
  echo "$out" | grep -qi "not a medical device"; chk $? "disclaimer in the prediction body"
  echo "  top: $(echo "$out" | grep -o '"label":"[A-Za-z_]*","probability":[0-9.]*' | head -3)"
else
  echo; echo "  (skipped /predict - pass an image path as the 2nd argument)"
fi

echo
echo "== rejects a non-image =="
code=$(printf 'not an image' | curl -s -o /dev/null -w '%{http_code}' --max-time 30 -F "file=@-;filename=a.pdf;type=application/pdf" "$API/predict")
[ "$code" = "415" ]; chk $? "415 for application/pdf (got $code)"

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
