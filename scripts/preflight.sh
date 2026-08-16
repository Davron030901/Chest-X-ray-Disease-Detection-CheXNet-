#!/usr/bin/env bash
# Refuse to ship a broken deployment.
#
# Both live outages this project has had came from the same thing: a large binary
# silently disappearing from the working tree and `git add -A` committing the deletion.
# Render then rebuilds fine and serves {"model_loaded": false}; Vercel serves 404 samples.
# Run this before every commit. Install it as a hook with:
#
#     ln -sf ../../scripts/preflight.sh .git/hooks/pre-commit
#
set -uo pipefail
cd "$(dirname "$0")/.."

pass=0; fail=0
ok()   { echo "  OK    $1"; pass=$((pass+1)); }
bad()  { echo "  FAIL  $1"; fail=$((fail+1)); }

need_file() {  # path  min_bytes  description
  if [ ! -f "$1" ]; then bad "$1 MISSING — $3"; return; fi
  sz=$(wc -c < "$1")
  if [ "$sz" -lt "$2" ]; then bad "$1 is only ${sz}B, expected >= $2 — $3"; return; fi
  ok "$1 ($(( sz / 1024 )) KB)"
}

echo "== backend: the API returns model_loaded:false without these =="
need_file backend/artifacts/chexnet_densenet121.pt 20000000 "trained DenseNet-121 state_dict"
need_file backend/artifacts/metrics.json               500 "per-class AUC + support served at /meta"
need_file backend/artifacts/thresholds.json            100 "per-class operating points"

echo
echo "== frontend: the 'Try a sample' buttons 404 without these =="
for i in 1 2 3; do
  need_file "frontend/public/samples/sample-$i.png" 100000 "test-split radiograph"
done
need_file frontend/public/samples/samples.json 100 "sample ground-truth labels"

echo
echo "== report evidence for the rubric =="
for f in artifacts/gradcam_1.png artifacts/gradcam_2.png artifacts/gradcam_3.png \
         artifacts/roc_grid.png artifacts/auc_table.csv artifacts/splits.csv; do
  if [ -f "$f" ]; then ok "$f"; else echo "  WARN  $f missing (graded evidence, not fatal to the app)"; fi
done

echo
echo "== the checkpoint must be a real torch archive, not an LFS pointer or a stub =="
if head -c 2 backend/artifacts/chexnet_densenet121.pt 2>/dev/null | grep -q "PK"; then
  ok "checkpoint has a zip header (torch.save format)"
else
  bad "checkpoint is not a torch archive — Git LFS pointer or truncated download?"
fi

echo
echo "== nothing tracked is staged for deletion =="
del=$(git diff --cached --diff-filter=D --name-only 2>/dev/null | grep -vE '^(node_modules|\.next)/' || true)
if [ -n "$del" ]; then
  bad "these files are staged for DELETION:"; echo "$del" | sed 's/^/          /'
else
  ok "no staged deletions"
fi

echo
echo "$pass passed, $fail failed"
if [ "$fail" -gt 0 ]; then
  echo
  echo "Restore anything missing from the last good commit, e.g.:"
  echo "  git checkout 52b4ac7 -- backend/artifacts/ frontend/public/samples/"
  exit 1
fi
echo "Safe to commit."
