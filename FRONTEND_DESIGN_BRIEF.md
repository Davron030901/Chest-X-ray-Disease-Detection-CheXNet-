# FRONTEND DESIGN BRIEF — "Radiograph AI"
### Clinical Dark · Cyan Accent · Fully Responsive
> Paste this together with the frontend prompt. It is the visual contract — implement it exactly.

---

## 0. Design intent

The product is a **diagnostic-viewer-inspired** interface, not a landing page and not a demo widget. It should feel like a tool a radiology resident would be comfortable opening: calm, dense, precise, quiet. Every visual decision serves one goal — **make a grayscale X-ray and a jet-colormap heatmap look correct**, which is why the canvas is near-black.

Three words: **clinical, confident, honest.** The "honest" part is a design requirement — uncertainty and the disclaimer are first-class UI elements, not fine print.

---

## 1. Color system

### Dark theme (default)

| Token | Hex | Use |
|---|---|---|
| `--bg-base` | `#0A0E14` | Page canvas |
| `--bg-surface` | `#111823` | Cards, panels |
| `--bg-elevated` | `#18212E` | Hover, popovers, active tabs |
| `--bg-inset` | `#080B10` | Image viewer well, code blocks |
| `--border` | `#1F2A38` | Default hairlines (1px) |
| `--border-strong` | `#2E3F54` | Focused / selected containers |
| `--text-primary` | `#E9EFF6` | Headings, values |
| `--text-secondary` | `#96A8BC` | Body, labels |
| `--text-muted` | `#5D6E82` | Captions, meta |
| `--accent` | `#22D3EE` | Primary accent (cyan-400) |
| `--accent-strong` | `#06B6D4` | Buttons, active states |
| `--accent-dim` | `#0E7490` | Pressed, borders on accent surfaces |
| `--accent-soft` | `rgba(34,211,238,0.10)` | Accent-tinted fills |
| `--accent-glow` | `rgba(34,211,238,0.28)` | Focus ring, subtle bloom |

### Severity scale (probability bands) — the only other colors allowed

| Band | Range | Token | Hex | Label |
|---|---|---|---|---|
| Low | 0.00 – 0.29 | `--sev-low` | `#34D399` emerald-400 | "Low" |
| Moderate | 0.30 – 0.59 | `--sev-mod` | `#FBBF24` amber-400 | "Moderate" |
| Elevated | 0.60 – 0.79 | `--sev-high` | `#FB923C` orange-400 | "Elevated" |
| High | 0.80 – 1.00 | `--sev-crit` | `#F43F5E` rose-500 | "High" |

Rules:
- Severity color appears **only** on probability bars, the numeric value, and the badge dot. Never on backgrounds, never on buttons.
- **Never use red as an alarm color for the whole card** — this is not a diagnosis. Colors encode *model confidence*, and the tooltip must say so: *"Model confidence, not clinical severity."*
- Bars use a subtle left-to-right gradient from the band color at 70% opacity to 100% opacity.

### Light theme (toggle)

| Token | Hex |
|---|---|
| `--bg-base` | `#F5F8FB` |
| `--bg-surface` | `#FFFFFF` |
| `--bg-elevated` | `#EDF2F8` |
| `--bg-inset` | `#0A0E14` *(image well stays dark in both themes — X-rays need it)* |
| `--border` | `#DEE7F0` |
| `--text-primary` | `#0D1723` |
| `--text-secondary` | `#4A5D72` |
| `--text-muted` | `#7C8FA3` |
| `--accent` / `--accent-strong` | `#0891B2` / `#0E7490` |

Severity hues darken one step in light mode (`#059669`, `#D97706`, `#EA580C`, `#E11D48`) to hold AA contrast on white.

Implement as CSS custom properties on `:root` / `[data-theme="light"]`, mapped into `tailwind.config.ts` so classes read `bg-surface`, `text-secondary`, `border-default`. Default to dark; persist the choice in React state (no `localStorage` if the environment forbids it — read `prefers-color-scheme` for the initial value).

---

## 2. Typography

- **UI:** `Inter` (or `Geist Sans`) via `next/font`, `-0.011em` tracking on headings.
- **Numerics:** `JetBrains Mono` (or `Geist Mono`) for every probability, AUC, and millisecond value. **`font-variant-numeric: tabular-nums`** on all numbers so bars and percentages don't jitter during the count-up animation.

| Role | Size / Line / Weight |
|---|---|
| Display (hero) | 40px / 46px / 600 — `clamp(28px, 5vw, 40px)` |
| H2 section | 24px / 32px / 600 |
| H3 card title | 18px / 26px / 600 |
| Body | 15px / 24px / 400 |
| Label / UI | 13px / 18px / 500 |
| Caption / meta | 12px / 16px / 400, `--text-muted` |
| Overline | 11px / 500 / `0.08em` uppercase, `--accent` |
| Probability value | 20px mono / 600 |

Max measure for prose: **68ch**.

---

## 3. Layout & spacing

- 8px spacing scale: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`.
- Container: `max-width: 1280px`, side padding `16px` mobile / `24px` tablet / `32px` desktop.
- Radii: `8px` inputs · `12px` cards · `16px` panels · `999px` chips & bars.
- Elevation (dark theme uses borders + tint, not heavy shadows):
  - Level 1: `border: 1px solid var(--border)`
  - Level 2: `+ box-shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.6)`
  - Accent focus: `box-shadow: 0 0 0 3px var(--accent-glow)`
- Background texture: one very subtle radial gradient at the top of the page — `radial-gradient(900px 420px at 50% -10%, rgba(34,211,238,0.07), transparent 70%)`. Nothing else. No mesh gradients, no noise, no glassmorphism.

### Page structure (top → bottom)

```
┌─ Sticky header (h 64px, blurred bg-surface/80, 1px bottom border) ─┐
│  ◉ Radiograph AI      [● API online]        [☀/☾]  [GitHub]        │
├────────────────────────────────────────────────────────────────────┤
│  HERO                                                              │
│  Overline: CHEXNET REPRODUCTION · DENSENET-121                     │
│  H1: Chest X-ray screening with explainable AI                     │
│  Sub: 14 thoracic pathologies · Grad-CAM localisation · <1s        │
│  [ 14 pathology chips, wrapping ]                                  │
│  ⚠ Disclaimer banner (amber-tinted, bordered, always visible)      │
├────────────────────────────────────────────────────────────────────┤
│  WORKSPACE — 2 columns ≥1024px (7fr / 5fr), stacked below          │
│  ┌── Left: VIEWER ────────────┐ ┌── Right: PREDICTIONS ─────────┐  │
│  │ [Original|Heatmap|Overlay] │ │ TOP FINDINGS                  │  │
│  │ ┌──────────────────────┐   │ │ ┌───────┐┌───────┐┌───────┐   │  │
│  │ │                      │   │ │ │ card1 ││ card2 ││ card3 │   │  │
│  │ │   image well (1:1)   │   │ │ └───────┘└───────┘└───────┘   │  │
│  │ │                      │   │ │ ALL 14 PATHOLOGIES            │  │
│  │ └──────────────────────┘   │ │ Cardiomegaly ███████░░  81.2% │  │
│  │ CAM opacity ●────────  40% │ │ Effusion     ████░░░░░  44.0% │  │
│  │ Class: [Cardiomegaly ▾]    │ │ …14 rows, sorted desc         │  │
│  │ ⤢ fullscreen  ⇄ compare    │ │ [Copy JSON] [Download PNG]    │  │
│  └────────────────────────────┘ └───────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────┤
│  HOW IT WORKS — 3 steps · MODEL CARD — AUC table, dataset, limits  │
├────────────────────────────────────────────────────────────────────┤
│  Footer: full disclaimer · citations · repos · author              │
└────────────────────────────────────────────────────────────────────┘
```

Before an upload exists, the workspace collapses into a single centred **upload zone** (max-width 720px), and the predictions panel is replaced by a muted empty state listing the 14 classes.

---

## 4. Component specs

### 4.1 Upload dropzone
- Idle: `bg-inset`, `2px dashed var(--border-strong)`, radius 16, min-height 280px, centred upload icon in a 56px `--accent-soft` circle.
- Hover: border → `--accent-dim`, icon lifts 2px.
- Drag-over: border → solid `--accent`, background → `--accent-soft`, faint inner glow, label swaps to *"Drop to analyse"*.
- Supports: click, drag-drop, `Ctrl/⌘+V` paste, and `Enter`/`Space` when focused.
- Copy: **"Drop a chest X-ray here"** / `PNG · JPG · WEBP — max 10 MB` / `or` divider / **"Try a sample"** → three 64×64 thumbnail buttons with pathology captions.
- Invalid file: shake once (respect `prefers-reduced-motion`), border → `--sev-crit`, inline message below.

### 4.2 Image well
- Always `--bg-inset` (near-black) in **both** themes. Fixed 1:1 aspect ratio, `object-contain`, 12px inner padding.
- Segmented control above it (3 options, pill-shaped, sliding `--accent-soft` indicator with a `--accent` 1px border).
- **Overlay mode:** heatmap `<img>` absolutely positioned over the original with `mix-blend-mode: screen` and opacity bound to the slider (default 45%).
- **Compare mode:** vertical divider with a circular grab handle; drag reveals original vs. overlay via `clip-path: inset()`. Keyboard: ←/→ move the divider 5%.
- Corner badges: top-left `224 × 224` in mono `--text-muted`; top-right the class currently visualised.
- Fullscreen: click-to-expand into a dark backdrop modal, `Esc` closes.

### 4.3 Top-finding cards (3 across, stack on mobile)
```
┌─────────────────────────────┐
│ ● Cardiomegaly       #1     │   ← severity dot + rank
│                             │
│  81.2%                      │   ← 28px mono, severity color
│  ████████████████░░░░       │   ← 4px bar
│  above threshold 0.42       │   ← 11px muted
│  model AUC 0.87 ⓘ           │   ← trust signal
└─────────────────────────────┘
```
Selected card gets `--border-strong` + `--accent-soft` tint and drives which Grad-CAM the viewer shows. Cards are buttons — full keyboard support.

### 4.4 Prediction row (×14)
`[dot] Label ......................... [bar 140px] [ 81.2% ] [badge]`
- Row height 44px, 1px bottom hairline, `--bg-elevated` on hover.
- Bar: 6px tall, radius 999, track `--bg-elevated`, fill severity gradient, animates `scaleX 0 → p` over 500ms `cubic-bezier(.16,1,.3,1)` with a 25ms stagger per row.
- Percentage: mono, tabular, counts up in sync.
- Badge: `POSITIVE` (severity-tinted, 10px, uppercase, `0.06em`) only when `p ≥ threshold`; otherwise nothing — do not clutter 14 rows with "negative".
- Tooltip on the label: *"Test AUC 0.87 · 108 positive cases in the test set. Model confidence, not clinical severity."* Classes with support < 20 get a muted ⚠ and *"low support — treat with caution"*.

### 4.5 Backend status pill (header)
| State | Dot | Text |
|---|---|---|
| Connected | `--sev-low`, soft pulse | `API online` |
| Waking | `--sev-mod`, spinner ring | `Waking server…` |
| Offline | `--sev-crit`, static | `API offline` |

### 4.6 Cold-start overlay
Because Render's free tier sleeps after ~15 minutes, the **first** request can take 30–60 s. Do not show a bare spinner — show a card:
> **Waking the model server**
> This project runs on free infrastructure, so the first request after a quiet period takes up to a minute. Subsequent predictions take under a second.
> `[━━━━━━━━━░░░░░░]  24s`

Indeterminate progress that eases toward 90% and completes on response. This single component is the difference between "broken" and "professional".

### 4.7 Disclaimer banner
Amber-tinted (`rgba(251,191,36,0.08)` fill, `rgba(251,191,36,0.35)` border, radius 12), ⚠ icon in `--sev-mod`, bold lead-in **"Educational project — not a medical device."** Appears in the hero **and** pinned above the predictions list. Never collapsible into invisibility.

### 4.8 Buttons
- Primary: `--accent-strong` bg, `#04191D` text, 40px h, radius 8, 500 weight; hover lightens 6%, active scales 0.98.
- Secondary: transparent, `1px --border-strong`, `--text-primary`; hover `--bg-elevated`.
- Ghost: text only, `--text-secondary` → `--text-primary`.
- All: `:focus-visible` → 3px `--accent-glow` ring, 2px offset.

---

## 5. Responsive behaviour

| Breakpoint | Layout |
|---|---|
| **< 640px** | Single column. Sticky header collapses status pill to a bare dot. Hero display 28px. Dropzone min-height 200px. Top-finding cards stack full-width. Prediction bars shrink to 88px; percentage stays. Segmented control full-width. Compare mode disabled → tap-to-toggle instead. Touch targets ≥ 44px. |
| **640–1023px** | Viewer full-width on top, predictions below. Top-finding cards 3-across. Container padding 24px. |
| **1024–1279px** | Two columns `7fr / 5fr`, gap 24px. Predictions panel sticky at `top: 88px`. |
| **≥ 1280px** | Container capped at 1280px, gap 32px. Hero display 40px. |
| **≥ 1600px** | Container stays 1280px centred — do not stretch; a wider image well doesn't help a 224×224 render. |

Test at 360 · 390 · 768 · 1024 · 1440 · 1920.

---

## 6. Motion

- Durations: 120ms micro (hover) · 200ms standard (tabs, toggles) · 500ms expressive (bars, results reveal).
- Easing: `cubic-bezier(.16,1,.3,1)` for entrances, `ease-out` for exits. No bounce, no spring overshoot — this is a clinical tool.
- Results panel: fade + 8px rise, 40ms stagger between rows.
- Heatmap tab switch: 200ms crossfade, never a slide.
- Status dot: 2s pulse at 0.4→1 opacity when connected.
- **`@media (prefers-reduced-motion: reduce)` → all transitions ≤ 1ms, bars render at final width, no pulse, no shake.**

---

## 7. Accessibility (target Lighthouse ≥ 95)

- All text meets **WCAG AA** (4.5:1 body, 3:1 large). `--text-muted` on `--bg-base` is 4.6:1 — verify after any hue tweak.
- Never encode meaning by color alone: severity always carries a text label or numeric value.
- Semantic landmarks: `<header> <main> <section aria-labelledby> <footer>`.
- Dropzone: `role="button"`, `tabIndex={0}`, `aria-label`, keyboard activation, visible focus ring.
- Results container: `aria-live="polite"` announcing *"Analysis complete. Top finding: Cardiomegaly, 81 percent."*
- Segmented control: `role="tablist"` / `role="tab"` with `aria-selected` and arrow-key navigation.
- Sliders: native `<input type="range">` with `aria-valuetext="45 percent opacity"`.
- Images: meaningful `alt` — *"Chest X-ray with Grad-CAM heatmap highlighting the cardiac silhouette"*.
- Modal: focus trap, `Esc` to close, focus returned to the trigger.

---

## 8. States to build (do not skip these — they are most of the perceived quality)

1. **Empty** — no upload yet: centred dropzone, muted 14-class checklist on the right.
2. **Validating** — file read, thumbnail appears, brief shimmer.
3. **Cold start** — the overlay from §4.6.
4. **Analysing** — skeleton rows (14 shimmer bars) in the predictions panel, image well shows the uploaded X-ray with a scanning-line sweep (2s loop, reduced-motion: static).
5. **Success** — staggered reveal.
6. **API error** — inline card with the server's `message`, a `Retry` button, and a `Copy diagnostics` link.
7. **Invalid file** — inline red message under the dropzone; do not use a toast for validation.
8. **Offline** — banner: *"Can't reach the model server. It may be sleeping — retry in a moment."*

---

## 9. Copy guidelines

- Say **"finding"** and **"probability"**, never "diagnosis", "detected", or "confirmed".
- Row phrasing: *"Cardiomegaly — 81.2% model probability"*, never *"Patient has cardiomegaly"*.
- Use "model", not "AI doctor". Use "screening support", not "diagnosis".
- Empty state: *"Upload a frontal chest X-ray to see 14 pathology probabilities and a Grad-CAM heatmap."*
- Footer must contain: full disclaimer · *NIH ChestX-ray14 (Wang et al., 2017)* · *CheXNet (Rajpurkar et al., 2017), arXiv:1711.05225* · reported mean test AUC · "Not a medical device".

---

## 10. Do-not list

❌ Gradio / Streamlit / any auto-generated UI · ❌ Hugging Face of any kind · ❌ purple-to-pink SaaS gradients · ❌ glassmorphism · ❌ emoji in the product UI (⚠ in the disclaimer is the sole exception) · ❌ stock photos of doctors · ❌ fake testimonials or "trusted by" logos · ❌ a light image well · ❌ raw spinners where a skeleton belongs · ❌ any wording implying clinical validity.
