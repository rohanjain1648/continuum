# Continuum Deployment Guide — Render

One Render Web Service hosts the whole app: FastAPI serves the REST API, the
`/ws` WebSocket, *and* the built React frontend from the same origin
(`main.py`'s SPA fallback already does this). There's no separate frontend
deployment to wire up — a Docker build compiles the Vite frontend and bundles
it straight into the backend image.

> **Why not the old Vercel + Railway split?** An earlier version of this repo
> was configured for a two-service split (frontend on Vercel, backend on
> Railway, connected via a `VITE_API_URL` env var). That variable was never
> actually read anywhere in the frontend code — every fetch and WebSocket
> connection uses same-origin relative paths (`/api/...`, `${location.host}/ws`).
> So the split never really worked as documented. Render's single-service
> model is what the app is actually built for.

## Prerequisites
- GitHub account, with this repo pushed to it
- [Render account](https://render.com) (free tier works for a demo)
- A [Groq API key](https://console.groq.com) (optional — the app runs in
  heuristic mode without one, but a real key makes the demo look better)
- Optional: [Cognee Cloud](https://platform.cognee.ai/onboarding) credentials
  — recommended on Render, see the disk-persistence note below

---

## Step 1: Push to GitHub

```bash
cd d:\downloads\cognee\continuum
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/continuum.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy on Render

### Option A — Blueprint (one click, uses `render.yaml`)

1. Render dashboard → **New** → **Blueprint**
2. Connect the GitHub repo — Render finds `render.yaml` automatically and
   provisions a Docker web service named `continuum`
3. Render will prompt you to fill in the `sync: false` secrets:
   `GROQ_API_KEY`, and optionally `COGNEE_API_KEY` / `COGNEE_BASE_URL`
4. Click **Apply** — Render builds the Docker image and deploys

### Option B — Manual web service

1. Render dashboard → **New** → **Web Service** → connect the repo
2. **Runtime:** Docker (Render auto-detects the root `Dockerfile`)
3. **Health check path:** `/healthz`
4. Add environment variables (see below), then **Create Web Service**

Either way, the first build takes a few minutes (Node stage builds the
frontend, Python stage installs `requirements.txt` — `cognee` is a heavy
package). Render shows live build logs.

---

## Environment variables

| Variable | Required? | Notes |
|---|---|---|
| `GROQ_API_KEY` | Recommended | Without it, extraction/contradiction-detection falls back to deterministic heuristics — the demo still runs, just less impressively. |
| `GROQ_MODEL` | No | Defaults to `llama-3.3-70b-versatile` |
| `GROQ_FAST_MODEL` | No | Defaults to `llama-3.1-8b-instant` |
| `USE_COGNEE` | No | Defaults to `true` |
| `COGNEE_DATASET` | No | Defaults to `continuum` |
| `COGNIFY_EVERY` | No | Defaults to `4` |
| `COGNEE_API_KEY` / `COGNEE_BASE_URL` | Recommended on Render | Routes Cognee to a hosted Cognee Cloud tenant instead of local disk — see below. |
| `HOST` | No | Defaults to `0.0.0.0` — leave as-is |
| `PORT` | Don't set | Render injects this itself; `run.py` already reads it via `config.py`. |

`render.yaml` declares all of these; `sync: false` ones need a value typed
into the Render dashboard (Environment tab) since secrets aren't stored in
the blueprint file.

### Why Cognee Cloud matters here specifically

Render's free/standard web services have an **ephemeral filesystem** — every
redeploy (and some restarts) wipes it. Cognee's local default (SQLite +
LanceDB) writes to that disk, so without Cognee Cloud, memory resets on every
deploy. Setting `COGNEE_API_KEY` / `COGNEE_BASE_URL` routes `remember()` /
`recall()` / `improve()` / `forget()` at a hosted Cognee tenant instead, which
survives redeploys independently of the container. If you leave both blank,
the app still works fine for a single demo session — it just won't remember
across a redeploy.

---

## Testing your deployment

```bash
curl https://<your-service>.onrender.com/healthz
# {"ok": true, "groq": true}
```

Then open `https://<your-service>.onrender.com` in a browser → **Launch the
Studio** → **▶ Play demo negotiation**. You should see the live transcript,
the $40k → $55k contradiction flag mid-script, and the 3D graph updating in
real time — all served from the one Render URL.

---

## Common issues

**Cold start / first request is slow**
Render's free tier spins services down after inactivity; the first request
after idle can take 30–60s to wake it back up. Expected on the free plan, not
a bug.

**WebSocket not connecting**
Render terminates TLS and proxies WebSocket upgrades automatically — the
frontend's `wss://` connection (from `useContinuum.js`, based on
`location.protocol`) should just work over HTTPS. If it doesn't, check the
service is actually on the `web` type (not `worker`) and that nothing
upstream (a custom proxy/CDN) is stripping the `Upgrade` header.

**"GROQ API key not found" / running in heuristic mode**
Set `GROQ_API_KEY` in the Render dashboard's Environment tab, then trigger a
manual redeploy (env var changes don't hot-reload).

**Cognee errors, or memory resets after every deploy**
Either set `COGNEE_API_KEY` / `COGNEE_BASE_URL` (see above), or set
`USE_COGNEE=false` to run purely on the Groq + in-memory fact ledger path —
the live contradiction detection still works either way.

---

## Monitoring & logs

Render dashboard → your service → **Logs** tab (live streaming) and
**Metrics** tab (CPU/memory/request graphs).

## Custom domain

Render dashboard → your service → **Settings** → **Custom Domains**.

## Rollback

Render dashboard → your service → **Events**/**Deploys** tab → pick a
previous successful deploy → **Rollback to this deploy**.

---

## Local Docker build (optional, to test before pushing)

```bash
docker build -t continuum .
docker run -p 8000:8000 --env-file backend/.env continuum
```
Open `http://localhost:8000` — same image Render will build from.
