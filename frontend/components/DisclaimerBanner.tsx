import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/cn";
import { DISCLAIMER } from "@/lib/types";

export function DisclaimerBanner({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3",
        "border-sev-mod/35 bg-sev-mod/[0.08]",
        className,
      )}
    >
      <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-sev-mod" />
      <p className={cn("text-muted", compact ? "text-[12px] leading-4" : "text-[13px] leading-5")}>
        <span className="font-semibold text-ink">Educational project &mdash; not a medical device. </span>
        {compact
          ? "Never use for real diagnosis."
          : DISCLAIMER.replace("Educational project only. This model is not a medical device, has not been clinically validated, and must ", "It has not been clinically validated and must ")}
      </p>
    </div>
  );
}
