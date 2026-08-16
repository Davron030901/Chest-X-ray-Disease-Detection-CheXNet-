import { DISCLAIMER } from "@/lib/types";

export function Footer({
  frontendRepo,
  backendRepo,
  apiUrl,
  meanAuc,
  notebookUrl,
}: {
  frontendRepo: string;
  backendRepo: string;
  apiUrl: string;
  meanAuc: number | null;
  notebookUrl?: string;
}) {
  return (
    <footer className="border-t border-hairline bg-surface">
      <div className="mx-auto max-w-container px-4 py-10 md:px-6 lg:px-8">
        <div className="rounded-xl border border-sev-mod/35 bg-sev-mod/[0.08] px-4 py-3">
          <p className="max-w-[74ch] text-[13px] leading-5 text-muted">
            <span className="font-semibold text-ink">Medical disclaimer. </span>
            {DISCLAIMER}
          </p>
        </div>

        <div className="mt-8 grid gap-6 text-[13px] leading-5 text-muted sm:grid-cols-3">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Data</p>
            <p>
              NIH ChestX-ray14 &mdash; Wang et al., 2017. Sample subset, 5,606 frontal radiographs.
            </p>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Paper</p>
            <p>
              CheXNet &mdash; Rajpurkar et al., 2017.{" "}
              <a
                className="text-accent underline-offset-2 hover:underline"
                href="https://arxiv.org/abs/1711.05225"
                target="_blank"
                rel="noreferrer noopener"
              >
                arXiv:1711.05225
              </a>
              {meanAuc !== null && (
                <>
                  <br />
                  <span className="tnum font-mono text-[12px] text-faint">
                    this model mean AUC {meanAuc.toFixed(3)} vs paper 0.841
                  </span>
                </>
              )}
            </p>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Code</p>
            <ul className="space-y-1">
              {frontendRepo && (
                <li>
                  <a className="text-accent underline-offset-2 hover:underline" href={frontendRepo} target="_blank" rel="noreferrer noopener">
                    Frontend repository
                  </a>
                </li>
              )}
              {backendRepo && (
                <li>
                  <a className="text-accent underline-offset-2 hover:underline" href={backendRepo} target="_blank" rel="noreferrer noopener">
                    Backend repository
                  </a>
                </li>
              )}
              <li>
                <a className="text-accent underline-offset-2 hover:underline" href={`${apiUrl}/docs`} target="_blank" rel="noreferrer noopener">
                  API documentation
                </a>
              </li>
              {notebookUrl && (
                <li>
                  <a className="text-accent underline-offset-2 hover:underline" href={notebookUrl} target="_blank" rel="noreferrer noopener">
                    Training notebook
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <p className="mt-8 border-t border-hairline pt-6 text-[12px] text-faint">
          Not a medical device. Educational reproduction of a published research result.
        </p>
      </div>
    </footer>
  );
}
