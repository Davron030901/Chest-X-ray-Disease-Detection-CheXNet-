# CheXNet Reproduction — Write-up

> ⚠️ **MEDICAL DISCLAIMER.** This is an **educational project only**. The model described here is
> **not a medical device**, has not been clinically validated, and must **never** be used for real
> diagnosis, triage, or treatment decisions. Always consult a qualified radiologist or physician.

**Template.** Every `<FILL: …>` marker is a real number you must copy from your Colab run. Do not
guess them and do not copy the paper's values. Unfilled markers are listed at the bottom.

---

## 1. What I built

A reproduction of the core of CheXNet (Rajpurkar et al., 2017) on the NIH ChestX-ray14 sample:
a DenseNet-121 pretrained on ImageNet, fine-tuned to predict 14 thoracic pathologies as independent
probabilities, evaluated with per-disease AUC-ROC on a patient-disjoint test split, and explained
with Grad-CAM. The model is served by a FastAPI backend on Render and a hand-built Next.js frontend
on Vercel, so anyone can upload an X-ray and see the probabilities and the heatmap.

## 2. Data and the patient-level split

| | Images | Patients |
|---|---|---|
| Total | 5,606 | `<FILL: unique patients>` |
| Train | `<FILL>` | `<FILL>` |
| Val | `<FILL>` | `<FILL>` |
| Test | `<FILL>` | `<FILL>` |

Labels come from the `Finding Labels` column, `|`-separated, parsed into a 14-column 0/1 matrix.
`No Finding` is the all-zero vector, not a 15th class. One image can carry several labels, so this is
a **multi-label** problem: 14 independent sigmoids and `BCEWithLogitsLoss`, never a softmax.

**The split is on `Patient ID`, not on image.** ChestX-ray14 contains follow-up studies, so a single
patient contributes many radiographs of the same chest — same anatomy, same hardware, often the same
pathology. Splitting by image puts near-duplicates of the same patient on both sides, and the network
gets credit for recognising the patient rather than the disease. The reported AUC then overstates
real performance by several points and the model fails on genuinely new patients.

`GroupShuffleSplit` on `Patient ID` (applied twice: 20% test, then 12.5% of the remainder as val)
produces the split, and this assertion proves it holds:

```python
assert tr.isdisjoint(va) and tr.isdisjoint(te) and va.isdisjoint(te), "PATIENT LEAKAGE DETECTED"
assert len(tr | va | te) == df["Patient ID"].nunique()
```

`artifacts/splits.csv` records the assignment of every image for audit.

## 3. Model and training

- **Backbone:** DenseNet-121, `DenseNet121_Weights.IMAGENET1K_V1`.
- **Head:** `nn.Linear(1024, 14)` producing logits; sigmoid applied at inference.
- **Loss:** `BCEWithLogitsLoss(pos_weight = N_neg / N_pos)` computed from the **train split only** and
  clamped to `[1, 20]`. The paper used unweighted BCE, but it had 98k training images; at 3.9k the
  rare classes contribute almost no gradient without weighting, and the unclamped Hernia weight
  (in the hundreds) destabilises training.
- **Schedule:** epochs 1–2 with the backbone frozen (head only, `lr=1e-3`), then everything unfrozen
  at `lr=1e-4`. `AdamW`, `weight_decay=1e-5`, `ReduceLROnPlateau(mode="max")` on mean val AUC.
- **Augmentation:** resize 256 → random resized crop 224 (scale 0.85–1.0) → horizontal flip p=0.5 →
  rotation ±7°. No vertical flip: an inverted chest radiograph does not exist clinically.
- **Hardware:** Colab free T4, mixed precision, batch 32.
- **Run:** `<FILL: epochs run>` epochs, `<FILL: minutes>` minutes wall clock, best epoch
  `<FILL: best epoch>` at val mean AUC `<FILL: best val AUC>`.

## 4. Results — per-disease AUC-ROC

Accuracy is not reported. Most classes sit near 5% prevalence, so a model that answers "negative"
for everything scores ~95% accuracy while being useless. AUC-ROC is threshold-free and
prevalence-insensitive, which is why the paper uses it.

| Pathology | Test positives | My AUC | Paper AUC | Δ |
|---|---|---|---|---|
| Atelectasis | `<FILL>` | `<FILL>` | 0.8094 | `<FILL>` |
| Cardiomegaly | `<FILL>` | `<FILL>` | 0.9248 | `<FILL>` |
| Effusion | `<FILL>` | `<FILL>` | 0.8638 | `<FILL>` |
| Infiltration | `<FILL>` | `<FILL>` | 0.7345 | `<FILL>` |
| Mass | `<FILL>` | `<FILL>` | 0.8676 | `<FILL>` |
| Nodule | `<FILL>` | `<FILL>` | 0.7802 | `<FILL>` |
| Pneumonia | `<FILL>` | `<FILL>` | 0.7680 | `<FILL>` |
| Pneumothorax | `<FILL>` | `<FILL>` | 0.8887 | `<FILL>` |
| Consolidation | `<FILL>` | `<FILL>` | 0.7901 | `<FILL>` |
| Edema | `<FILL>` | `<FILL>` | 0.8878 | `<FILL>` |
| Emphysema | `<FILL>` | `<FILL>` | 0.9371 | `<FILL>` |
| Fibrosis | `<FILL>` | `<FILL>` | 0.8047 | `<FILL>` |
| Pleural Thickening | `<FILL>` | `<FILL>` | 0.8062 | `<FILL>` |
| Hernia | `<FILL>` | `<FILL>` | 0.9164 | `<FILL>` |
| **Mean** | | **`<FILL>`** | **0.8414** | **`<FILL>`** |

Paper values: arXiv:1711.05225 Table 2, the "CheXNet (ours)" column. The mean is computed from those
14 values; the paper does not print a mean row.

Source files: `artifacts/auc_table.csv`, `artifacts/metrics.json`, ROC grid in `artifacts/roc_grid.png`.

## 5. My AUCs vs the paper — honest analysis

**Closest to the paper:** `<FILL: usually Cardiomegaly, Effusion, Edema>`. These are large,
high-contrast, well-represented findings — an enlarged cardiac silhouette or a blunted costophrenic
angle occupies a big fraction of the image and appears in hundreds of training examples.

**Numbers that are not meaningful:** `<FILL: usually Hernia, Pneumonia, Fibrosis>`, with
`<FILL: support>` positives in the test set. An AUC computed on single-digit positives has enormous
variance and can land anywhere. Reporting it without the support count would be misleading, so the
support column stays in every table and in the API response.

**Where the gap comes from:**

1. **Data volume.** ~3.9k training images against the paper's ~98k. Roughly 4%, and the rare classes
   suffer most.
2. **No ensembling.** The published result averages multiple networks.
3. **No 10-crop test-time augmentation.**
4. **Fewer epochs, no hyperparameter search.** One run on a free T4 under 90 minutes.
5. **A different test split.** The paper uses the official ChestX-ray14 split; this is a random
   patient-level split of the sample. The numbers are not strictly comparable in either direction.
6. **Label noise.** ChestX-ray14 labels were NLP-mined from free-text radiology reports and are only
   about 90% accurate. That ceiling applies to the paper too, but it bites harder with less data to
   average the noise out.

A mean AUC in the 0.70–0.78 range is the expected outcome here, not a failure.

## 6. Grad-CAM

Implemented with manual forward/backward hooks on `features.denseblock4` (1024 × 7 × 7 at a 224 × 224
input): channel weights `α_k = GAP(∂y_c/∂A_k)`, then `ReLU(Σ_k α_k A_k)`, bilinear upsampled and
min-max normalised. No third-party Grad-CAM package — identical code runs inside the 512 MB Render
container.

| Figure | Class | p | What the CAM attends to |
|---|---|---|---|
| `gradcam_1.png` | `<FILL>` | `<FILL>` | `<FILL: e.g. cardiac silhouette, centre-left mediastinum — anatomically correct>` |
| `gradcam_2.png` | `<FILL>` | `<FILL>` | `<FILL: e.g. right costophrenic angle — correct for effusion>` |
| `gradcam_3.png` | `<FILL>` | `<FILL>` | `<FILL: FAILURE CASE — e.g. attends to the image border / a rib margin / a burned-in "PORTABLE" marker rather than the pathology>` |

**On the failure case.** ChestX-ray14 has a documented shortcut-learning problem: portable
(bedside) films correlate with sicker inpatients, and the acquisition artefacts that mark a portable
study are easier to detect than the pathology itself. A CAM landing on a marker or a border is
evidence of that shortcut, not a rendering bug. Grad-CAM shows correlation with the output, never
causation, and it is not a localisation ground truth.

## 7. Deployment architecture

```
  Browser
     │  HTTPS
     ▼
  Vercel  ── Next.js 14 (App Router, TypeScript, Tailwind)
     │       custom UI: upload, viewer, heatmap overlay, 14-row prediction panel
     │       NEXT_PUBLIC_API_URL
     │  HTTPS multipart POST /predict?cam=true&top_k=3
     ▼
  Render  ── FastAPI + Uvicorn, 1 worker
             DenseNet-121, CPU-only torch, 512 MB RAM, 0.1 CPU
             model loaded once at startup (lifespan)
     │
     └──►  JSON: 14 probabilities + thresholds + AUC + base64 Grad-CAM PNGs
```

Deliberate choices forced by the free tier: CPU-only torch wheels (the CUDA build is ~2.5 GB and
fails the build), `torch.set_num_threads(1)`, one worker, a single startup model load, Grad-CAM
opt-in per request with explicit tensor cleanup, and a hand-rolled jet colormap so matplotlib never
gets imported.

Render sleeps after ~15 minutes idle and takes 30–60 s to wake. The frontend pings `/health` on
mount and, if it doesn't answer within 3 s, shows an explicit "waking the model server" card with an
elapsed counter instead of a spinner — the difference between an app that looks broken and one that
looks deliberate.

**Compliance:** own frontend (no Gradio, no Streamlit, no auto-generated demo), no Hugging Face
anywhere, free tiers only, no credit card.

- Live app: `<FILL: VERCEL_URL>`
- API health: `<FILL: RENDER_URL>/health`
- Frontend repo: `<FILL>` · Backend repo: `<FILL>` · Notebook: `<FILL>`

## 8. Limitations and next steps

**Limitations.** Frontal views only, no lateral films, no clinical context or patient history. Rare
classes are effectively unevaluated. Labels are NLP-derived and imperfect. Thresholds are tuned on a
small validation split and are not calibrated probabilities. Nothing here has been validated on any
external population, and a screening model cannot replace a radiologist.

**Next steps.** Train on the full 112,120-image ChestX-ray14 with the official split; raise input
resolution to 320 px (small nodules survive downsampling poorly); ensemble DenseNet-169 and
EfficientNet-B0; add 10-crop TTA; calibrate per-class probabilities with Platt scaling or isotonic
regression; validate externally on CheXpert or MIMIC-CXR; and check subgroup performance by sex, age
and view position before claiming anything about generalisation.

---

### Unfilled markers

Search this file for `<FILL` before submitting. Every one must be replaced with a real value from
your Colab run.

---

> ⚠️ **Educational project only.** Not a medical device. Never use for real diagnosis, triage, or
> treatment decisions. Always consult a qualified radiologist or physician.
