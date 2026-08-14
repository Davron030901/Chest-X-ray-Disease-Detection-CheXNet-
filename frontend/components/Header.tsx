"use client";

import { Activity, Github } from "lucide-react";

import { StatusPill } from "@/components/StatusPill";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { ServerState } from "@/hooks/useHealth";

export function Header({ state, repoUrl }: { state: ServerState; repoUrl: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-container items-center justify-between gap-3 px-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent">
            <Activity className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-ink">Radiograph AI</span>
        </div>

        <div className="flex items-center gap-2">
          <StatusPill state={state} />
          <ThemeToggle />
          {repoUrl && (
            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Source code on GitHub"
              className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-surface text-muted transition-colors duration-150 hover:bg-elevated hover:text-ink"
            >
              <Github className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
