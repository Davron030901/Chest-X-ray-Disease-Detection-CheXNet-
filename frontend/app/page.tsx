"use client";

import { useCallback, useEffect, useState } from "react";

import { ColdStartCard } from "@/components/ColdStartCard";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { ImageViewer } from "@/components/ImageViewer";
import { ModelCard } from "@/components/ModelCard";
import { PredictionsPanel } from "@/components/PredictionsPanel";
import { UploadZone } from "@/components/UploadZone";
import { useHealth } from "@/hooks/useHealth";
import { usePredict } from "@/hooks/usePredict";
import { API_URL, getMeta } from "@/lib/api";
import type { Meta } from "@/lib/types";

// Monorepo: frontend/ and backend/ live in the same repository.
// Override per-deployment with NEXT_PUBLIC_FRONTEND_REPO / NEXT_PUBLIC_BACKEND_REPO.
const REPO = "https://github.com/Davron030901/Chest-X-ray-Disease-Detection-CheXNet-";
const FRONTEND_REPO = process.env.NEXT_PUBLIC_FRONTEND_REPO || `${REPO}/tree/main/frontend`;
const BACKEND_REPO = process.env.NEXT_PUBLIC_BACKEND_REPO || `${REPO}/tree/main/backend`;

export default function Page() {
  const { state, elapsed } = useHealth();
  const { phase, result, error, run, retry, reset } = usePredict();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [camOpacity, setCamOpacity] = useState(45);

  useEffect(() => {
    if (state !== "online" || meta) return;
    void getMeta().then((r) => r.ok && setMeta(r.data));
  }, [state, meta]);

  useEffect(() => {
    if (result?.top_k?.length) setActive(result.top_k[0]);
  }, [result]);

  const handleFile = useCallback(
    (f: File) => {
      void run(f);
    },
    [run],
  );

  const busy = phase === "validating" || phase === "analysing";
  const showWorkspace = Boolean(result) || busy || (error && error.code !== "invalid_file");
  const validationError = error?.code === "invalid_file" ? error.message : null;

  return (
    <>
      <Header state={state} repoUrl={FRONTEND_REPO} />

      <main>
        <Hero />

        <section className="mx-auto max-w-container px-4 pb-4 md:px-6 lg:px-8">
          {state === "waking" && (
            <div className="mb-5">
              <ColdStartCard elapsed={elapsed} />
            </div>
          )}
          {state === "offline" && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-sev-crit/35 bg-sev-crit/[0.08] px-4 py-3 text-[13px] text-muted"
            >
              <span className="font-semibold text-ink">Can&rsquo;t reach the model server. </span>
              It sleeps after 15 minutes of inactivity on the free tier &mdash; wait a moment and
              retry, or check{" "}
              <a className="text-accent underline-offset-2 hover:underline" href={`${API_URL}/health`} target="_blank" rel="noreferrer noopener">
                the health endpoint
              </a>
              .
            </div>
          )}
        </section>

        <section className="mx-auto max-w-container px-4 pb-12 md:px-6 lg:px-8">
          {!showWorkspace ? (
            <div className="mx-auto max-w-[720px]">
              <UploadZone onFile={handleFile} busy={busy} error={validationError} />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[7fr_5fr] lg:gap-6">
              <div>
                {result ? (
                  <ImageViewer
                    preview={result.input_preview}
                    heatmaps={result.heatmaps}
                    classes={result.top_k}
                    active={active}
                    onActiveChange={setActive}
                    size={meta?.img_size ?? 224}
                    opacity={camOpacity}
                    onOpacityChange={setCamOpacity}
                  />
                ) : (
                  <div className="elev rounded-2xl bg-surface p-4">
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-inset">
                      <div className="skeleton absolute inset-0" />
                      {/* scanning sweep, disabled under prefers-reduced-motion via globals.css */}
                      <div className="absolute inset-x-0 h-px animate-sweep bg-accent/60" />
                    </div>
                    <p className="mt-3 text-center text-[12px] text-faint">Analysing radiograph…</p>
                  </div>
                )}
              </div>

              <div className="lg:sticky lg:top-[88px] lg:self-start">
                <PredictionsPanel
                  result={result}
                  loading={busy}
                  error={error}
                  onRetry={retry}
                  onReset={reset}
                  active={active}
                  onActiveChange={setActive}
                  camOpacity={camOpacity}
                />
              </div>
            </div>
          )}
        </section>

        <ModelCard meta={meta} />
      </main>

      <Footer
        frontendRepo={FRONTEND_REPO}
        backendRepo={BACKEND_REPO}
        apiUrl={API_URL}
        meanAuc={meta?.mean_auc ?? null}
        notebookUrl={`${REPO}/blob/main/notebook/chexnet_train.ipynb`}
      />
    </>
  );
}
