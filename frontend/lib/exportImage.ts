import type { Prediction } from "./types";
import { pretty } from "./types";

const BAND_HEX = (p: number) =>
  p < 0.3 ? "#34D399" : p < 0.6 ? "#FBBF24" : p < 0.8 ? "#FB923C" : "#F43F5E";

const load = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = src;
  });

/**
 * Composites preview + heatmap + a legend strip into one PNG the user can attach
 * to a report. Runs entirely on the client - no extra backend round trip.
 */
export async function buildAnnotatedPng(opts: {
  preview: string;
  heatmap?: string;
  opacity: number;
  predictions: Prediction[];
  activeLabel: string | null;
  modelVersion: string;
}): Promise<Blob> {
  const { preview, heatmap, opacity, predictions, activeLabel, modelVersion } = opts;

  const base = await load(preview);
  const S = 512;
  const STRIP = 190;

  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S + STRIP;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  ctx.fillStyle = "#0A0E14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(base, 0, 0, S, S);

  if (heatmap) {
    const hm = await load(heatmap);
    ctx.globalAlpha = opacity;
    ctx.drawImage(hm, 0, 0, S, S);
    ctx.globalAlpha = 1;
  }

  if (activeLabel) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(10, 10, ctx.measureText(pretty(activeLabel)).width + 120, 26);
    ctx.fillStyle = "#22D3EE";
    ctx.font = "600 15px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(`Grad-CAM: ${pretty(activeLabel)}`, 20, 28);
  }

  let y = S + 28;
  ctx.font = "600 14px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "#E9EFF6";
  ctx.fillText("Top findings", 16, y);
  y += 22;

  ctx.font = "13px ui-monospace, SFMono-Regular, monospace";
  for (const p of predictions.slice(0, 5)) {
    ctx.fillStyle = "#96A8BC";
    ctx.fillText(pretty(p.label), 16, y);

    const barX = 230;
    const barW = 200;
    ctx.fillStyle = "#18212E";
    ctx.fillRect(barX, y - 9, barW, 8);
    ctx.fillStyle = BAND_HEX(p.probability);
    ctx.fillRect(barX, y - 9, Math.max(3, barW * p.probability), 8);

    ctx.fillStyle = BAND_HEX(p.probability);
    ctx.fillText(`${(p.probability * 100).toFixed(1)}%`, barX + barW + 12, y);
    y += 20;
  }

  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "#FBBF24";
  ctx.fillText("Educational project - NOT a medical device. Never use for real diagnosis.", 16, S + STRIP - 24);
  ctx.fillStyle = "#5D6E82";
  ctx.fillText(`model ${modelVersion} · CheXNet reproduction (arXiv:1711.05225)`, 16, S + STRIP - 9);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
