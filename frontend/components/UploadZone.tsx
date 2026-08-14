"use client";

import { ImageUp, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

const SAMPLES = [
  { file: "sample-1.png", caption: "Sample 1" },
  { file: "sample-2.png", caption: "Sample 2" },
  { file: "sample-3.png", caption: "Sample 3" },
];

export function UploadZone({
  onFile,
  busy,
  error,
}: {
  onFile: (f: File) => void;
  busy: boolean;
  error: string | null;
}) {
  const [dragging, setDragging] = useState(false);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Paste-from-clipboard: radiologists and students both live in screenshot tools.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) onFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFile]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) onFile(f);
    },
    [onFile],
  );

  const loadSample = useCallback(
    async (name: string) => {
      setLoadingSample(name);
      setSampleError(null);
      try {
        const res = await fetch(`/samples/${name}`);
        // A missing file returns the 404 HTML page, not an image - catch that
        // instead of handing the backend a text/html blob.
        if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) {
          setSampleError(
            "Sample X-rays have not been added yet. Copy three test-split PNGs into public/samples/, or upload your own image.",
          );
          return;
        }
        const blob = await res.blob();
        onFile(new File([blob], name, { type: blob.type || "image/png" }));
      } catch {
        setSampleError("Could not load that sample. Upload your own image instead.");
      } finally {
        setLoadingSample(null);
      }
    },
    [onFile],
  );

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a chest X-ray image. Drag and drop, click, or paste from the clipboard."
        aria-disabled={busy}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "grid min-h-[200px] cursor-pointer place-items-center rounded-2xl border-2 border-dashed",
          "bg-inset px-6 py-10 text-center transition-all duration-150 md:min-h-[280px]",
          dragging
            ? "border-solid border-accent bg-accent/[0.08]"
            : "border-strong hover:border-accent-dim",
          busy && "pointer-events-none opacity-60",
          error && "border-sev-crit animate-shake",
        )}
      >
        <div>
          <span
            className={cn(
              "mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent transition-transform duration-150",
              dragging && "-translate-y-0.5",
            )}
          >
            <ImageUp className="h-6 w-6" aria-hidden />
          </span>
          <p className="text-[15px] font-medium text-ink">
            {dragging ? "Drop to analyse" : "Drop a chest X-ray here"}
          </p>
          <p className="mt-1 text-[12px] text-faint">
            PNG &middot; JPG &middot; WEBP &mdash; max 10 MB &middot; or press Ctrl/Cmd+V
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p role="alert" className="mt-2 text-[13px] text-sev-crit">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col items-center gap-3">
        <span className="text-[12px] text-faint">or try a sample</span>
        <div className="flex flex-wrap justify-center gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.file}
              type="button"
              disabled={busy}
              onClick={() => loadSample(s.file)}
              className="flex min-h-[44px] items-center gap-2 rounded-lg border border-strong px-3 py-2 text-[13px] text-muted transition-colors duration-150 hover:bg-elevated hover:text-ink disabled:opacity-50"
            >
              {loadingSample === s.file ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <span className="h-4 w-4 rounded bg-inset" aria-hidden />
              )}
              {s.caption}
            </button>
          ))}
        </div>
        {sampleError && (
          <p role="alert" className="max-w-[52ch] text-center text-[12px] text-sev-mod">
            {sampleError}
          </p>
        )}
      </div>
    </div>
  );
}
