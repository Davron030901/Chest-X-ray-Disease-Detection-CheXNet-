# Radiograph AI — frontend

Custom Next.js 14 UI for the CheXNet API. Hand-built: no Gradio, no Streamlit, no
auto-generated demo, no Hugging Face. Deployed on Vercel free tier.

> **Educational project only.** Not a medical device. Never use for real diagnosis.

## Run locally

```bash
cp .env.example .env.local     # point NEXT_PUBLIC_API_URL at your Render backend
npm install
npm run dev
```

## Before deploying

1. Copy three test-split X-rays into `public/samples/` as `sample-1.png` … `sample-3.png`.
2. Replace `FRONTEND_REPO` / `BACKEND_REPO` in `app/page.tsx` with your repo URLs.
3. Set `NEXT_PUBLIC_API_URL` in Vercel for **both** Production and Preview.
4. After deploying, add your Vercel domain to `ALLOWED_ORIGINS` on Render and redeploy the backend.

## Design

Tokens live in `app/globals.css` as `R G B` triplets and are mapped into Tailwind in
`tailwind.config.ts`, so `bg-surface/80` and friends work in both themes. The image well stays
dark in light mode on purpose — grayscale radiographs and jet heatmaps are unreadable on white.

Built-in states: empty, validating, cold-start, analysing, success, API error, invalid file, offline.
The cold-start card matters most: Render's free tier sleeps after ~15 minutes, and without it a
30–60 s wake looks like a crash.
