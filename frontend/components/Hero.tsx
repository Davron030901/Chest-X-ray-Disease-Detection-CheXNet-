import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { CLASSES, pretty } from "@/lib/types";

export function Hero() {
  return (
    <section className="mx-auto max-w-container px-4 pb-8 pt-10 md:px-6 md:pt-14 lg:px-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-accent">
        CheXNet reproduction &middot; DenseNet-121
      </p>

      <h1 className="mt-3 max-w-[18ch] text-[clamp(28px,5vw,40px)] font-semibold leading-[1.15] tracking-[-0.011em] text-ink">
        Chest X-ray screening with explainable AI
      </h1>

      <p className="mt-3 max-w-[62ch] text-[15px] leading-6 text-muted">
        Upload a frontal chest radiograph to see the probability of 14 thoracic findings and a
        Grad-CAM heatmap showing which region drove each one.
      </p>

      <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Detected pathologies">
        {CLASSES.map((c) => (
          <li
            key={c}
            className="rounded-full border border-hairline bg-surface px-2.5 py-1 text-[12px] text-muted"
          >
            {pretty(c)}
          </li>
        ))}
      </ul>

      <DisclaimerBanner className="mt-6 max-w-[74ch]" />
    </section>
  );
}
