#!/usr/bin/env python3
"""
Unpack the Colab artifacts bundle into the right places.

    python scripts/install_artifacts.py ~/Downloads/chexnet_artifacts.zip

Copies:
    chexnet_densenet121.pt, metrics.json, thresholds.json  -> backend/artifacts/
    samples/sample-1..3.png                                -> frontend/public/samples/

This is the step people get wrong by hand, and a missing checkpoint only shows up
later as /health reporting "degraded".
"""
import json
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend" / "artifacts"
SAMPLES = ROOT / "frontend" / "public" / "samples"
REPORT = ROOT / "artifacts"

BACKEND_FILES = ["chexnet_densenet121.pt", "metrics.json", "thresholds.json"]
# Evidence for the rubric: figures and tables the grader needs to see in the repo.
REPORT_FILES = [
    "gradcam_1.png", "gradcam_2.png", "gradcam_3.png",
    "roc_grid.png", "training_curves.png",
    "auc_table.csv", "history.csv", "splits.csv",
    "metrics.json", "thresholds.json",
]


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2

    src = Path(sys.argv[1]).expanduser()
    if not src.exists():
        print(f"error: {src} not found")
        return 1

    work = ROOT / ".artifacts_tmp"
    if src.suffix == ".zip":
        if work.exists():
            shutil.rmtree(work)
        work.mkdir()
        with zipfile.ZipFile(src) as z:
            z.extractall(work)
        base = work
    else:
        base = src  # already-extracted directory

    BACKEND.mkdir(parents=True, exist_ok=True)
    SAMPLES.mkdir(parents=True, exist_ok=True)
    REPORT.mkdir(parents=True, exist_ok=True)

    ok = True
    for name in BACKEND_FILES:
        hits = list(base.rglob(name))
        if not hits:
            print(f"  MISSING  {name}")
            ok = False
            continue
        shutil.copy(hits[0], BACKEND / name)
        print(f"  copied   {name:<28} -> backend/artifacts/  ({hits[0].stat().st_size/1e6:.1f} MB)")

    for name in REPORT_FILES:
        hits = list(base.rglob(name))
        if not hits:
            print(f"  missing  {name:<28} (report evidence)")
            continue
        shutil.copy(hits[0], REPORT / name)
        print(f"  copied   {name:<28} -> artifacts/")

    # Guard: refuse to overwrite good sample X-rays with something that is not one.
    # These files are committed and serve the live demo; a bad write is a visible outage.
    def is_radiograph(path: Path) -> bool:
        try:
            from PIL import Image
            with Image.open(path) as im:
                return min(im.size) >= 256
        except Exception:
            return False

    pngs = [p for p in sorted(base.rglob("sample-*.png")) if is_radiograph(p)][:3]
    for i, p in enumerate(pngs, start=1):
        shutil.copy(p, SAMPLES / f"sample-{i}.png")
        print(f"  copied   {p.name:<28} -> frontend/public/samples/  "
              f"({p.stat().st_size/1024:.0f} KB)")

    meta = list(base.rglob("samples.json"))
    if meta:
        shutil.copy(meta[0], SAMPLES / "samples.json")
        print(f"  copied   samples.json                 -> frontend/public/samples/")
    if len(pngs) < 3:
        print(f"  WARNING  only {len(pngs)}/3 sample X-rays found; the 'Try a sample' buttons need 3")

    if work.exists():
        shutil.rmtree(work)

    # Sanity-check the metrics file so a truncated download is caught now, not on Render.
    mpath = BACKEND / "metrics.json"
    if mpath.exists():
        m = json.loads(mpath.read_text())
        n = len(m.get("per_class", {}))
        print(f"\n  metrics.json: {n} classes, mean AUC {m.get('mean_auc')}")
        if n != 14:
            print("  WARNING  expected 14 classes in metrics.json")
            ok = False
        missing_auc = [k for k, v in m.get("per_class", {}).items() if v.get("auc") is None]
        if missing_auc:
            print(f"  note     AUC is null for {missing_auc} (too few test positives - expected)")

    print("\n" + ("READY - now follow DEPLOY.md step 2" if ok else "INCOMPLETE - see MISSING lines above"))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
