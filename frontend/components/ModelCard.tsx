"use client";

import type { Meta } from "@/lib/types";
import { pretty } from "@/lib/types";

export function ModelCard({ meta }: { meta: Meta | null }) {
  return (
    <section className="mx-auto max-w-container px-4 py-12 md:px-6 lg:px-8" id="model-card">
      <h2 className="text-[24px] font-semibold leading-8 tracking-[-0.011em] text-ink">Model card</h2>
      <p className="mt-2 max-w-[68ch] text-[15px] leading-6 text-muted">
        DenseNet-121 pretrained on ImageNet, fine-tuned on the NIH ChestX-ray14 <em>sample</em> with a
        14-output sigmoid head. Evaluated on a patient-disjoint test split with per-disease AUC-ROC.
        Accuracy is deliberately not reported: at ~5% prevalence, predicting &ldquo;negative&rdquo;
        everywhere scores ~95% accuracy and is clinically worthless.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="elev overflow-x-auto rounded-2xl bg-surface p-4">
          <table className="w-full min-w-[420px] text-left text-[13px]">
            <caption className="sr-only">Per-disease test AUC compared with the CheXNet paper</caption>
            <thead>
              <tr className="border-b border-hairline text-[11px] uppercase tracking-[0.06em] text-faint">
                <th scope="col" className="py-2 font-medium">Pathology</th>
                <th scope="col" className="py-2 text-right font-medium">Test n+</th>
                <th scope="col" className="py-2 text-right font-medium">This model</th>
                <th scope="col" className="py-2 text-right font-medium">Paper</th>
              </tr>
            </thead>
            <tbody>
              {(meta?.per_class ?? []).map((c) => (
                <tr key={c.label} className="border-b border-hairline/60 last:border-0">
                  <td className="py-2 text-ink">{pretty(c.label)}</td>
                  <td className="tnum py-2 text-right font-mono text-faint">{c.support ?? "-"}</td>
                  <td className="tnum py-2 text-right font-mono text-ink">
                    {c.auc !== null && c.auc !== undefined ? c.auc.toFixed(3) : "-"}
                  </td>
                  <td className="tnum py-2 text-right font-mono text-faint">
                    {c.paper_auc !== null && c.paper_auc !== undefined ? c.paper_auc.toFixed(3) : "-"}
                  </td>
                </tr>
              ))}
              {meta && (
                <tr className="font-semibold">
                  <td className="py-2 text-ink">Mean</td>
                  <td className="py-2" />
                  <td className="tnum py-2 text-right font-mono text-accent">
                    {meta.mean_auc !== null ? meta.mean_auc.toFixed(3) : "-"}
                  </td>
                  <td className="tnum py-2 text-right font-mono text-faint">
                    {meta.paper_mean_auc.toFixed(3)}
                  </td>
                </tr>
              )}
              {!meta && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-faint">
                    Metrics load from the API once the server is awake.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="elev space-y-4 rounded-2xl bg-surface p-4 text-[13px] leading-5 text-muted">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Data</p>
            <p className="mt-1">
              {meta?.dataset ?? "NIH ChestX-ray14 sample (5,606 images)"}. Split 70/10/20 by{" "}
              <strong className="text-ink">Patient ID</strong>, never by image &mdash; the same patient
              contributes many near-duplicate follow-up films, so an image-level split would let the
              model memorise the patient and inflate every score.
            </p>
            {meta?.train_images && (
              <p className="tnum mt-1 font-mono text-[12px] text-faint">
                train {meta.train_images} &middot; val {meta.val_images} &middot; test {meta.test_images}
                {meta.test_patients ? ` (${meta.test_patients} patients)` : ""}
              </p>
            )}
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Limitations</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>Trained on ~4% of the data the paper used, so AUCs sit well below published values.</li>
              <li>Rare classes (Hernia, Pneumonia, Fibrosis) have single-digit test positives; their AUC is noise.</li>
              <li>ChestX-ray14 labels were NLP-mined from reports and are only ~90% accurate.</li>
              <li>Frontal views only. No lateral, no clinical context, no patient history.</li>
              <li>Grad-CAM shows correlation, not causation &mdash; it can key on artefacts and markers.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
