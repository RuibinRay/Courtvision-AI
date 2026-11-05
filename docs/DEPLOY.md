# Deployment

## Frontend → GitHub Pages
1. Push the repository; in *Settings → Pages* choose "GitHub Actions".
2. `.github/workflows/pages.yml` publishes the repository root (everything the browser needs is static: `index.html`, `css/`, `js/`, `assets/`, `data/`).
3. The import map pins CDN versions of Three.js, GSAP, ECharts and D3; no build step.
4. Optional: set `window.COURTVISION_CONFIG = { BACKEND_URL: 'https://api.example.com' }` in `index.html` to connect a hosted backend.

## Scheduled data refresh
`.github/workflows/refresh-data.yml` runs the pipeline and retrains, then commits `data/`. It is manual (workflow_dispatch) by default; uncomment the cron line for a nightly schedule. NBA Stats sometimes blocks cloud IP ranges; if the job fails, run the pipeline locally and push, or point the job at a self-hosted runner. The site keeps working from the last good snapshot either way (the date is always visible).

## Backend
* **Docker**: `docker build -f backend/Dockerfile -t courtvision-api . && docker run -p 8000:8000 --env-file backend/.env courtvision-api`
* **Render / Fly / Railway**: Python 3.11, start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT` with working directory `backend/`.
* Environment variables: see `backend/.env.example`. Set `COURTVISION_ALLOWED_ORIGINS` to your Pages origin. Keys never ship to the browser.
* Database: `backend/db/schema.sql` provides the relational layer for a persistent deployment (PostgreSQL; SQLite-compatible types).

## Performance notes
Images are WebP; logos/headshots lazy-load from CDN; the Three.js scene drops particle count and pixel ratio on low-power devices, pauses when off-screen and is disposed on navigation; `prefers-reduced-motion` (or the `reduced-motion` body class) disables pinning, scrubbing and particles.
