"use client";

import { useCallback, useState } from "react";

import { predict } from "@/lib/api";
import type { ApiError, PredictResponse } from "@/lib/types";

export type Phase = "idle" | "validating" | "analysing" | "done" | "error";

const MAX_BYTES = 10 * 1024 * 1024;
const OK_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export function usePredict() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  const validate = (file: File): string | null => {
    if (!OK_TYPES.includes(file.type)) {
      return `That is a ${file.type || "unknown"} file. Upload a PNG, JPEG or WEBP chest X-ray.`;
    }
    if (file.size > MAX_BYTES) {
      return `That file is ${(file.size / 1e6).toFixed(1)} MB. The limit is 10 MB.`;
    }
    return null;
  };

  const run = useCallback(async (file: File) => {
    setPhase("validating");
    setError(null);
    setResult(null);
    setFileName(file.name);
    setLastFile(file);

    const invalid = validate(file);
    if (invalid) {
      setError({ code: "invalid_file", message: invalid });
      setPhase("error");
      return;
    }

    setPhase("analysing");
    const res = await predict(file, true, 3);
    if (res.ok) {
      setResult(res.data);
      setPhase("done");
    } else {
      setError(res.error);
      setPhase("error");
    }
  }, []);

  const retry = useCallback(() => {
    if (lastFile) void run(lastFile);
  }, [lastFile, run]);

  const reset = useCallback(() => {
    setPhase("idle");
    setResult(null);
    setError(null);
    setFileName(null);
    setLastFile(null);
  }, []);

  return { phase, result, error, fileName, run, retry, reset };
}
