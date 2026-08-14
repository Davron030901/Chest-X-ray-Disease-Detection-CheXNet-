"use client";

import { useCallback, useRef, useState } from "react";

export function CompareSlider({
  base,
  overlay,
  opacity,
}: {
  base: string;
  overlay: string;
  opacity: number;
}) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const move = useCallback((clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    setPos(Math.min(100, Math.max(0, ((clientX - box.left) / box.width) * 100)));
  }, []);

  return (
    <div
      ref={ref}
      className="relative h-full w-full select-none overflow-hidden"
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        move(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && move(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={base} alt="Chest X-ray, original" className="h-full w-full object-contain" />

      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={base} alt="" aria-hidden className="h-full w-full object-contain" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={overlay}
          alt="Grad-CAM heatmap overlay"
          className="absolute inset-0 h-full w-full object-contain"
          style={{ opacity }}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-y-0 w-px bg-accent"
        style={{ left: `${pos}%` }}
      />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Compare original and heatmap"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        aria-valuetext={`${Math.round(pos)} percent`}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 5));
          if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 5));
        }}
        className="absolute top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border-2 border-accent bg-surface text-[10px] text-accent"
        style={{ left: `${pos}%` }}
      >
        &#8646;
      </div>
    </div>
  );
}
