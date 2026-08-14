# Deployment guide

Colab (train) → Render (backend) → Vercel (frontend). Free tiers only, no credit card.

> ⚠️ **Educational project only.** Not a medical device. Never use for real diagnosis.

---

## Step 1 — Train in Colab

1. Upload `notebook/chexnet_train.ipynb` to [colab.research.google.com](https://colab.research.google.com).
2. **Runtime → Change runtime type → T4 GPU.** Cell 2 asserts this and stops if you forget.
3. **Runtime → Run all.** Cell 5 will ask you to authenticate with Kaggle; if that fails, set
   `RUN_FALLBACK = True` in cell 6 and upload your `kaggle.json`.
4. Wait 45–90 minutes. Watch the per-epoch `val mean AUC` line.
5. The last cell downloads `chexnet_artifacts.zip`.

**What you should see:** mean test AUC roughly **0.70–0.78**. That is the honest result for 5% of the
paper's training data. If you see 0.85+, check the leakage assertion actually ran.

Unzip and distribute:

```
chexnet_densenet121.pt  → backend/artifacts/
metrics.json            → backend/artifacts/
thresholds.json         → backend/artifacts/
samples/sample-1..3.png → frontend/public/samples/
gradcam_*.png, roc_grid.png, auc_table.csv, training_curves.png → keep for the write-up
```

---

## Step 2 — Backend on Render

### 2a. Push

```bash
cd backend
git init && git add -A
git commit -m "CheXNet inference API"
git remote add origin https://github.com/<you>/chexnet-backend.git
git push -u origin main
```

`chexnet_densenet121.pt` is ~28 MB — under GitHub's 100 MB limit, so commit it. No Git LFS, no
download at boot, no external model host.

### 2b. Deploy

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**.
2. Connect the `chexnet-backend` repo.
3. Confirm these (Render reads `render.yaml`, but verify in the UI):
   - Runtime **Python 3**
   - Build `pip install -r requirements.txt`
   - Start `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1`
   - Instance type **Free**
   - Health check path `/health`
4. Add env var `PYTHON_VERSION = 3.11`.
5. **Create Web Service.** First build takes 5–10 minutes (the CPU torch wheel is ~190 MB).
6. Copy the URL: `https://chexnet-api-xxxx.onrender.com`.

### 2c. Verify

```bash
API=https://chexnet-api-xxxx.onrender.com
curl -s $API/health          # {"status":"ok","model_loaded":true,...}
curl -s $API/meta | head -c 400
curl -s -F "file=@xray.png" "$API/predict?cam=true&top_k=3" | head -c 600
```

If `/health` returns `"model_loaded": false`, the checkpoint didn't reach `artifacts/` — check the
Render build log for the file listing.

### 2d. Keep it warm for the demo (optional)

Free services sleep after ~15 minutes idle and take 30–60 s to wake. Point a free pinger such as
[cron-job.org](https://cron-job.org) at `/health` every 10 minutes before you demo. The frontend
already handles the cold start gracefully, so this is a convenience, not a fix.

---

## Step 3 — Frontend on Vercel

### 3a. Prepare

```bash
cd frontend
# three TEST-split X-rays from the Colab artifacts:
cp ~/Downloads/artifacts/samples/sample-*.png public/samples/
# edit app/page.tsx: set FRONTEND_REPO and BACKEND_REPO to your real URLs
```

### 3b. Push and deploy

```bash
git init && git add -A && git commit -m "Radiograph AI frontend"
git remote add origin https://github.com/<you>/chexnet-frontend.git
git push -u origin main
```

1. [vercel.com/new](https://vercel.com/new) → import `chexnet-frontend`.
2. Framework preset: **Next.js** (auto-detected).
3. **Environment Variables** → add for **Production, Preview and Development**:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://chexnet-api-xxxx.onrender.com` |

   `NEXT_PUBLIC_*` variables are inlined at build time. Adding one later requires a **redeploy**,
   not just a save.
4. **Deploy.** Copy the live URL.

---

## Step 4 — Connect them (do not skip)

Back on Render → your service → **Environment** → set:

```
     = https://your-app.vercel.app,http://localhost:3000
```

**Save changes** (this triggers a redeploy). Vercel preview URLs are already matched by the
`https://*.vercel.app` regex in `main.py`.

Then verify **from the live Vercel URL, not localhost**: open it in an incognito window, upload a
sample X-ray, confirm 14 probabilities and a heatmap render.

Or run the scripted check:

```bash
./scripts/verify_deployment.sh https://chexnet-api-xxxx.onrender.com path/to/xray.png
```

---

## Plan B — backend on a Colab GPU + free tunnel

Render's free tier gives you 512 MB and 0.1 CPU. The code is built for it, but if you hit repeated
502s during Grad-CAM, you have two options before abandoning the tier:

1. Set `CAM_MAX_CLASSES = 1` in Render's environment. One backward pass instead of three.
2. Switch to this Plan B, which is the deployment route the task description itself hints at.

**Plan B keeps every rule intact**: your own frontend on Vercel, a real backend API, free, no credit
card, no Hugging Face, no Gradio. The only difference is where the backend runs. The trade-off is
that the tunnel URL dies when the Colab runtime stops, so this is best for a live demo, not for a
link you submit and forget.

Add this cell at the end of the training notebook (or a new notebook that loads the checkpoint):

```python
# ---- Plan B: serve the API from this Colab runtime over a free Cloudflare tunnel ----
!pip -q install fastapi uvicorn python-multipart nest_asyncio
!wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared
!chmod +x /usr/local/bin/cloudflared

# Reuse the deployed backend verbatim so the two paths cannot drift apart.
!git clone -q https://github.com/<you>/chexnet-backend.git /content/backend
!cp {ART}/chexnet_densenet121.pt {ART}/metrics.json {ART}/thresholds.json /content/backend/artifacts/

import os, subprocess, sys, time, threading, re
os.environ["ALLOWED_ORIGINS"] = "https://<your-app>.vercel.app,http://localhost:3000"
sys.path.insert(0, "/content/backend")

import nest_asyncio, uvicorn
nest_asyncio.apply()
from app.main import app

threading.Thread(
    target=lambda: uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning"),
    daemon=True,
).start()
time.sleep(12)

proc = subprocess.Popen(
    ["cloudflared", "tunnel", "--url", "http://localhost:8000", "--no-autoupdate"],
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1,
)
for line in proc.stdout:
    m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", line)
    if m:
        print("\nPUBLIC API URL:", m.group(0))
        print("Put this in Vercel as NEXT_PUBLIC_API_URL, then redeploy the frontend.")
        break
```

Notes:

- `cloudflared` quick tunnels need no account and no card. `trycloudflare.com` URLs are ephemeral.
- The backend code is cloned from your own repo, not rewritten inline, so Plan A and Plan B serve
  byte-identical logic.
- Inference here runs on the T4, so it is far faster than Render's CPU — but the runtime disconnects
  after ~90 minutes idle and the URL changes on every restart. Re-run the cell and update
  `NEXT_PUBLIC_API_URL`.
- Keep the Colab tab open during a demo.

**Recommendation:** deploy on Render as the permanent submission link, and keep Plan B ready as a
live fallback. Render's URL is stable, which is what a grader needs.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Render build fails, out of memory / disk | The CUDA torch wheel (~2.5 GB) got pulled in | Confirm `requirements.txt` starts with `--extra-index-url https://download.pytorch.org/whl/cpu` and pins `+cpu` versions |
| Build fails: `No matching distribution for torch==2.3.1+cpu` | Python version mismatch | Set `PYTHON_VERSION=3.11`; the `+cpu` wheels don't cover every interpreter |
| `/health` says `model_loaded: false` | Checkpoint missing | `git ls-files backend/artifacts` — is the `.pt` committed? Check `.gitignore` isn't excluding it |
| 422 on `/predict` | `python-multipart` missing | It's in `requirements.txt`; confirm the build installed it |
| CORS error in the browser console | `ALLOWED_ORIGINS` still the default | Set it to your Vercel domain and redeploy the backend |
| Mixed-content block | Backend called over `http://` from an `https://` page | Always use the `https://` Render URL |
| First prediction times out | Cold start | The client waits 90 s and retries once. If it still fails, hit `/health` directly to wake it |
| Frontend still points at localhost | `NEXT_PUBLIC_API_URL` set after the build | Redeploy on Vercel |
| Hydration mismatch warning on load | Theme applied before mount | Already handled — `useTheme` renders a stable icon until mounted |
| 502 after ~30 s on Render | Worker OOM during Grad-CAM | Request without `cam=true` to confirm; the CAM path already frees tensors and calls `gc.collect()` |

---

## Rule compliance

| Rule | How this project satisfies it |
|---|---|
| Own frontend, no Gradio/Streamlit | Hand-written Next.js 14 + Tailwind. The backend serves JSON only — it has no HTML UI at all |
| No Hugging Face | Weights committed to the backend repo; no Spaces, no HF Hub, no HF Inference API |
| Free hosting, no credit card | Colab free T4, Render free web service, Vercel hobby |
| Real dataset | NIH ChestX-ray14 sample, 5,606 real radiographs |
| Patient-level split | `GroupShuffleSplit` on `Patient ID` + a hard disjointness assertion in the notebook |
| AUC not accuracy | Per-disease AUC-ROC with support counts; accuracy is never reported |
