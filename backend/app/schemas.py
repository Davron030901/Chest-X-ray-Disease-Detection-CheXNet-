"""Pydantic response models. These define the contract the frontend codes against."""

from typing import Dict, List, Optional

from pydantic import BaseModel, Field

DISCLAIMER = (
    "Educational project only. This model is not a medical device, has not been "
    "clinically validated, and must never be used for real diagnosis, triage, or "
    "treatment decisions. Always consult a qualified radiologist or physician."
)


class Health(BaseModel):
    status: str = "ok"
    model_loaded: bool
    model_version: str
    uptime_s: float
    device: str


class ClassMeta(BaseModel):
    label: str
    threshold: float
    auc: Optional[float] = None
    support: Optional[int] = None
    paper_auc: Optional[float] = None


class Meta(BaseModel):
    arch: str
    model_version: str
    img_size: int
    classes: List[str]
    per_class: List[ClassMeta]
    mean_auc: Optional[float] = None
    paper_mean_auc: float = 0.8414
    train_images: Optional[int] = None
    val_images: Optional[int] = None
    test_images: Optional[int] = None
    test_patients: Optional[int] = None
    dataset: str = "NIH ChestX-ray14 sample (5,606 images)"
    paper: str = "Rajpurkar et al., 2017 - CheXNet, arXiv:1711.05225"
    disclaimer: str = DISCLAIMER


class Prediction(BaseModel):
    label: str
    probability: float = Field(ge=0.0, le=1.0)
    threshold: float
    positive: bool
    auc: Optional[float] = None
    support: Optional[int] = None
    rank: int


class PredictResponse(BaseModel):
    predictions: List[Prediction]
    top_k: List[str]
    heatmaps: Dict[str, str] = {}
    input_preview: str
    inference_ms: int
    model_version: str
    disclaimer: str = DISCLAIMER


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody
