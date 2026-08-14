"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

// No localStorage (not available in every embedding). Initial value comes from the
// OS preference, then lives in React state for the session.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const prefersLight =
      typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches;
    const initial: Theme = prefersLight ? "light" : "dark";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  }, []);

  return { theme, toggle, mounted };
}
