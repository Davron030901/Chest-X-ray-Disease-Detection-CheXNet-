# MASTER PROMPT — CheXNet Reproduction + Deployed Web App
> Paste everything below the line into a **new Claude chat**. It is self-contained.

---

## ROLE

You are a **Senior Computer Vision Engineer with 10 years of experience** in medical imaging and production ML. You have shipped multi-label classifiers, explainability pipelines, and low-resource inference services. You write **complete, runnable code** — never pseudocode, never `# TODO`, never "the rest is similar". When a constraint is tight (512 MB RAM, free GPU, no credit card), you design around it explicitly instead of ignoring it.

Work **phase by phase**. At the end of each phase, stop and output a short **Acceptance Check** block confirming the phase's requirements are met, then continue to the next phase unless I say otherwise.

---

## PROJECT

Reproduce the core of **CheXNet** (Rajpurkar et al., 2017, arXiv:1711.05225) and ship it as a real product:

Given a chest X-ray → predict probabilities for **14 thoracic pathologies** → show a **Grad-CAM heatmap** of where the model looked → serve it from a **FastAPI backend on Render** and a **custom Next.js frontend on Vercel**.

### Hard constraints (these are graded — violating one loses points)

| Constraint | Requirement |
|---|---|
| Problem type | **Multi-label** (14 independent sigmoids), **not** softmax multi-class |
| Data split | **Patient-level** — no `Patient ID` may appear in two splits. Prove it with an assertion. |
| Model | **Transfer learning** from ImageNet weights (DenseNet-121, as in the paper) |
| Metric | **Per-disease AUC-ROC**. Accuracy is forbidden as a headline metric. |
| Explainability | **Grad-CAM** heatmaps overlaid on the original X-ray |
| Frontend | **My own custom UI.** ❌ No Gradio. ❌ No Streamlit. ❌ No auto-generated demo. |
| Hosting | ❌ **No Hugging Face** (no Spaces, no HF model hosting, no HF Inference API). Free tiers only, **no credit card**. |
| Training env | **Google Colab, free T4 GPU** |
| Backend host | **Render** (free web service) |
| Frontend host | **Vercel** (free hobby) |
| Disclaimer | A medical disclaimer must appear in the notebook, the API response, the UI, and the write-up |

### Grading rubric (100 pts) — map every deliverable to a row

| Checked | Pts |
|---|---|
| Multi-label set up correctly (14 outputs) | 10 |
| Patient-level split, no leakage | 15 |
| Transfer-learning model trains | 15 |
| Per-disease AUC-ROC evaluation | 20 |
| Grad-CAM heatmaps produced and sensible | 10 |
| Real web app deployed — own frontend + backend API | 25 |
| Medical disclaimer + write-up vs the paper | 5 |

### Mandatory disclaimer text (use verbatim everywhere)

> ⚠️ **Educational project only.** This model is **not a medical device**, has not been clinically validated, and must **never** be used for real diagnosis, triage, or treatment decisions. Always consult a qualified radiologist or physician.

---

## DATA

**Dataset:** NIH Chest X-ray **sample** — `kaggle.com/datasets/nih-chest-xrays/sample` (5,606 PNG images, ~1.7 GB). Do **not** download the 45 GB full set.

**Labels file:** `sample_labels.csv` with columns:
`Image Index`, `Finding Labels`, `Follow-up #`, `Patient ID`, `Patient Age`, `Patient Gender`, `View Position`, `OriginalImageWidth`, `OriginalImageHeight`, `OriginalImagePixelSpacing_x`, `OriginalImagePixelSpacing_y`

`Finding Labels` is a `|`-separated string, e.g. `Cardiomegaly|Emphysema`, or `No Finding`.

**The 14 classes — use this exact order everywhere (model output index, API JSON, frontend):**

```python
CLASSES = [
    "Atelectasis", "Cardiomegaly", "Effusion", "Infiltration",
    "Mass", "Nodule", "Pneumonia", "Pneumothorax",
    "Consolidation", "Edema", "Emphysema", "Fibrosis",
    "Pleural_Thickening", "Hernia",
]
```

`No Finding` is **not** a class — it is simply an all-zero label vector.

---

# PHASE 1 — Colab: data, patient split, training, AUC, Grad-CAM

Produce **one notebook**, `chexnet_train.ipynb`, with numbered markdown section headers. Runtime target: **under 90 minutes on a free T4**.

### 1.1 Setup
- Cell 1: assert GPU (`nvidia-smi`, `torch.cuda.is_available()`), print torch/torchvision versions, set `SEED = 42` and seed `random`, `numpy`, `torch`, `torch.cuda`; set `torch.backends.cudnn.benchmark = True`.
- Cell 2: install/import `torch torchvision scikit-learn pandas numpy pillow matplotlib tqdm kagglehub`.
- Cell 3: markdown cell containing the **medical disclaimer** verbatim.

### 1.2 Download
- Use `kagglehub.dataset_download("nih-chest-xrays/sample")`. Provide a documented fallback using a Kaggle API token (`kaggle.json` → `~/.kaggle/`) in case kagglehub auth fails.
- **Do not hardcode paths.** Discover them: recursively glob for `*.png` and for `*labels*.csv`, print the resolved `IMG_DIR` and `CSV_PATH`, and assert the PNG count is ~5,606.
- Persist to Google Drive (`/content/drive/MyDrive/chexnet/`) so a runtime disconnect doesn't cost you the download or checkpoints.

### 1.3 Labels → multi-hot
- Parse `Finding Labels` by `|` into a 14-column 0/1 matrix in `CLASSES` order.
- Print: total images, unique patients, positives per class with prevalence %, and the distribution of labels-per-image (0, 1, 2, 3+).
- **Explicitly call out** in a markdown cell that this is multi-label: a single image can be positive for several classes, so we use 14 independent sigmoids + `BCEWithLogitsLoss`, not softmax + cross-entropy.
- Flag rare classes. In the 5,606-image sample, `Hernia` has only a handful of positives and `Pneumonia`/`Fibrosis` are very rare — their AUCs will be unstable. Note this now; you will report support counts alongside AUC later.

### 1.4 Patient-level split (15 pts — be rigorous)
- Split on **unique `Patient ID`**, not rows: 70% train / 10% val / 20% test.
- Use `sklearn.model_selection.GroupShuffleSplit` (twice, to carve val out of train) or explicit `numpy` shuffling of the unique patient array. Seed it.
- Print for each split: #patients, #images, per-class positive counts.
- Add a **hard leakage assertion** block that fails loudly:

```python
tr, va, te = set(train_df["Patient ID"]), set(val_df["Patient ID"]), set(test_df["Patient ID"])
assert tr.isdisjoint(va) and tr.isdisjoint(te) and va.isdisjoint(te), "PATIENT LEAKAGE DETECTED"
assert len(tr | va | te) == df["Patient ID"].nunique()
print(f"✅ No patient leakage. patients: train={len(tr)} val={len(va)} test={len(te)}")
```

- Add a markdown cell explaining **why** image-level splitting inflates scores (the same patient contributes many near-duplicate follow-up films; the model memorises the patient, not the pathology).
- Save `splits.csv` (`Image Index`, `Patient ID`, `split`) as an auditable artifact.

### 1.5 Dataset & transforms
- `ChestXrayDataset(Dataset)`: reads PNG with PIL, `.convert("RGB")` (X-rays are 8-bit grayscale; DenseNet expects 3 channels), returns `(tensor, label_float_tensor)`.
- Train transforms: `Resize(256)` → `RandomResizedCrop(224, scale=(0.85, 1.0))` → `RandomHorizontalFlip(0.5)` → `RandomRotation(7)` → `ToTensor` → ImageNet `Normalize([0.485,0.456,0.406],[0.229,0.224,0.225])`.
- Val/test transforms: `Resize(256)` → `CenterCrop(224)` → `ToTensor` → same `Normalize`.
- Justify in markdown: **no vertical flip and no aggressive horizontal shear** — cardiac silhouette laterality is diagnostically meaningful; keep horizontal flip mild or make it a documented choice.
- `DataLoader`: `batch_size=32`, `num_workers=2`, `pin_memory=True`, `persistent_workers=True`. If Colab OOMs, drop to 16.

### 1.6 Model — transfer learning
```python
from torchvision.models import densenet121, DenseNet121_Weights
model = densenet121(weights=DenseNet121_Weights.IMAGENET1K_V1)
model.classifier = nn.Linear(model.classifier.in_features, 14)  # 1024 -> 14, logits
```
- Print a confirmation that pretrained ImageNet weights loaded and that the head is newly initialised.
- **Loss:** `BCEWithLogitsLoss(pos_weight=...)` where `pos_weight[c] = N_neg[c] / N_pos[c]` computed **from the train split only**, clamped to `[1, 20]` so ultra-rare classes don't destabilise training. Explain in markdown that the paper used unweighted BCE on 112k images; with 5.6k images class weighting is the pragmatic adaptation.
- **Optimizer:** `AdamW(lr=1e-4, weight_decay=1e-5)`. **Scheduler:** `ReduceLROnPlateau(mode="max", factor=0.3, patience=1)` driven by **mean val AUC**.
- **Two-stage schedule:** epoch 1–2 with the backbone frozen (head only, `lr=1e-3`), then unfreeze everything at `lr=1e-4`.

### 1.7 Training loop
- Mixed precision: `torch.amp.autocast("cuda")` + `GradScaler`.
- Per epoch: train loss, val loss, **mean val AUC**, epoch time, current LR.
- Early stopping on mean val AUC, `patience=4`. Save the **best** checkpoint only.
- Total ~12–15 epochs.
- Checkpoint dict: `{"state_dict", "classes", "img_size": 224, "normalize": {...}, "arch": "densenet121", "val_mean_auc", "epoch"}` → save to Drive as `chexnet_densenet121.pt`. Saving the `state_dict` (~28 MB) — **not** the pickled model object — is what makes the Render deploy possible.
- Plot train/val loss and mean val AUC curves.

### 1.8 Evaluation — per-disease AUC-ROC (20 pts)
- Run inference on the **test** split, collect `y_true (N,14)` and `y_prob (N,14)` (sigmoid applied).
- `sklearn.metrics.roc_auc_score` **per class**. Wrap each in try/except: if a class has 0 positives or 0 negatives in test, record `NaN` and report `support=0` rather than crashing.
- Build a DataFrame with columns: `Pathology | Test positives (support) | My AUC | CheXNet paper AUC | Δ` sorted by my AUC descending, plus a **Mean AUC** row (`np.nanmean`).
- **Paper reference values (arXiv:1711.05225, Table 2 — CheXNet column):**

| Pathology | Paper AUC |
|---|---|
| Atelectasis | 0.8094 |
| Cardiomegaly | 0.9248 |
| Effusion | 0.8638 |
| Infiltration | 0.7345 |
| Mass | 0.8676 |
| Nodule | 0.7802 |
| Pneumonia | 0.7680 |
| Pneumothorax | 0.8887 |
| Consolidation | 0.7901 |
| Edema | 0.8878 |
| Emphysema | 0.9371 |
| Fibrosis | 0.8047 |
| Pleural_Thickening | 0.8062 |
| Hernia | 0.9164 |
| **Mean** (computed from the 14 values above; the paper does not print a mean row) | **0.8414** |

- Also plot a grid of 14 ROC curves, and export `metrics.json` (per-class AUC + support + mean) — the backend will serve this.
- **Realistic expectation, state it plainly in the notebook:** trained on ~3.9k images instead of ~98k, expect a mean AUC around **0.70–0.78**. Do **not** fabricate paper-level numbers. Explain the gap: 5% of the data, fewer epochs, no ensembling, no 10-crop TTA, and a different test split than the official one.
- Compute per-class operating thresholds by maximising Youden's J on the **validation** split (never on test) and export `thresholds.json`.

### 1.9 Grad-CAM (10 pts)
- Implement Grad-CAM **manually** with forward/backward hooks on `model.features.denseblock4` (or `model.features.norm5`). Do not depend on the `grad-cam` package — the same file will run on the 512 MB Render instance and fewer dependencies means a smaller image.
- Function signature: `gradcam(model, input_tensor, class_idx) -> np.ndarray` in `[0,1]`, shape `(224,224)`, produced by ReLU(Σ_k α_k A_k), bilinear-upsampled and min-max normalised.
- Overlay with `matplotlib` `jet` colormap at `alpha=0.4` on the grayscale X-ray.
- Render **at least 3 figures**, each a 3-panel row: *Original | Heatmap | Overlay*, titled with the predicted class, its probability, and the ground-truth labels. Choose confident **true positives** for visually distinct pathologies (Cardiomegaly, Effusion, Pneumothorax, Mass are the most legible).
- Add a markdown paragraph reading the heatmaps radiologically: does Cardiomegaly light up the cardiac silhouette? Does Effusion light up the costophrenic angle? Be honest if one is wrong — an accurate failure analysis scores better than a false claim.
- Save the figures as `gradcam_1.png … gradcam_3.png`.

### 1.10 Export bundle
Zip and download `artifacts/`: `chexnet_densenet121.pt`, `metrics.json`, `thresholds.json`, `splits.csv`, `auc_table.csv`, `gradcam_*.png`, the ROC grid, and the training-curve figure.

**Acceptance Check for Phase 1** — confirm: 14 sigmoid outputs ✅ · patient-disjoint assertion passed ✅ · ImageNet weights loaded ✅ · per-class AUC table with paper comparison ✅ · ≥3 Grad-CAM figures ✅ · checkpoint is a `state_dict` ✅.

---

# PHASE 2 — Backend: FastAPI on Render (free tier)

### 2.1 Repository layout
```
chexnet-backend/
├── app/
│   ├── main.py          # FastAPI app, routes, CORS
│   ├── model.py         # load checkpoint, preprocess, predict, gradcam
│   └── schemas.py       # pydantic response models
├── artifacts/
│   ├── chexnet_densenet121.pt
│   ├── metrics.json
│   └── thresholds.json
├── requirements.txt
├── render.yaml
└── README.md
```

### 2.2 The free-tier reality — design for it, don't fight it
Render's free web service gives you **512 MB RAM, 0.1 CPU**, and it **spins down after ~15 minutes of inactivity** with a **30–60 s cold start**. Everything below exists because of that:

- **CPU-only torch.** In `requirements.txt`:
  ```
  --extra-index-url https://download.pytorch.org/whl/cpu
  torch==2.3.1+cpu
  torchvision==0.18.1+cpu
  fastapi==0.111.0
  uvicorn[standard]==0.30.1
  pillow==10.3.0
  numpy==1.26.4
  python-multipart==0.0.9
  ```
  The CUDA build is ~2.5 GB and will blow the build. The CPU wheel is ~190 MB.
- `torch.set_num_threads(1)` at import — 0.1 CPU means thread contention only hurts.
- **Load the model once at startup** into a module-level singleton via FastAPI `lifespan`, never per-request.
- Run with **one worker**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1`.
- Commit `chexnet_densenet121.pt` (~28 MB) directly to the repo — under GitHub's 100 MB limit, no Git LFS needed, no external fetch at boot.
- Wrap prediction in `with torch.inference_mode():`; Grad-CAM needs gradients, so run it in a separate `torch.enable_grad()` block and `del` intermediates + `gc.collect()` afterwards.
- Make Grad-CAM **opt-in per request** so a probabilities-only call stays cheap.

### 2.3 API contract
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | `{"status":"ok","model_loaded":true,"uptime_s":…}` — used by the frontend to warm the dyno |
| `GET` | `/meta` | class list, per-class thresholds, test AUC + support per class, paper AUC, model arch, disclaimer string |
| `POST` | `/predict` | multipart `file`, optional query `cam=true`, `top_k=3` |

`POST /predict` response:
```json
{
  "predictions": [
    {"label": "Cardiomegaly", "probability": 0.8123, "threshold": 0.42,
     "positive": true, "auc": 0.87, "rank": 1}
  ],
  "top_k": ["Cardiomegaly", "Effusion", "Infiltration"],
  "heatmaps": {"Cardiomegaly": "data:image/png;base64,…"},
  "input_preview": "data:image/png;base64,…",
  "inference_ms": 412,
  "model_version": "densenet121-nih-sample-v1",
  "disclaimer": "⚠️ Educational project only. …"
}
```
Always return **all 14** classes sorted by probability descending — the UI needs the full vector.

### 2.4 Robustness
- Validate: content-type in `{image/png, image/jpeg, image/webp}`, size ≤ 10 MB, `PIL.Image.open(...).verify()` then reopen, `convert("RGB")`.
- Return structured `HTTPException` with `{"error": {"code": …, "message": …}}` — the frontend renders `message` directly.
- CORS: allow `https://<your-app>.vercel.app`, Vercel preview URLs, and `http://localhost:3000`. Read the origin list from an env var `ALLOWED_ORIGINS`.
- Log inference time and image dimensions.
- `input_preview` should be the exact 224×224 center-cropped tensor rendered back to PNG, so the heatmap overlays align pixel-for-pixel in the UI.

### 2.5 `render.yaml`
```yaml
services:
  - type: web
    name: chexnet-api
    runtime: python
    plan: free
    region: oregon
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
    healthCheckPath: /health
    envVars:
      - key: PYTHON_VERSION
        value: "3.11"
      - key: ALLOWED_ORIGINS
        value: "http://localhost:3000"
```

### 2.6 Deploy steps
Write literal click-by-click instructions: push to GitHub → Render dashboard → New → Web Service → connect repo → confirm Free plan → deploy → copy the `https://chexnet-api-xxxx.onrender.com` URL → `curl` `/health` and `/predict` to verify → set `ALLOWED_ORIGINS` to the real Vercel domain after Phase 3 and redeploy.

Also give me: a local run command, a `curl -F "file=@test.png" ".../predict?cam=true"` example, and a note that a free uptime pinger (e.g. cron-job.org) hitting `/health` every 10 minutes keeps the dyno warm during a demo.

**Acceptance Check for Phase 2** — confirm: no Gradio/Streamlit ✅ · no Hugging Face ✅ · CPU-only wheel ✅ · model loaded once at startup ✅ · CORS configured ✅ · disclaimer in the response body ✅.

---

# PHASE 3 — Frontend: custom Next.js UI on Vercel

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · `lucide-react` icons · `framer-motion` (optional, respect `prefers-reduced-motion`). No component library that makes it look generic. No Gradio, no Streamlit.

Read `FRONTEND_DESIGN_BRIEF.md` (provided alongside this prompt) and implement it exactly: **clinical dark theme, deep slate canvas, cyan-teal accent, emerald→amber→rose severity scale, light-mode toggle, fully responsive from 360 px to 1920 px.**

### Required screens & behaviour
1. **Header** — wordmark, backend status dot (green connected / amber waking / red offline, polled from `/health`), theme toggle, GitHub link.
2. **Hero** — one-line value proposition, the 14 pathology names as chips, and the disclaimer banner (dismissible visually but always re-shown next to results).
3. **Upload zone** — drag-and-drop + click + paste-from-clipboard, keyboard accessible, client-side type/size validation with inline errors, live thumbnail preview, and 3 bundled **"Try a sample X-ray"** buttons (ship 3 test-split PNGs in `/public/samples/`).
4. **Cold-start handling** — on first load, call `/health`. If it doesn't answer in 3 s, show a friendly *"Waking the model server — free tier, this takes up to 60 seconds"* state with a progress indicator. This is the single biggest UX difference between a demo that looks broken and one that looks professional.
5. **Results — image panel:** tabbed / segmented control for **Original · Heatmap · Overlay**, an opacity slider (0–100%) for the CAM, a **drag-to-compare split slider**, a class selector so the user can view the CAM for any of the top-3 classes, and a fullscreen/zoom view.
6. **Results — predictions panel:** all 14 classes, sorted descending, each row = label · animated horizontal probability bar coloured by severity band · monospace percentage · `positive/negative` badge vs. its threshold · a small "model AUC for this class" tooltip so the user knows how much to trust it. Top-3 promoted into larger cards above the list.
7. **Actions** — copy JSON, download the annotated result as PNG, reset.
8. **Footer** — the full medical disclaimer, dataset citation (NIH ChestX-ray14), paper citation (Rajpurkar et al., 2017), "not a medical device", author, repo link.

### Engineering requirements
- `NEXT_PUBLIC_API_URL` env var; never hardcode the Render URL.
- Typed API client with `AbortController` timeout (90 s to survive cold start), retry-once-on-cold-start, and discriminated-union error handling.
- Loading skeletons, not spinners, for the results panel.
- `next/image` with `unoptimized` for base64 data URLs.
- Lighthouse targets: performance ≥ 90, accessibility ≥ 95.
- SEO: `metadata` export with title, description, and an OG image.

### Deploy
GitHub → vercel.com → Import Project → set `NEXT_PUBLIC_API_URL` → Deploy → copy the live URL → go back to Render and put that domain into `ALLOWED_ORIGINS` → redeploy the backend → confirm end-to-end from the live URL, not localhost.

**Acceptance Check for Phase 3** — confirm: custom UI, zero Gradio/Streamlit ✅ · responsive at 360/768/1440 ✅ · cold-start state implemented ✅ · disclaimer visible without scrolling ✅ · live link works end-to-end ✅.

---

# PHASE 4 — Write-up & submission

Produce `WRITEUP.md` (600–900 words), in this order:

1. **Medical disclaimer** — verbatim, at the very top.
2. **What I built** — 3 sentences.
3. **Data & patient-level split** — counts, why patient-level matters, the assertion that proves it.
4. **Model & training** — DenseNet-121 ImageNet → 14-way sigmoid head, weighted BCE, two-stage LR, T4, epochs, wall-clock time.
5. **Results — the AUC table** (my AUC · support · paper AUC · Δ) with the mean.
6. **My AUCs vs the paper — honest analysis.** Which classes came closest (usually Cardiomegaly, Effusion, Edema — large, high-contrast, well-represented findings) and which collapsed (Hernia, Pneumonia, Fibrosis — single-digit test positives make AUC meaningless). Attribute the gap to: 5% of the training data, no ensembling, no 10-crop TTA, fewer epochs, and a non-identical test split. Name the NIH label-noise problem (labels were NLP-mined from radiology reports, ~90% accurate).
7. **Grad-CAM** — 2–3 embedded figures with a one-line radiological read of each, including one honest failure case.
8. **Deployment architecture** — a small diagram: `Browser → Vercel (Next.js) → HTTPS → Render (FastAPI + DenseNet-121 CPU) → JSON + base64 CAM`. Note the free-tier cold start and how the UI handles it.
9. **Limitations & what I'd do next** — full 112k dataset, 320 px inputs, DenseNet-169/EfficientNet ensembling, 10-crop TTA, per-class threshold calibration, external validation on CheXpert.
10. **Links** — live app, backend `/health`, both repos, notebook.

Also produce a **`SUBMISSION.md`** checklist mapping each rubric row to the exact file / URL / notebook section that satisfies it.

---

## OUTPUT RULES

- Complete, copy-pasteable code. Every import present. Every file given in full with its path as a header.
- Comment the *why* on any non-obvious decision (pos_weight clamping, denseblock4 as the CAM target, `inference_mode` vs `enable_grad`).
- If you must choose between elegance and running on 512 MB, choose 512 MB and say so.
- Never invent metric values. Placeholders must be visibly marked `<FILL AFTER TRAINING>`.
- Flag any risk you foresee (Kaggle auth, Colab disconnects, Render build timeouts, CORS preflight) **before** it bites, with the fix inline.

**Start with Phase 1 now.** Output the complete notebook, cell by cell, then its Acceptance Check.
