"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getHealth } from "@/lib/api";

export type ServerState = "checking" | "online" | "waking" | "offline";

/**
 * Polls /health. The point is not monitoring - it is warming Render's free dyno
 * before the user uploads anything, and telling them honestly when it is asleep.
 */
export function useHealth() {
  const [state, setState] = useState<ServerState>("checking");
  const [elapsed, setElapsed] = useState(0);
  const wakeStart = useRef<number | null>(null);

  const ping = useCallback(async (): Promise<boolean> => {
    const res = await getHealth(3_000);
    if (res.ok && res.data.model_loaded) {
      setState("online");
      wakeStart.current = null;
      setElapsed(0);
      return true;
    }
    if (res.ok && !res.data.model_loaded) {
      setState("offline");
      return false;
    }
    setState((prev) => (prev === "online" ? "waking" : "waking"));
    if (wakeStart.current === null) wakeStart.current = Date.now();
    return false;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const loop = async () => {
      if (cancelled) return;
      const ok = await ping();
      attempts += 1;
      if (cancelled) return;
      if (!ok && attempts >= 25) {
        setState("offline");
        return;
      }
      // Poll fast while waking (to catch the moment it comes up), slowly once online.
      setTimeout(loop, ok ? 60_000 : 4_000);
    };
    void loop();
    return () => {
      cancelled = true;
    };
  }, [ping]);

  useEffect(() => {
    if (state !== "waking") return;
    const t = setInterval(() => {
      if (wakeStart.current) setElapsed(Math.round((Date.now() - wakeStart.current) / 1000));
    }, 1_000);
    return () => clearInterval(t);
  }, [state]);

  return { state, elapsed, ping };
}
