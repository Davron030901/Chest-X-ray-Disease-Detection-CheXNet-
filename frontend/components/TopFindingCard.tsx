"use client";

import { cn } from "@/lib/cn";
import { BAND_BG, BAND_TEXT, band, pct } from "@/lib/severity";
import type { Prediction } from "@/lib/types";
import { pretty } from "@/lib/types";

export function TopFindingCard({
  p,
  selected,
  onSelect,
}: {
  p: Prediction;
  selected: boolean;
  onSelect: () => void;
}) {
  const b = band(p.probability);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full flex-col gap-2 rounded-xl border p-3 text-left transition-all duration-150",
        selected ? "border-strong bg-accent/[0.06]" : "border-hairline bg-surface hover:bg-elevated",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", BAND_BG[b])} aria-hidden />
          <span className="truncate text-[13px] font-medium text-ink">{pretty(p.label)}</span>
        </span>
        <span className="tnum shrink-0 font-mono text-[11px] text-faint">#{p.rank}</span>
      </span>

      <span className={cn("tnum font-mono text-[26px] font-semibold leading-none", BAND_TEXT[b])}>
        {pct(p.probability)}%
      </span>

      <span className="h-1 w-full overflow-hidden rounded-full bg-elevated">
        <span
          className={cn("block h-full rounded-full", BAND_BG[b])}
          style={{ width: `${Math.max(2, p.probability * 100)}%`, transition: "width .5s cubic-bezier(.16,1,.3,1)" }}
        />
      </span>

      <span className="text-[11px] leading-4 text-faint">
        {p.positive ? "above" : "below"} threshold {p.threshold.toFixed(2)}
        {p.auc !== null && (
          <>
            <br />
            model AUC {p.auc.toFixed(2)}
            {p.support !== null && ` (n+=${p.support})`}
          </>
        )}
      </span>
    </button>
  );
}
