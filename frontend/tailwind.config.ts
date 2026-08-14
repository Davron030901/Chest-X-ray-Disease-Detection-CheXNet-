import type { Config } from "tailwindcss";

// Colors are CSS custom properties holding space-separated RGB channels, so Tailwind's
// opacity modifiers (bg-surface/80) keep working across both themes.
const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    // lib/severity.ts holds the band -> class lookup maps. Leaving it out silently
    // purges any severity class not also hard-coded in a component.
    "./lib/**/*.{ts,tsx}",
  ],
  // The severity classes are produced by a runtime lookup, which is exactly the
  // pattern Tailwind's static scanner cannot follow. Pin them so a refactor that
  // moves the maps around cannot make a probability band render colourless again.
  safelist: [
    "bg-sev-low", "bg-sev-mod", "bg-sev-high", "bg-sev-crit",
    "text-sev-low", "text-sev-mod", "text-sev-high", "text-sev-crit",
  ],
  theme: {
    extend: {
      colors: {
        base: rgb("--bg-base"),
        surface: rgb("--bg-surface"),
        elevated: rgb("--bg-elevated"),
        inset: rgb("--bg-inset"),
        hairline: rgb("--border"),
        strong: rgb("--border-strong"),
        ink: rgb("--text-primary"),
        muted: rgb("--text-secondary"),
        faint: rgb("--text-muted"),
        accent: rgb("--accent"),
        "accent-strong": rgb("--accent-strong"),
        "accent-dim": rgb("--accent-dim"),
        "accent-ink": rgb("--accent-ink"),
        "sev-low": rgb("--sev-low"),
        "sev-mod": rgb("--sev-mod"),
        "sev-high": rgb("--sev-high"),
        "sev-crit": rgb("--sev-crit"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: { xl: "12px", "2xl": "16px" },
      maxWidth: { container: "1280px" },
      transitionTimingFunction: { entrance: "cubic-bezier(.16,1,.3,1)" },
      keyframes: {
        rise: { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "none" } },
        pulseDot: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.4" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        sweep: { "0%": { top: "0%" }, "100%": { top: "100%" } },
        shake: { "0%,100%": { transform: "translateX(0)" }, "25%": { transform: "translateX(-5px)" }, "75%": { transform: "translateX(5px)" } },
      },
      animation: {
        rise: "rise .5s cubic-bezier(.16,1,.3,1) both",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
        sweep: "sweep 2s ease-in-out infinite alternate",
        shake: "shake .3s ease-in-out",
      },
    },
  },
  plugins: [],
};
export default config;
