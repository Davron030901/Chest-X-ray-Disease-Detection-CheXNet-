export type Prediction = {
  label: string;
  probability: number;
  threshold: number;
  positive: boolean;
  auc: number | null;
  support: number | null;
  rank: number;
};

export type PredictResponse = {
  predictions: Prediction[];
  top_k: string[];
  heatmaps: Record<string, string>;
  input_preview: string;
  inference_ms: number;
  model_version: string;
  disclaimer: string;
};

export type ClassMeta = {
  label: string;
  threshold: number;
  auc: number | null;
  support: number | null;
  paper_auc: number | null;
};

export type Meta = {
  arch: string;
  model_version: string;
  img_size: number;
  classes: string[];
  per_class: ClassMeta[];
  mean_auc: number | null;
  paper_mean_auc: number;
  train_images: number | null;
  val_images: number | null;
  test_images: number | null;
  test_patients: number | null;
  dataset: string;
  paper: string;
  disclaimer: string;
};

export type Health = {
  status: string;
  model_loaded: boolean;
  model_version: string;
  uptime_s: number;
  device: string;
};

export type ApiError = { code: string; message: string };

export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export const CLASSES = [
  "Atelectasis", "Cardiomegaly", "Effusion", "Infiltration",
  "Mass", "Nodule", "Pneumonia", "Pneumothorax",
  "Consolidation", "Edema", "Emphysema", "Fibrosis",
  "Pleural_Thickening", "Hernia",
] as const;

export const DISCLAIMER =
  "Educational project only. This model is not a medical device, has not been clinically " +
  "validated, and must never be used for real diagnosis, triage, or treatment decisions. " +
  "Always consult a qualified radiologist or physician.";

export const pretty = (label: string) => label.replace(/_/g, " ");
