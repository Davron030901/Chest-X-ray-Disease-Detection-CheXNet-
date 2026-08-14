"use client";

import { Maximize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CompareSlider } from "@/components/CompareSlider";
import { cn } from "@/lib/cn";
import { pretty } from "@/lib/types";

type Mode = "original" | "heatmap" | "overlay" | "compare";
const MODES: { id: Mode; label: string }[] = [
  { id: "original", label: "Original" },
  { id: "heatmap", label: "Heatmap" },
  { id: "overlay", label: "Overlay" },
  { id: "compare", label: "Compare" },
];

export function ImageViewer({
  preview,
  heatmaps,
  classes,
  active,
  onActiveChange,
  size,
  opacity,
  onOpacityChange,
}: {
  preview: string;
  heatmaps: Record<string, string>;
  classes: string[];
  active: string | null;
  onActiveChange: (c: string) => void;
  size: number;
  opacity: number;
  onOpacityChange: (v: number) => void;
}) {
  const [mode, setMode] = useState<Mode>("overlay");
  const [full, setFull] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  const heat = active ? heatmaps[active] : undefined;
  const hasHeat = Boolean(heat);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const well = (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-inset p-3">
      {mode === "compare" && hasHeat ? (
        <CompareSlider base={preview} overlay={heat!} opacity={opacity / 100} />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={`Chest X-ray, ${size}x${size} center crop as seen by the model`}
            className={cn("h-full w-full object-contain", mode === "heatmap" && "opacity-0")}
          />
          {hasHeat && mode !== "original" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heat}
              alt={`Grad-CAM heatmap for ${active ? pretty(active) : ""}, highlighting the region that drove the prediction`}
              className="absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] object-contain"
              style={{ opacity: mode === "heatmap" ? 1 : opacity / 100 }}
            />
          )}
        </>
      )}

      <span className="tnum pointer-events-none absolute left-4 top-4 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-white/70">
        {size} &times; {size}
      </span>
      {active && mode !== "original" && (
        <span className="pointer-events-none absolute right-4 top-4 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white/80">
          {pretty(active)}
        </span>
      )}
    </div>
  );

  return (
    <div className="elev rounded-2xl bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div
          ref={tabsRef}
          role="tablist"
          aria-label="Image view"
          className="flex w-full gap-1 rounded-full border border-hairline bg-inset p-1 sm:w-auto"
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            const i = MODES.findIndex((m) => m.id === mode);
            const next = e.key === "ArrowRight" ? (i + 1) % MODES.length : (i - 1 + MODES.length) % MODES.length;
            setMode(MODES[next].id);
          }}
        >
          {MODES.map((m) => {
            const disabled = m.id !== "original" && !hasHeat;
            return (
              <button
                key={m.id}
                role="tab"
                aria-selected={mode === m.id}
                disabled={disabled}
                onClick={() => setMode(m.id)}
                className={cn(
                  "flex-1 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors duration-200 sm:flex-none",
                  mode === m.id
                    ? "border border-accent/40 bg-accent/10 text-accent"
                    : "text-muted hover:text-ink",
                  disabled && "cursor-not-allowed opacity-40",
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setFull(true)}
          aria-label="View fullscreen"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {well}

      <div className="mt-4 space-y-3">
        <label className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-[12px] text-faint">CAM opacity</span>
          <input
            type="range"
            min={0}
            max={100}
            value={opacity}
            disabled={!hasHeat}
            onChange={(e) => onOpacityChange(Number(e.target.value))}
            aria-label="Heatmap opacity"
            aria-valuetext={`${opacity} percent opacity`}
            className="flex-1"
          />
          <span className="tnum w-10 shrink-0 text-right font-mono text-[12px] text-muted">{opacity}%</span>
        </label>

        {classes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-faint">Heatmap for</span>
            {classes.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onActiveChange(c)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[12px] transition-colors duration-150",
                  active === c
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-hairline text-muted hover:text-ink",
                )}
              >
                {pretty(c)}
              </button>
            ))}
          </div>
        )}
      </div>

      {full && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fullscreen X-ray view"
          className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4"
          onClick={() => setFull(false)}
        >
          <button
            type="button"
            aria-label="Close fullscreen"
            onClick={() => setFull(false)}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-lg bg-white/10 text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative max-h-[86vh] w-full max-w-[86vh]" onClick={(e) => e.stopPropagation()}>
            {well}
          </div>
        </div>
      )}
    </div>
  );
}
