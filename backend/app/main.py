"""
CheXNet inference API.

    GET  /health              liveness + warm-up target for the frontend
    GET  /meta                classes, thresholds, per-class AUC, disclaimer
    POST /predict             multipart image -> 14 probabilities (+ optional Grad-CAM)

Deployed on Render's free tier (512 MB RAM, 0.1 CPU, sleeps after ~15 min idle).
There is deliberately no HTML UI here: the frontend is a separate Next.js app on Vercel.
"""

from __future__ import annotations

import logging
import os
import time
from contextlib import asynccontextmanager
from typing import List

import numpy as np
import torch
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .model import (
    ALLOWED_CONTENT_TYPES,
    CAM_MAX_CLASSES,
    MAX_UPLOAD_BYTES,
    PAPER_AUC,
    _png_data_url,
    service,
)
from .schemas import (
    DISCLAIMER,
    ClassMeta,
    Health,
    Meta,
    PredictResponse,
    Prediction,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("chexnet.api")

START_TIME = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load once at boot, never per request. On the free tier this is the difference
    # between a 0.4 s prediction and a 6 s prediction.
    try:
        service.load()
    except Exception as exc:  # noqa: BLE001 - keep the app up so /health can report the fault
        log.exception("model failed to load: %s", exc)
    yield
    if service.cam is not None:
        service.cam.close()


app = FastAPI(
    title="CheXNet API",
    version="1.0.0",
    description=(
        "Multi-label chest X-ray classification (14 thoracic pathologies) with Grad-CAM. "
        + DISCLAIMER
    ),
    lifespan=lifespan,
)

_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    # Vercel gives every deployment a unique preview domain, so match them by regex too.
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def fail(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message})


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail:
        body = {"error": detail}
    else:
        body = {"error": {"code": "http_error", "message": str(detail)}}
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # FastAPI's default 422 body has a different shape; the frontend only understands
    # {"error": {"code", "message"}}, so normalise it here.
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", [])[1:]) or "request"
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "invalid_request",
                           "message": f"Invalid {field}: {first.get('msg', 'validation failed')}."}},
    )


@app.get("/", include_in_schema=False)
async def root():
    return {
        "service": "CheXNet API",
        "docs": "/docs",
        "endpoints": ["/health", "/meta", "/predict"],
        "disclaimer": DISCLAIMER,
    }


@app.get("/health", response_model=Health)
async def health():
    return Health(
        status="ok" if service.loaded else "degraded",
        model_loaded=service.loaded,
        model_version=service.model_version,
        uptime_s=round(time.time() - START_TIME, 1),
        device="cpu",
    )


@app.get("/meta", response_model=Meta)
async def meta():
    if not service.loaded:
        raise fail(503, "model_not_loaded", "Model is not loaded. Check the server logs.")

    per_class: List[ClassMeta] = []
    for label in service.classes:
        auc, support = service.stats_for(label)
        per_class.append(
            ClassMeta(
                label=label,
                threshold=service.threshold_for(label),
                auc=auc,
                support=support,
                paper_auc=PAPER_AUC.get(label),
            )
        )

    m = service.metrics
    return Meta(
        arch=service.arch,
        model_version=service.model_version,
        img_size=service.img_size,
        classes=service.classes,
        per_class=per_class,
        mean_auc=m.get("mean_auc"),
        train_images=m.get("train_images"),
        val_images=m.get("val_images"),
        test_images=m.get("test_images"),
        test_patients=m.get("test_patients"),
    )


@app.post("/predict", response_model=PredictResponse)
async def predict(
    file: UploadFile = File(...),
    cam: bool = Query(False, description="Also return Grad-CAM heatmaps for the top_k classes"),
    top_k: int = Query(3, ge=1, le=14),
):
    if not service.loaded:
        raise fail(503, "model_not_loaded", "Model is still starting up. Retry in a moment.")

    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise fail(
            415,
            "unsupported_type",
            f"Unsupported file type '{content_type or 'unknown'}'. Upload a PNG, JPEG or WEBP image.",
        )

    raw = await file.read()
    if len(raw) == 0:
        raise fail(400, "empty_file", "The uploaded file is empty.")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise fail(413, "file_too_large",
                   f"File is {len(raw)/1e6:.1f} MB. The limit is {MAX_UPLOAD_BYTES/1e6:.0f} MB.")

    try:
        tensor, preview, original_size = service.preprocess(raw)
    except Exception:
        raise fail(400, "invalid_image",
                   "That file could not be decoded as an image. Try a different PNG or JPEG.")

    t0 = time.perf_counter()
    probs = service.predict(tensor)
    order = np.argsort(-probs)

    predictions: List[Prediction] = []
    for rank, idx in enumerate(order, start=1):
        label = service.classes[int(idx)]
        p = float(probs[int(idx)])
        thr = service.threshold_for(label)
        auc, support = service.stats_for(label)
        predictions.append(
            Prediction(
                label=label, probability=round(p, 4), threshold=thr,
                positive=p >= thr, auc=auc, support=support, rank=rank,
            )
        )

    top_labels = [p.label for p in predictions[:top_k]]

    heatmaps = {}
    if cam:
        # Cap how many backward passes one request can trigger. Each CAM costs
        # roughly one forward+backward on a 512 MB instance.
        for label in top_labels[:CAM_MAX_CLASSES]:
            try:
                heatmaps[label] = service.heatmap_png(tensor, service.classes.index(label))
            except Exception:  # noqa: BLE001 - a failed CAM must not fail the prediction
                log.exception("grad-cam failed for %s", label)

    elapsed = int((time.perf_counter() - t0) * 1000)
    log.info("predict: %sx%s cam=%s top_k=%s in %sms",
             original_size[0], original_size[1], cam, top_k, elapsed)

    return PredictResponse(
        predictions=predictions,
        top_k=top_labels,
        heatmaps=heatmaps,
        input_preview=_png_data_url(preview),
        inference_ms=elapsed,
        model_version=service.model_version,
    )
