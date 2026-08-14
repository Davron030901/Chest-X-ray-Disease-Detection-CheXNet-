"use client";

import { Server } from "lucide-react";

export function ColdStartCard({ elapsed }: { elapsed: number }) {
  // Eases toward 90% over ~60 s, then completes when the server actually answers.
  const progress = Math.min(90, 100 * (1 - Math.exp(-elapsed / 22)));

  return (
    <div className="elev rounded-2xl bg-surface p-5" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sev-mod/10 text-sev-mod">
          <Server className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">Waking the model server</p>
          <p className="mt-1 max-w-[58ch] text-[13px] leading-5 text-muted">
            This project runs on free infrastructure, so the first request after a quiet period takes
            up to a minute. Every prediction after that is under a second.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
              <div
                className="h-full rounded-full bg-sev-mod transition-[width] duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="tnum shrink-0 font-mono text-[12px] text-faint">{elapsed}s</span>
          </div>
        </div>
      </div>
    </div>
  );
}
