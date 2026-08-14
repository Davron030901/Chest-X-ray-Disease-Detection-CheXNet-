# Training artifacts

Produced by `notebook/chexnet_train.ipynb` (cell 24 zips them for download).
These are the evidence for the grading rubric — commit them.

| File | Proves |
|---|---|
| `gradcam_1.png` `gradcam_2.png` `gradcam_3.png` | Grad-CAM heatmaps, *Original / Heatmap / Overlay* (10 pts) |
| `roc_grid.png` | 14-panel per-disease ROC curves (20 pts) |
| `auc_table.csv` | per-class AUC + support vs the paper (20 pts) |
| `training_curves.png` | loss and mean-val-AUC across epochs (15 pts) |
| `history.csv` | per-epoch train loss, val loss, val mean AUC, LR, seconds |
| `splits.csv` | every image's split assignment — auditable proof of the patient-level split (15 pts) |
| `metrics.json` | the numbers the API serves at `/meta` |
| `thresholds.json` | per-class Youden-J operating points, tuned on validation only |

`chexnet_densenet121.pt` lives in `backend/artifacts/` instead, because the backend loads it
at startup. `metrics.json` and `thresholds.json` are duplicated there for the same reason.

Sample X-rays for the frontend's "Try a sample" buttons go to `frontend/public/samples/`.

## Copy them in

```bash
python scripts/install_artifacts.py ~/Downloads/chexnet_artifacts.zip   # backend + frontend
unzip -j ~/Downloads/chexnet_artifacts.zip 'gradcam_*.png' 'roc_grid.png' 'auc_table.csv' \
        'training_curves.png' 'history.csv' 'splits.csv' -d artifacts/
```

> ⚠️ Educational project only. Not a medical device. Never use for real diagnosis.
