"use client";

import { AlertCircle, Check, Copy, Download, RotateCcw } from "lucide-react";
import { useState } from "react";

import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { PredictionRow } from "@/components/PredictionRow";
import { TopFindingCard } from "@/components/TopFindingCard";
import type { ApiError, PredictResponse } from "@/lib/types";
import { buildAnnotatedPng, downloadBlob } from "@/lib/exportImage";
import { CLASSES, pretty } from "@/lib/types";

export function PredictionsPanel({
  result,
  loading,
  error,
  onRetry,
  onReset,
  active,
  onActiveChange,
  camOpacity,
}: {
  result: PredictResponse | null;
  loading: boolean;
  error: ApiError | null;
  onRetry: () => void;
  onReset: () => void;
  active: string | null;
  onActiveChange: (c: string) => void;
  camOpacity: number;
}) {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  if (error && error.code !== "invalid_file") {
    return (
      <div className="elev rounded-2xl bg-surface p-5" role="alert">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-sev-crit" aria-hidden />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink">Prediction failed</p>
            <p className="mt-1 text-[13px] leading-5 text-muted">{error.message}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onRetry}
                className="rounded-lg bg-accent-strong px-3 py-2 text-[13px] font-medium text-accent-ink transition hover:brightness-110 active:scale-[.98]"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={onReset}
                className="rounded-lg border border-strong px-3 py-2 text-[13px] text-ink transition hover:bg-elevated"
              >
                Start over
              </button>
            </div>
            <p className="mt-3 font-mono text-[11px] text-faint">code: {error.code}</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="elev rounded-2xl bg-surface p-4" aria-busy="true" aria-live="polite">
        <div className="skeleton mb-4 h-4 w-32 rounded" />
        <div className="mb-5 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-[104px] rounded-xl" />
          ))}
        </div>
        <ul className="space-y-2">
          {CLASSES.map((c) => (
            <li key={c} className="skeleton h-8 rounded" />
          ))}
        </ul>
        <p className="sr-only">Analysing the radiograph</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="elev rounded-2xl bg-surface p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
          Awaiting an image
        </p>
        <p className="mt-2 max-w-[46ch] text-[13px] leading-5 text-muted">
          Upload a frontal chest X-ray to see probabilities for all 14 pathologies and a Grad-CAM
          heatmap for the top findings.
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
          {CLASSES.map((c) => (
            <li key={c} className="flex items-center gap-2 text-[12px] text-faint">
              <span className="h-1 w-1 rounded-full bg-faint" aria-hidden />
              {pretty(c)}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const top = result.predictions.slice(0, 3);

  return (
    <div className="animate-rise space-y-4">
      <DisclaimerBanner compact />

      <div className="elev rounded-2xl bg-surface p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
            Top findings
          </h2>
          <span className="tnum font-mono text-[11px] text-faint">{result.inference_ms} ms</span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {top.map((p) => (
            <TopFindingCard
              key={p.label}
              p={p}
              selected={active === p.label}
              onSelect={() => onActiveChange(p.label)}
            />
          ))}
        </div>
      </div>

      <div className="elev rounded-2xl bg-surface p-4">
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
          All 14 pathologies
        </h2>
        <ul aria-live="polite">
          {result.predictions.map((p, i) => (
            <PredictionRow key={p.label} p={p} index={i} />
          ))}
        </ul>
        <p className="sr-only">
          Analysis complete. Top finding: {pretty(top[0].label)} at{" "}
          {Math.round(top[0].probability * 100)} percent.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const clean = { ...result, heatmaps: Object.keys(result.heatmaps), input_preview: "<omitted>" };
              void navigator.clipboard.writeText(JSON.stringify(clean, null, 2));
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-strong px-3 py-2 text-[13px] text-ink transition hover:bg-elevated"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-sev-low" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy JSON"}
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              setExportError(null);
              try {
                const blob = await buildAnnotatedPng({
                  preview: result.input_preview,
                  heatmap: active ? result.heatmaps[active] : undefined,
                  opacity: camOpacity / 100,
                  predictions: result.predictions,
                  activeLabel: active,
                  modelVersion: result.model_version,
                });
                downloadBlob(blob, `radiograph-ai-${active ?? "result"}.png`);
              } catch {
                setExportError("Could not build the image. Try again, or use Copy JSON.");
              } finally {
                setExporting(false);
              }
            }}
            className="flex items-center gap-1.5 rounded-lg border border-strong px-3 py-2 text-[13px] text-ink transition hover:bg-elevated disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? "Building…" : "Download PNG"}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-lg border border-strong px-3 py-2 text-[13px] text-ink transition hover:bg-elevated"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New image
          </button>
        </div>
        {exportError && (
          <p role="alert" className="mt-2 text-[12px] text-sev-crit">
            {exportError}
          </p>
        )}
      </div>
    </div>
  );
}
