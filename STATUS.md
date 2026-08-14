# Loyiha holati — talablar auditi / Requirement audit

Har bir talab bo'yicha rostgo'y holat. **Kod 100% tayyor. Lekin 3 ta ish faqat sizning
akkountingizda bajariladi** — men Colab'da o'qita olmayman va sizning GitHub/Render/Vercel
akkountingizga deploy qila olmayman.

> ⚠️ **Educational project only.** Not a medical device. Never use for real diagnosis.

---

## Qisqacha / TL;DR

| | Holat |
|---|---|
| Kod yozildi va tekshirildi | ✅ 100% |
| Model o'qitildi | ⬜ **Siz Colab'da ishga tushirasiz** (~60 daqiqa) |
| Backend deploy | ⬜ **Siz Render'ga push qilasiz** (~10 daqiqa) |
| Frontend deploy | ⬜ **Siz Vercel'ga push qilasiz** (~5 daqiqa) |

Sabab: bu muhitda GPU yo'q, Kaggle akkountingiz yo'q, va sizning GitHub/Render/Vercel
akkountlaringizga kirish huquqi yo'q. Boshqa hamma narsa tayyor va tekshirilgan.

---

## Baholash mezoni bo'yicha (100 ball)

### 1. Multi-label, 14 ta chiqish — 10 ball ✅ KOD TAYYOR

| Talab | Qayerda | Holat |
|---|---|---|
| 14 ta mustaqil sigmoid, softmax emas | `notebook` §6 — `nn.Linear(1024, 14)` + `BCEWithLogitsLoss` | ✅ |
| `Finding Labels` → (N,14) 0/1 matritsa | `notebook` §3 | ✅ |
| `No Finding` alohida klass emas (nol vektor) | `notebook` §3 | ✅ |
| Nega multi-label ekani izohlangan | `notebook` §3 markdown | ✅ |
| Klass tartibi hamma joyda bir xil | notebook / `model.py` / `types.ts` — **tekshirildi, bir xil** | ✅ |

### 2. Patient-level split — 15 ball ✅ KOD TAYYOR

| Talab | Qayerda | Holat |
|---|---|---|
| `Patient ID` bo'yicha bo'lish (70/10/20) | `notebook` §4 — `GroupShuffleSplit` 2 marta | ✅ |
| Leakage assertion | `notebook` §4 — `assert tr.isdisjoint(va) and ...` | ✅ |
| Nega rasm bo'yicha bo'lish noto'g'ri | `notebook` §4 markdown + `WRITEUP.md` §2 | ✅ |
| Audit fayl | `splits.csv` (notebook yozadi) | ⬜ notebook ishga tushgach |

### 3. Transfer learning o'qiydi — 15 ball ✅ KOD TAYYOR

| Talab | Qayerda | Holat |
|---|---|---|
| ImageNet pretrained DenseNet-121 | `notebook` §6 — `DenseNet121_Weights.IMAGENET1K_V1` | ✅ |
| Ikki bosqichli freeze/unfreeze | `notebook` §7 | ✅ |
| AMP, early stopping, checkpoint | `notebook` §7 | ✅ |
| **Haqiqiy o'qitish bajarildi** | Colab T4 | ⬜ **SIZ BAJARASIZ** |

### 4. Per-disease AUC-ROC — 20 ball ✅ KOD TAYYOR

| Talab | Qayerda | Holat |
|---|---|---|
| Har kasallik uchun `roc_auc_score` | `notebook` §8 | ✅ |
| Maqola bilan taqqoslash jadvali | `notebook` §8 + `WRITEUP.md` §4 | ✅ |
| Accuracy ishlatilmagan | butun loyihada — **grep bilan tekshirildi** | ✅ |
| Support (musbat holatlar soni) har AUC yonida | `notebook` §8, API `/meta`, UI tooltip | ✅ |
| 14 panelli ROC grid | `notebook` §8 | ✅ |
| **Haqiqiy AUC raqamlari** | | ⬜ **O'qitgandan keyin** |

### 5. Grad-CAM — 10 ball ✅ KOD TAYYOR

| Talab | Qayerda | Holat |
|---|---|---|
| Qo'lda hook bilan Grad-CAM | `notebook` §9 + `backend/app/model.py` | ✅ |
| Matematikasi tekshirildi | `backend/tests/test_gradcam_math.py` — **o'tdi** | ✅ |
| 3 panelli figura (Original/Heatmap/Overlay) | `notebook` §9 | ✅ |
| Radiologik izoh + 1 ta xato holat | `notebook` §9 markdown + `WRITEUP.md` §6 | ✅ shablon |
| **`gradcam_1..3.png` fayllari** | | ⬜ **O'qitgandan keyin** |

### 6. Real web app deploy — 25 ball ✅ KOD TAYYOR

| Talab | Qayerda | Holat |
|---|---|---|
| Backend API (FastAPI) | `backend/` — `/health`, `/meta`, `/predict` | ✅ |
| API testlari | `backend/tests/test_api.py` — **33 ta tekshiruv o'tdi** | ✅ |
| O'zining frontend'i (Gradio/Streamlit YO'Q) | `frontend/` — 16 ta React komponent | ✅ |
| `next build` muvaffaqiyatli | 99.1 kB First Load JS — **tekshirildi** | ✅ |
| `tsc --noEmit` xatosiz | 25 ta TS fayl — **tekshirildi** | ✅ |
| Hugging Face yo'q | **grep bilan tekshirildi — toza** | ✅ |
| Bepul, karta talab qilinmaydi | Colab + Render free + Vercel hobby | ✅ |
| **Jonli havola ishlaydi** | | ⬜ **SIZ DEPLOY QILASIZ** |

### 7. Disclaimer + write-up — 5 ball ✅ KOD TAYYOR

| Talab | Qayerda | Holat |
|---|---|---|
| Notebook birinchi katagida | `notebook` cell 0 | ✅ |
| Har bir API javobida | `schemas.py` → har `/predict` javobi | ✅ |
| UI hero'da (scroll qilmasdan ko'rinadi) | `Hero.tsx` | ✅ |
| UI footer'da | `Footer.tsx` | ✅ |
| Natijalar panelida | `PredictionsPanel.tsx` | ✅ |
| Write-up'da | `WRITEUP.md` boshi va oxiri | ✅ |
| Maqola bilan taqqoslash tahlili | `WRITEUP.md` §5 | ✅ shablon |

---

## Topshirish ro'yxati

| Talab qilingan | Fayl | Holat |
|---|---|---|
| Notebook: data → split → train → AUC → Grad-CAM | `notebook/chexnet_train.ipynb` (38 katak) | ✅ kod tayyor |
| Per-disease AUC jadvali | `auc_table.csv` + `WRITEUP.md` §4 | ⬜ o'qitgandan keyin |
| 2–3 Grad-CAM heatmap | `gradcam_1..3.png` | ⬜ o'qitgandan keyin |
| Jonli web app havolasi | Vercel + Render | ⬜ deploy'dan keyin |
| Frontend + backend kodi | `frontend/`, `backend/` | ✅ |
| Write-up + disclaimer | `WRITEUP.md` | ✅ shablon |

---

## Sizga qolgan 3 ta qadam

### Qadam 1 — Colab'da o'qitish (~60 daqiqa, asosan kutish)

1. `notebook/chexnet_train.ipynb` → [colab.research.google.com](https://colab.research.google.com)
2. **Runtime → Change runtime type → T4 GPU** (2-katak buni tekshiradi va bo'lmasa to'xtaydi)
3. **Runtime → Run all**
4. Kaggle autentifikatsiyasi so'raladi. Ishlamasa: 6-katakda `RUN_FALLBACK = True` qiling va
   `kaggle.json` yuklang.
5. Oxirida `chexnet_artifacts.zip` yuklab olinadi.

**Kutilgan natija: o'rtacha AUC ≈ 0.70–0.78.** Maqolaning 0.841 raqami emas — chunki siz
maqolaning ~4% ma'lumotida o'qitasiz. Bu kamchilik emas, rostgo'y natija.

### Qadam 2 — Fayllarni joylash (1 daqiqa)

```bash
python scripts/install_artifacts.py ~/Downloads/chexnet_artifacts.zip
```

Bu `chexnet_densenet121.pt`, `metrics.json`, `thresholds.json` ni `backend/artifacts/` ga,
3 ta namuna rentgenni `frontend/public/samples/` ga ko'chiradi va `metrics.json` to'g'riligini
tekshiradi.

### Qadam 3 — Deploy (~15 daqiqa)

[`DEPLOY.md`](DEPLOY.md) bo'yicha: Render → Vercel → `ALLOWED_ORIGINS` ni bog'lash.

Keyin:

```bash
./scripts/verify_deployment.sh https://chexnet-api-xxxx.onrender.com xray.png
```

Nihoyat `WRITEUP.md` va `SUBMISSION.md` dagi `<FILL: ...>` belgilarini haqiqiy raqamlaringiz
bilan almashtiring:

```bash
grep -rn "<FILL" WRITEUP.md SUBMISSION.md
```

---

## Men nimani tekshirdim (taxmin emas)

| Tekshiruv | Natija |
|---|---|
| `tsc --noEmit` — 25 ta TS/TSX fayl | 0 xato |
| `next build` | muvaffaqiyatli, 99.1 kB First Load JS, 4 marshrut |
| Backend API testi (`tests/test_api.py`) | 33/33 o'tdi |
| Grad-CAM matematikasi (`tests/test_gradcam_math.py`) | 20/20 o'tdi |
| Notebook JSON + 24 ta katak sintaksisi | 0 xato |
| 14 klass tartibi: notebook / backend / frontend | bir xil |
| Maqola AUC jadvali: notebook vs backend | bir xil, o'rtacha 0.8414 |
| `grep -ri "gradio\|streamlit\|huggingface"` | toza |
| Disclaimer qamrovi | 8/8 faylda |

**Tekshira olmaganim:** torch matematikasining o'zi. Bu muhitda torch o'rnatilmadi
(PyTorch CDN proksi bilan bloklangan, PyPI'dagi CUDA g'ildiragi diskka sig'madi), shuning uchun
API testlarida torch stub qilindi. Tensor hisob-kitoblari Colab'da ishga tushganda haqiqiy
tarzda bajariladi.

---

## Ma'lum xavflar va ularning yechimi

| Xavf | Yechim (allaqachon kodda) |
|---|---|
| Render 512 MB da Grad-CAM OOM | `CAM_MAX_CLASSES=1` env o'zgaruvchisi; yoki `DEPLOY.md` dagi **Plan B** — Colab GPU + cloudflared tunnel |
| Render 15 daqiqadan keyin uxlaydi | Frontend `/health` ni so'raydi va "Waking the model server" kartasini ko'rsatadi |
| Kaggle autentifikatsiyasi ishlamaydi | Notebook 6-katagida `kaggle.json` fallback |
| Colab uziladi | Hamma narsa Google Drive'ga saqlanadi |
| CUDA torch Render build'ni buzadi | `requirements.txt` da `+cpu` g'ildiraklari qattiq belgilangan |
| CORS xatosi | `ALLOWED_ORIGINS` + `*.vercel.app` regex; `DEPLOY.md` da alohida qadam |
| Namuna rentgenlar qo'shilmagan | UI 404 ni ushlaydi va tushunarli xabar beradi |

---

⚠️ **Educational project only.** This model is **not a medical device**, has not been clinically
validated, and must **never** be used for real diagnosis, triage, or treatment decisions.
