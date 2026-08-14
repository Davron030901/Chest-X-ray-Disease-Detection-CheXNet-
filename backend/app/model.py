"""
Model loading, preprocessing, inference and Grad-CAM.

Written for Render's free tier: 512 MB RAM, 0.1 CPU, cold start after ~15 min idle.
Every decision below follows from that budget.

  * CPU-only torch, single thread  - 0.1 CPU makes intra-op threading counterproductive.
  * One module-level singleton      - the model is loaded once in the FastAPI lifespan.
  * Manual Grad-CAM with hooks      - avoids the grad-cam package entirely.
  * Hand-rolled jet colormap        - avoids pulling in matplotlib (~50 MB + import cost).
  * Explicit del + gc after CAM     - the backward pass is the memory high-water mark.
"""

from __future__ import annotations

import base64
import gc
import io
import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from torchvision import transforms
from torchvision.models import densenet121

log = logging.getLogger("chexnet.model")

torch.set_num_threads(1)
torch.set_grad_enabled(False)

ARTIFACTS = Path(os.getenv("ARTIFACTS_DIR", Path(__file__).resolve().parent.parent / "artifacts"))
CKPT_PATH = ARTIFACTS / "chexnet_densenet121.pt"

# Fallback order must match training. The checkpoint overrides this if it carries its own list.
DEFAULT_CLASSES = [
    "Atelectasis", "Cardiomegaly", "Effusion", "Infiltration",
    "Mass", "Nodule", "Pneumonia", "Pneumothorax",
    "Consolidation", "Edema", "Emphysema", "Fibrosis",
    "Pleural_Thickening", "Hernia",
]

PAPER_AUC = {
    "Atelectasis": 0.8094, "Cardiomegaly": 0.9248, "Effusion": 0.8638,
    "Infiltration": 0.7345, "Mass": 0.8676, "Nodule": 0.7802,
    "Pneumonia": 0.7680, "Pneumothorax": 0.8887, "Consolidation": 0.7901,
    "Edema": 0.8878, "Emphysema": 0.9371, "Fibrosis": 0.8047,
    "Pleural_Thickening": 0.8062, "Hernia": 0.9164,
}

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
# Grad-CAM runs a backward pass, which is the memory high-water mark on a 512 MB box.
# If Render OOMs (502 mid-request), drop this to 1 via the env var before giving up on the tier.
CAM_MAX_CLASSES = int(os.getenv("CAM_MAX_CLASSES", "3"))
ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}


# --------------------------------------------------------------------------------------
# colormap
# --------------------------------------------------------------------------------------
def _jet(x: np.ndarray) -> np.ndarray:
    """Matplotlib-compatible 'jet' without importing matplotlib. x in [0,1] -> uint8 RGB."""
    r = np.clip(1.5 - np.abs(4.0 * x - 3.0), 0.0, 1.0)
    g = np.clip(1.5 - np.abs(4.0 * x - 2.0), 0.0, 1.0)
    b = np.clip(1.5 - np.abs(4.0 * x - 1.0), 0.0, 1.0)
    return (np.stack([r, g, b], axis=-1) * 255.0).astype(np.uint8)


def _png_data_url(arr: np.ndarray, mode: str = "RGB") -> str:
    buf = io.BytesIO()
    Image.fromarray(arr, mode=mode).save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


# --------------------------------------------------------------------------------------
# Grad-CAM
# --------------------------------------------------------------------------------------
class GradCAM:
    """Grad-CAM on the last dense block (1024 x 7 x 7 for a 224 x 224 input)."""

    def __init__(self, model: nn.Module, target_layer: nn.Module):
        self.model = model
        self.acts: Optional[torch.Tensor] = None
        self.grads: Optional[torch.Tensor] = None
        self._handle = target_layer.register_forward_hook(self._forward_hook)

    def _forward_hook(self, module, inp, out):
        self.acts = out
        if out.requires_grad:
            out.register_hook(self._save_grad)

    def _save_grad(self, grad):
        self.grads = grad

    def __call__(self, x: torch.Tensor, class_idx: int) -> np.ndarray:
        self.model.zero_grad(set_to_none=True)
        # Grad-CAM needs gradients; the app runs with grad globally disabled.
        with torch.enable_grad():
            xg = x.clone().requires_grad_(True)
            logits = self.model(xg)
            logits[0, class_idx].backward()

        A = self.acts[0]                                  # (1024, 7, 7)
        G = self.grads[0]                                 # (1024, 7, 7)
        alpha = G.mean(dim=(1, 2), keepdim=True)          # channel importance
        cam = F.relu((alpha * A).sum(0))                  # keep evidence FOR the class only

        size = x.shape[-1]
        cam = F.interpolate(cam[None, None], size=(size, size),
                            mode="bilinear", align_corners=False)[0, 0]
        cam = cam - cam.min()
        cam = cam / (cam.max() + 1e-8)
        out = cam.detach().cpu().numpy()

        # The backward pass is the memory peak on a 512 MB box. Drop everything now.
        self.acts = None
        self.grads = None
        del A, G, alpha, cam, logits, xg
        self.model.zero_grad(set_to_none=True)
        gc.collect()
        return out

    def close(self):
        self._handle.remove()


# --------------------------------------------------------------------------------------
# service singleton
# --------------------------------------------------------------------------------------
class CheXNetService:
    def __init__(self):
        self.model: Optional[nn.Module] = None
        self.cam: Optional[GradCAM] = None
        self.classes: List[str] = DEFAULT_CLASSES
        self.img_size: int = 224
        self.mean = [0.485, 0.456, 0.406]
        self.std = [0.229, 0.224, 0.225]
        self.model_version = "densenet121-nih-sample-v1"
        self.arch = "densenet121"
        self.thresholds: Dict[str, float] = {}
        self.metrics: Dict = {}
        self.loaded = False

    # -- loading -----------------------------------------------------------------------
    def load(self) -> None:
        if not CKPT_PATH.exists():
            raise FileNotFoundError(
                f"Checkpoint not found at {CKPT_PATH}. Copy chexnet_densenet121.pt from the "
                f"Colab artifacts bundle into backend/artifacts/ before deploying."
            )

        ckpt = torch.load(CKPT_PATH, map_location="cpu")
        state = ckpt.get("state_dict", ckpt)

        self.classes = ckpt.get("classes", DEFAULT_CLASSES)
        self.img_size = int(ckpt.get("img_size", 224))
        norm = ckpt.get("normalize", {})
        self.mean = norm.get("mean", self.mean)
        self.std = norm.get("std", self.std)
        self.arch = ckpt.get("arch", "densenet121")
        self.model_version = ckpt.get("model_version", self.model_version)

        # weights=None: we are loading our own trained weights, not ImageNet.
        model = densenet121(weights=None)
        model.classifier = nn.Linear(model.classifier.in_features, len(self.classes))
        missing, unexpected = model.load_state_dict(state, strict=False)
        if missing or unexpected:
            log.warning("state_dict mismatch missing=%s unexpected=%s", missing, unexpected)
        model.eval()

        self.model = model
        self.cam = GradCAM(model, model.features.denseblock4)
        self.transform = transforms.Compose([
            transforms.Resize(int(self.img_size * 256 / 224)),
            transforms.CenterCrop(self.img_size),
            transforms.ToTensor(),
            transforms.Normalize(self.mean, self.std),
        ])

        self._load_sidecars()
        self.loaded = True
        n_params = sum(p.numel() for p in model.parameters()) / 1e6
        log.info("model loaded: %s, %d classes, %.1fM params", self.arch, len(self.classes), n_params)
        gc.collect()

    def _load_sidecars(self) -> None:
        thr_path = ARTIFACTS / "thresholds.json"
        met_path = ARTIFACTS / "metrics.json"
        if thr_path.exists():
            self.thresholds = json.loads(thr_path.read_text())
        else:
            log.warning("thresholds.json missing - defaulting every class to 0.5")
        if met_path.exists():
            self.metrics = json.loads(met_path.read_text())
        else:
            log.warning("metrics.json missing - AUC fields will be null")

    # -- helpers -----------------------------------------------------------------------
    def threshold_for(self, label: str) -> float:
        return float(self.thresholds.get(label, 0.5))

    def stats_for(self, label: str) -> Tuple[Optional[float], Optional[int]]:
        pc = self.metrics.get("per_class", {}).get(label, {})
        return pc.get("auc"), pc.get("support")

    def preprocess(self, raw: bytes) -> Tuple[torch.Tensor, np.ndarray, Tuple[int, int]]:
        """bytes -> (normalised tensor, uint8 preview matching the tensor, original size)."""
        img = Image.open(io.BytesIO(raw))
        img.verify()                                   # cheap structural check
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        original_size = img.size

        tensor = self.transform(img)[None]             # (1, 3, S, S)

        # The preview is the exact crop the model saw, so heatmaps line up pixel for pixel.
        preview = np.asarray(
            transforms.CenterCrop(self.img_size)(
                transforms.Resize(int(self.img_size * 256 / 224))(img)
            ),
            dtype=np.uint8,
        )
        return tensor, preview, original_size

    # -- inference ---------------------------------------------------------------------
    def predict(self, tensor: torch.Tensor) -> np.ndarray:
        with torch.inference_mode():
            logits = self.model(tensor)
            probs = torch.sigmoid(logits.float())[0].cpu().numpy()
        return probs

    def heatmap_png(self, tensor: torch.Tensor, class_idx: int) -> str:
        cam = self.cam(tensor, class_idx)
        rgb = _jet(cam)
        # Alpha ramp: cold regions stay transparent so the frontend can alpha-composite
        # over the X-ray without washing it out. gamma 0.8 lifts mid activations slightly.
        alpha = (np.clip(cam, 0.0, 1.0) ** 0.8 * 255.0).astype(np.uint8)
        rgba = np.dstack([rgb, alpha])
        return _png_data_url(rgba, mode="RGBA")


service = CheXNetService()
