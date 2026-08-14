# CheXNet Reproduction — Write-up

> ⚠️ **MEDICAL DISCLAIMER.** This is an **educational project only**. The model described here is
> **not a medical device**, has not been clinically validated, and must **never** be used for real
> diagnosis, triage, or treatment decisions. Always consult a qualified radiologist or physician.

**Live app:** https://chest-x-ray-disease-detection-che-x.vercel.app
**API:** https://chest-x-ray-disease-detection-chexnet.onrender.com/health
**Code:** https://github.com/Davron030901/Chest-X-ray-Disease-Detection-CheXNet-

Every AUC and split size below was read from the deployed model's `/meta` endpoint, so the report and
the running app cannot disagree. The remaining `<FILL>` markers are training-run details and the
Grad-CAM readings — copy them from your Colab output.

---

## 1. What I built

A reproduction of the core of CheXNet (Rajpurkar et al., 2017) on the NIH ChestX-ray14 sample: a
DenseNet-121 pretrained on ImageNet, fine-tuned to predict 14 thoracic pathologies as independent
probabilities, evaluated with per-disease AUC-ROC on a patient-disjoint test split, and explained
with Grad-CAM. It is served by a FastAPI backend on Render and a hand-built Next.js frontend on
Vercel, so anyone can upload a chest X-ray and see the probabilities and the heatmap.

## 2. Data and the patient-level split

| | Images | Patients |
|---|---|---|
| Total | 5,606 | `<FILL: unique patients — printed by notebook cell 8>` |
| Train | 3,931 (70.1%) | `<FILL>` |
| Val | 531 (9.5%) | `<FILL>` |
| Test | 1,144 (20.4%) | 846 |

Labels come from the `Finding Labels` column, `|`-separated, parsed into a 14-column 0/1 matrix.
`No Finding` is the all-zero vector, not a 15th class. One image can carry several labels, so this is
a **multi-label** problem: 14 independent sigmoids and `BCEWithLogitsLoss`, never a softmax.

**The split is on `Patient ID`, not on image.** ChestX-ray14 contains follow-up studies, so a single
patient contributes many radiographs of the same chest — same anatomy, same body habitus, often the
same implanted hardware and the same pathology. Splitting by image puts near-duplicates of the same
patient on both sides, and the network gets credit for recognising the patient rather than the
disease. The reported AUC then overstates real performance by several points and the model fails on
genuinely new patients.

`GroupShuffleSplit` on `Patient ID` (applied twice: 20% test, then 12.5% of the remainder as val)
produces the split, and this assertion proves it holds:

```python
assert tr.isdisjoint(va) and tr.isdisjoint(te) and va.isdisjoint(te), "PATIENT LEAKAGE DETECTED"
assert len(tr | va | te) == df["Patient ID"].nunique()
```

`artifacts/splits.csv` records the assignment of every image for audit. The three splits sum to
exactly 5,606 images, so nothing was silently dropped.

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
- **Hardware:** Colab free T4, mixed precision, batch 32, input 224×224.
- **Run:** `<FILL: epochs run>` epochs, `<FILL: minutes>` minutes wall clock, best epoch
  `<FILL: best epoch>` at val mean AUC `<FILL: best val AUC>`.

## 4. Results — per-disease AUC-ROC

Accuracy is not reported. Most classes sit near 5% prevalence, so a model that answers "negative"
for everything scores ~95% accuracy while being useless. AUC-ROC is threshold-free and
prevalence-insensitive, which is why the paper uses it and why this project does too.

| Pathology | Test positives | My AUC | Paper AUC | Δ |
|---|---|---|---|---|
| Emphysema | 35 | 0.8871 | 0.9371 | −0.0500 |
| Hernia | **2** | 0.8619 | 0.9164 | −0.0545 |
| Edema | 35 | 0.8563 | 0.8878 | −0.0315 |
| Cardiomegaly | 35 | 0.8400 | 0.9248 | −0.0848 |
| Pneumothorax | 55 | 0.7905 | 0.8887 | −0.0982 |
| Effusion | 129 | 0.7878 | 0.8638 | −0.0760 |
| Consolidation | 47 | 0.7786 | 0.7901 | −0.0115 |
| Mass | 49 | 0.7534 | 0.8676 | −0.1142 |
| Atelectasis | 85 | 0.7489 | 0.8094 | −0.0605 |
| Fibrosis | **18** | 0.7136 | 0.8047 | −0.0911 |
| Pleural Thickening | 31 | 0.7093 | 0.8062 | −0.0969 |
| Pneumonia | **14** | 0.6696 | 0.7680 | −0.0984 |
| Infiltration | 204 | 0.6507 | 0.7345 | −0.0838 |
| Nodule | 56 | 0.6389 | 0.7802 | −0.1413 |
| **Mean** | 795 | **0.7633** | **0.8414** | **−0.0780** |

Paper values: arXiv:1711.05225 Table 2, the "CheXNet (ours)" column. The mean is computed from those
14 values; the paper does not print a mean row. Bold support counts mark classes with fewer than 20
positive test cases.

Source: `artifacts/auc_table.csv`, `artifacts/metrics.json`, ROC grid in `artifacts/roc_grid.png`.
The same numbers are served live at `/meta` and rendered in the app's model card.

## 5. My AUCs vs the paper — honest analysis

**Mean AUC 0.7633 against the paper's 0.8414 — a gap of 0.078.** That is the expected outcome, not a
failure, and the reasons are specific.

**Closest to the paper.** Consolidation (−0.0115), Edema (−0.0315) and Emphysema (−0.0500). These
are large, spatially extensive findings with high radiographic contrast: alveolar filling, bilateral
perihilar congestion, hyperlucent lung fields. A 224×224 downsample preserves them, so the model
loses little to resolution and little to data volume.

**Furthest from the paper.** Nodule (−0.1413) and Mass (−0.1142) — and this is the most informative
result in the table. Both are small focal lesions, often only a few centimetres across. At 224×224 a
pulmonary nodule occupies a handful of pixels, and with 56 and 49 positive training-scale examples
respectively the model never learns the texture. The paper's own Nodule AUC (0.7802) is among its
weakest for the same reason, and the gap widens with less data. **This is the strongest argument for
320 px inputs as the single highest-value next step.**

**Numbers that are not meaningful.** Hernia has **2** positive test cases. Its AUC of 0.8619 is the
result of ranking two images and carries no information — with n=2 the value can only take a few
discrete values, and it would be dishonest to present it as the project's second-best class. Fibrosis
(n=18) and Pneumonia (n=14) are barely better. Every table in this project, in the API response and
in the UI tooltip reports support alongside AUC, and the UI flags support < 20 with a warning icon,
precisely so this cannot be read the wrong way.

**Infiltration (0.6507) is worth a separate note.** It has the *most* test positives of any class
(204) and still scores lowest but one. Data volume is not its problem — the label is. "Infiltration"
is a notoriously vague radiological term with poor inter-rater agreement, so the NLP-mined labels are
noisiest exactly here. The paper's own Infiltration AUC (0.7345) is its second-worst, which supports
that reading.

**Where the overall gap comes from:**

1. **Data volume.** 3,931 training images against the paper's ~98,000 — about 4%.
2. **No ensembling.** The published result averages multiple networks.
3. **No 10-crop test-time augmentation.**
4. **Fewer epochs, no hyperparameter search.** One run on a free T4.
5. **A different test split.** The paper uses the official ChestX-ray14 split; this is a random
   patient-level split of the 5,606-image sample, so the numbers are not strictly comparable in
   either direction.
6. **Label noise.** ChestX-ray14 labels were NLP-mined from free-text radiology reports and are only
   about 90% accurate. That ceiling applies to the paper too, but it bites harder with less data to
   average the noise out.

Notably, **every class moved in the same direction** — all 14 deltas are negative, ranging from
−0.01 to −0.14. A uniform downward shift is what less data looks like. If some classes had come out
*above* the paper, that would have been a signal to go back and check the split for leakage.

## 6. Grad-CAM

Implemented with manual forward/backward hooks on `features.denseblock4` (1024 × 7 × 7 at a 224 × 224
input): channel weights `α_k = GAP(∂y_c/∂A_k)`, then `ReLU(Σ_k α_k A_k)`, bilinear upsampled and
min-max normalised. No third-party Grad-CAM package — identical code runs in the notebook and inside
the 512 MB Render container.

| Figure | Class | p | What the CAM attends to |
|---|---|---|---|
| `gradcam_1.png` | `<FILL>` | `<FILL>` | `<FILL: e.g. cardiac silhouette, centre-left mediastinum — anatomically correct>` |
| `gradcam_2.png` | `<FILL>` | `<FILL>` | `<FILL: e.g. right costophrenic angle — correct for effusion>` |
| `gradcam_3.png` | `<FILL>` | `<FILL>` | `<FILL: FAILURE CASE — CAM on a rib margin, image border, or a burned-in marker>` |

**Observation from the deployed app.** On sample 1 the model returns Atelectasis at 91.9% and the CAM
is a broad, centrally-weighted blob over the mediastinum and lower-left lung field rather than a
tight focus on a collapsed segment. That is a *plausible but non-specific* activation: atelectasis
often is basal and volume-losing, so a lower-zone response is not wrong, but the spatial precision is
much lower than the CAMs published for Cardiomegaly or Pneumothorax. This is expected — Grad-CAM at
`denseblock4` has a 7×7 spatial grid, so each cell covers roughly 32×32 input pixels, and it is a
saliency method, not a segmentation.

**On the failure mode.** ChestX-ray14 has a documented shortcut-learning problem: portable (bedside)
films correlate with sicker inpatients, and the acquisition artefacts marking a portable study are
easier to detect than the pathology. A CAM landing on a marker or a border is evidence of that
shortcut, not a rendering bug. Grad-CAM shows correlation with the output, never causation, and it is
not a localisation ground truth.

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
elapsed counter instead of a spinner. Verified on the live deployment: the first load showed the
waking card and the status pill flipped to "API online" once the instance came up.

**Measured latency.** A warm `/predict?cam=true&top_k=3` takes about 11 s on Render's 0.1 CPU — one
forward pass plus three Grad-CAM backward passes. Setting `CAM_MAX_CLASSES=1` cuts it to roughly a
third if responsiveness matters more than showing three heatmaps.

**Compliance:** own frontend (no Gradio, no Streamlit, no auto-generated demo), no Hugging Face
anywhere, free tiers only, no credit card.

- Live app: https://chest-x-ray-disease-detection-che-x.vercel.app
- API health: https://chest-x-ray-disease-detection-chexnet.onrender.com/health
- API docs: https://chest-x-ray-disease-detection-chexnet.onrender.com/docs
- Repository (monorepo: notebook + backend + frontend): https://github.com/Davron030901/Chest-X-ray-Disease-Detection-CheXNet-
- Notebook: [`notebook/chexnet_train.ipynb`](https://github.com/Davron030901/Chest-X-ray-Disease-Detection-CheXNet-/blob/main/notebook/chexnet_train.ipynb)

## 8. Limitations and next steps

**Limitations.** Frontal views only, no lateral films, no clinical context or patient history. Three
classes (Hernia n=2, Pneumonia n=14, Fibrosis n=18) are effectively unevaluated. Labels are
NLP-derived and imperfect, and Infiltration's low AUC is probably label noise rather than a model
deficiency. Thresholds are tuned by Youden's J on a 531-image validation split and are not calibrated
probabilities. Nothing has been validated on any external population, and a screening model cannot
replace a radiologist.

**Next steps, in order of expected value:**

1. **320 px inputs.** Nodule and Mass are the two worst classes and both are small focal lesions —
   this addresses the largest measured gap directly.
2. **Full 112,120-image ChestX-ray14 with the official split.** Fixes the volume problem and makes
   the comparison to the paper like-for-like.
3. **Ensemble DenseNet-169 and EfficientNet-B0, plus 10-crop TTA** — the two techniques the paper
   used that this reproduction skipped.
4. **Calibrate per-class probabilities** with Platt scaling or isotonic regression, so the displayed
   percentages mean what they appear to mean.
5. **External validation on CheXpert or MIMIC-CXR**, and subgroup performance by sex, age and view
   position before making any generalisation claim.

---

### Unfilled markers

Search this file for `<FILL` before submitting. The remaining ones are training-run details only —
epochs, wall clock, best epoch, best val AUC, patient counts per split, and the three Grad-CAM
readings. Every AUC and split-size figure is already real, read from the deployed model. The
repository and deployment links are filled in.

---

> ⚠️ **Educational project only.** Not a medical device. Never use for real diagnosis, triage, or
> treatment decisions. Always consult a qualified radiologist or physician.
