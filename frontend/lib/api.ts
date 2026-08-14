import type { Health, Meta, PredictResponse, Result } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

// Render's free tier sleeps after ~15 min. A cold start takes 30-60 s, so the
// prediction timeout has to be generous or the app looks broken when it is merely asleep.
const TIMEOUT_PREDICT_MS = 90_000;
const TIMEOUT_QUICK_MS = 8_000;

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = TIMEOUT_QUICK_MS,
): Promise<Result<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }

    if (!res.ok) {
      const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
      return {
        ok: false,
        error: {
          code: err?.code ?? `http_${res.status}`,
          message: err?.message ?? `Server returned ${res.status}. ${text.slice(0, 160)}`,
        },
      };
    }
    return { ok: true, data: body as T };
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === "AbortError";
    return {
      ok: false,
      error: aborted
        ? { code: "timeout", message: "The server did not respond in time. It may still be waking up." }
        : {
            code: "network",
            message:
              "Could not reach the model server. It sleeps after 15 minutes of inactivity - " +
              "give it a moment and retry.",
          },
    };
  } finally {
    clearTimeout(timer);
  }
}

export const getHealth = (timeoutMs = 3_000) => request<Health>("/health", {}, timeoutMs);

export const getMeta = () => request<Meta>("/meta", {}, TIMEOUT_QUICK_MS);

export async function predict(file: File, cam = true, topK = 3): Promise<Result<PredictResponse>> {
  const form = new FormData();
  form.append("file", file);
  const path = `/predict?cam=${cam}&top_k=${topK}`;

  const first = await request<PredictResponse>(path, { method: "POST", body: form }, TIMEOUT_PREDICT_MS);
  if (first.ok) return first;

  // Retry once, but only for transient conditions - never for a rejected file.
  if (["network", "timeout", "model_not_loaded", "http_502", "http_503"].includes(first.error.code)) {
    await new Promise((r) => setTimeout(r, 2_000));
    const retryForm = new FormData();
    retryForm.append("file", file);
    return request<PredictResponse>(path, { method: "POST", body: retryForm }, TIMEOUT_PREDICT_MS);
  }
  return first;
}
