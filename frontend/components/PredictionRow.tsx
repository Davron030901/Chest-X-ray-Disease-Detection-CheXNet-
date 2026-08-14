"use client";

import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/cn";
import { BAND_BG, BAND_TEXT, band, pct } from "@/lib/severity";
import type { Prediction } from "@/lib/types";
import { pretty } from "@/lib/types";

export function PredictionRow({ p, index }: { p: Prediction; index: number }) {
  const b = band(p.probability);
  const lowSupport = p.support !== null && p.support < 20;

  const tip = [
    p.auc !== null ? `Test AUC ${p.auc.toFixed(2)}` : "AUC unavailable",
    p.support !== null ? `${p.support} positive cases in the test set` : null,
    "Model confidence, not clinical severity.",
    lowSupport ? "Low support - treat with caution." : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      className="flex h-11 items-center gap-3 border-b border-hairline px-1 transition-colors duration-150 last:border-0 hover:bg-elevated"
      style={{ animationDelay: `${index * 25}ms` }}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", BAND_BG[b])} aria-hidden />

      <span className="flex min-w-0 flex-1 items-center gap-1.5" title={tip}>
        <span className="truncate text-[14px] text-ink">{pretty(p.label)}</span>
        {lowSupport && <AlertTriangle className="h-3 w-3 shrink-0 text-faint" aria-hidden />}
      </span>

      <span className="hidden h-1.5 w-[88px] shrink-0 overflow-hidden rounded-full bg-elevated sm:block md:w-[140px]">
        <span
          className={cn("block h-full rounded-full origin-left", BAND_BG[b])}
          style={{
            width: `${Math.max(2, p.probability * 100)}%`,
            transition: "width .5s cubic-bezier(.16,1,.3,1)",
          }}
        />
      </span>

      <span className={cn("tnum w-14 shrink-0 text-right font-mono text-[13px] font-semibold", BAND_TEXT[b])}>
        {pct(p.probability)}%
      </span>

      <span className="w-[68px] shrink-0 text-right">
        {p.positive && (
          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] bg-elevated", BAND_TEXT[b])}>
            Positive
          </span>
        )}
      </span>

      <span className="sr-only">
        {pretty(p.label)}: {pct(p.probability)} percent model probability, threshold{" "}
        {p.threshold.toFixed(2)}, {p.positive ? "above" : "below"} threshold.
      </span>
    </li>
  );
}
