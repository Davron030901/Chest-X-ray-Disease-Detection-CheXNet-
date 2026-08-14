# Submission — rubric map and verification checklist

> ⚠️ **Educational project only.** Not a medical device. Never use for real diagnosis.

## Rubric map (100 points)

| # | Criterion | Pts | Evidence |
|---|---|---|---|
| 1 | Multi-label set up correctly (14 outputs) | 10 | `notebook/chexnet_train.ipynb` §3 (label parsing → 14-column 0/1 matrix) and §6 (`nn.Linear(1024, 14)` + `BCEWithLogitsLoss`, 14 independent sigmoids). Markdown cell in §3 explains why softmax is wrong here. |
| 2 | Patient-level split, no leakage | 15 | §4: `GroupShuffleSplit` on `Patient ID`, applied twice for 70/10/20. Hard assertion `assert tr.isdisjoint(va) and …, "PATIENT LEAKAGE DETECTED"` with printed output. Audit trail in `artifacts/splits.csv`. |
| 3 | Transfer-learning model trains | 15 | §6 `densenet121(weights=DenseNet121_Weights.IMAGENET1K_V1)`; §7 two-stage freeze/unfreeze training loop with AMP; `artifacts/training_curves.png` and `artifacts/history.csv`. |
| 4 | Evaluation by per-disease AUC-ROC | 20 | §8: `roc_auc_score` per class with support counts. **Mean test AUC 0.7633 vs paper 0.8414.** Table in `WRITEUP.md` §4, `artifacts/auc_table.csv`, `artifacts/metrics.json`, 14-panel `artifacts/roc_grid.png`, and served live at `/meta`. Accuracy never reported. |
| 5 | Grad-CAM heatmaps | 10 | §9: manual hooks on `features.denseblock4`; `artifacts/gradcam_1.png` … `gradcam_3.png`, each *Original / Heatmap / Overlay*, plus a radiological read and one failure case in `WRITEUP.md` §6. |
| 6 | Real web app deployed | 25 | Frontend **https://chest-x-ray-disease-detection-che-x.vercel.app** (hand-built Next.js 14, `frontend/`), backend **https://chest-x-ray-disease-detection-chexnet.onrender.com/health** (FastAPI, `backend/`). Both verified live. No Gradio, no Streamlit, no Hugging Face. |
| 7 | Medical disclaimer + write-up vs paper | 5 | `WRITEUP.md` §1 header and §5 analysis. Disclaimer also in the notebook's first cell, every `/predict` response body, the UI hero, and the UI footer. |

## Deliverables

| Required | File / link |
|---|---|
| Notebook: data → patient split → train → AUC → Grad-CAM | `notebook/chexnet_train.ipynb` |
| Per-disease AUC table | `WRITEUP.md` §4, `artifacts/auc_table.csv` |
| 2–3 Grad-CAM heatmaps | `artifacts/gradcam_1..3.png` |
| Live web app link | https://chest-x-ray-disease-detection-che-x.vercel.app |
| Frontend code | [`frontend/`](https://github.com/Davron030901/Chest-X-ray-Disease-Detection-CheXNet-/tree/main/frontend) |
| Backend code | [`backend/`](https://github.com/Davron030901/Chest-X-ray-Disease-Detection-CheXNet-/tree/main/backend) |
| Short write-up + disclaimer | `WRITEUP.md` |

## Pre-submission verification

Run these physically, don't assume.

**Deployment**

- [x] Open the Vercel link — verified live: cold-start card shown, then "API online", sample X-ray predicted with a Grad-CAM overlay
- [x] `/health` returns `{"status":"ok","model_loaded":true,…}` — verified
- [x] Sample X-ray on the live site → 14 probabilities **and** a Grad-CAM heatmap render (Atelectasis 91.9%, Cardiomegaly 84.4%, Effusion 65.7%)
- [ ] Switch Original / Heatmap / Overlay — the heatmap aligns with the X-ray
- [ ] Resize the browser to 360 px wide — nothing overflows, tap targets stay ≥ 44 px
- [ ] Toggle light mode — text stays readable, the image well stays dark
- [ ] Let the backend sleep 20 minutes, then reload — the "waking the model server" card appears
      instead of an error

**Rules compliance**

- [ ] `grep -ri "gradio\|streamlit\|huggingface\|hf.co" backend frontend notebook` returns nothing
- [ ] No credit card was entered anywhere
- [ ] The dataset used is the real NIH sample (5,606 images), not synthetic data

**Science**

- [ ] Notebook runs top to bottom on a **fresh** Colab runtime
- [ ] The leakage assertion and its `NO PATIENT LEAKAGE` output are visible in the committed notebook
- [ ] Every reported AUC has its support count beside it
- [ ] Accuracy appears nowhere as a headline metric
- [x] Reported mean AUC 0.7633 matches `/meta` and the per-class table exactly (recomputed independently)

**Documentation**

- [ ] Disclaimer present in: notebook cell 1, `/predict` JSON, UI hero, UI footer, `WRITEUP.md`
- [ ] `grep -c "<FILL" WRITEUP.md SUBMISSION.md` returns 0 for both
- [ ] Set `NEXT_PUBLIC_FRONTEND_REPO` and `NEXT_PUBLIC_BACKEND_REPO` in Vercel (links are hidden until you do)
- [ ] No fabricated numbers anywhere — every figure traces back to a Colab cell output
