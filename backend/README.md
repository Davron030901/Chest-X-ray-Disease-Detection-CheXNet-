# CheXNet API (backend)

FastAPI service that runs a DenseNet-121 CheXNet model on CPU and returns 14 pathology
probabilities plus Grad-CAM heatmaps. Deployed on **Render free tier**.

> **Educational project only.** Not a medical device. Never use for real diagnosis.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | liveness; the frontend polls this to wake the dyno |
| `GET` | `/meta` | classes, thresholds, per-class test AUC + support, disclaimer |
| `POST` | `/predict` | multipart `file`; `?cam=true&top_k=3` |
| `GET` | `/docs` | auto OpenAPI docs |

## Before you deploy

Copy these three files from the Colab artifacts bundle into `artifacts/`:

```
artifacts/chexnet_densenet121.pt    # ~28 MB, commit it (GitHub allows up to 100 MB)
artifacts/metrics.json
artifacts/thresholds.json
```

The app boots without them but `/health` reports `degraded` and `/predict` returns 503.

## Local run

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
curl localhost:8000/health
curl -F "file=@xray.png" "localhost:8000/predict?cam=true&top_k=3" | head -c 600
```

## Free-tier notes

512 MB RAM, 0.1 CPU, sleeps after ~15 min idle with a 30-60 s cold start. The code accounts for it:
CPU-only torch wheels, `torch.set_num_threads(1)`, one worker, model loaded once in the lifespan,
Grad-CAM opt-in and freed immediately after use, no matplotlib.

Set `ALLOWED_ORIGINS` to your Vercel domain after the frontend is deployed, then redeploy.
