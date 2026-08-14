"use client";

import { cn } from "@/lib/cn";
import type { ServerState } from "@/hooks/useHealth";

const MAP: Record<ServerState, { dot: string; text: string; label: string }> = {
  checking: { dot: "bg-faint", text: "text-faint", label: "Checking API" },
  online: { dot: "bg-sev-low animate-pulse-dot", text: "text-muted", label: "API online" },
  waking: { dot: "bg-sev-mod animate-pulse-dot", text: "text-sev-mod", label: "Waking server" },
  offline: { dot: "bg-sev-crit", text: "text-sev-crit", label: "API offline" },
};

export function StatusPill({ state }: { state: ServerState }) {
  const s = MAP[state];
  return (
    <div
      className="flex items-center gap-2 rounded-full border border-hairline bg-surface px-2.5 py-1.5"
      title={s.label}
      aria-live="polite"
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", s.dot)} aria-hidden />
      <span className={cn("hidden text-[12px] font-medium sm:inline", s.text)}>{s.label}</span>
    </div>
  );
}
