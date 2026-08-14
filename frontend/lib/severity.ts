export type Band = "low" | "moderate" | "elevated" | "high";

// Bands encode MODEL CONFIDENCE, not clinical severity. The UI must say so wherever
// these colors appear - see the tooltip in PredictionRow.
export function band(p: number): Band {
  if (p < 0.3) return "low";
  if (p < 0.6) return "moderate";
  if (p < 0.8) return "elevated";
  return "high";
}

export const BAND_LABEL: Record<Band, string> = {
  low: "Low",
  moderate: "Moderate",
  elevated: "Elevated",
  high: "High",
};

export const BAND_TEXT: Record<Band, string> = {
  low: "text-sev-low",
  moderate: "text-sev-mod",
  elevated: "text-sev-high",
  high: "text-sev-crit",
};

export const BAND_BG: Record<Band, string> = {
  low: "bg-sev-low",
  moderate: "bg-sev-mod",
  elevated: "bg-sev-high",
  high: "bg-sev-crit",
};

export const BAND_VAR: Record<Band, string> = {
  low: "var(--sev-low)",
  moderate: "var(--sev-mod)",
  elevated: "var(--sev-high)",
  high: "var(--sev-crit)",
};

export const pct = (p: number) => (p * 100).toFixed(1);
