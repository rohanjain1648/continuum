from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .config import settings
from .demo_script import DEMO_SCRIPT, DEMO_TITLE
from .pipeline import ContinuumEngine
from .ws_manager import WSManager

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("continuum")

app = FastAPI(title="Continuum", version="0.1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

ws_manager = WSManager()
engine = ContinuumEngine(ws_manager)

FRONTEND = Path(__file__).resolve().parents[2] / "frontend"


# ------------------------------------------------------------------ schemas
class UtteranceIn(BaseModel):
    speaker: str = "Speaker"
    text: str


class AskIn(BaseModel):
    question: str


class SessionIn(BaseModel):
    title: str = "Live session"


# ------------------------------------------------------------------ websocket
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    await ws.send_json({"type": "snapshot", "data": engine.snapshot()})
    try:
        while True:
            await ws.receive_text()  # keep-alive; clients send via REST
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)


# ------------------------------------------------------------------ rest api
@app.get("/api/state")
async def state():
    return engine.snapshot()


@app.post("/api/utterance")
async def utterance(body: UtteranceIn):
    return await engine.ingest(body.speaker, body.text)


@app.post("/api/ask")
async def ask(body: AskIn):
    return {"answer": await engine.ask(body.question)}


@app.post("/api/forget")
async def forget():
    text = await engine.forget_last_offrecord()
    return {"forgotten": text}


@app.post("/api/end-call")
async def end_call():
    return await engine.end_call_learn()


@app.post("/api/new-session")
async def new_session(body: SessionIn):
    await engine.new_session(body.title)
    return {"ok": True}


@app.post("/api/demo/play")
async def play_demo():
    async def run():
        await engine.new_session(DEMO_TITLE)
        await asyncio.sleep(0.4)
        for speaker, text in DEMO_SCRIPT:
            await engine.ingest(speaker, text)
            await asyncio.sleep(1.6)  # cinematic pacing for the live demo
    asyncio.create_task(run())
    return {"ok": True, "lines": len(DEMO_SCRIPT)}


# ------------------------------------------------------------------ health
@app.get("/healthz")
async def healthz():
    return {"ok": True, "groq": settings.groq_enabled}


# ------------------------------------------------------------------ frontend
# Serve the built Vite + React app (frontend/dist) with SPA fallback.
# In dev, run `npm run dev` in frontend/ instead (it proxies /api and /ws).
DIST = FRONTEND / "dist"

if DIST.exists():
    assets = DIST / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="assets")

    @app.get("/")
    async def index():
        return FileResponse(str(DIST / "index.html"))

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        # never swallow API/WS/health routes
        if full_path.startswith(("api", "ws", "assets", "healthz")):
            raise HTTPException(status_code=404)
        candidate = DIST / full_path
        if candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(DIST / "index.html"))  # client-side routing
else:
    @app.get("/")
    async def index_dev():
        return {
            "msg": "Frontend not built. Run `npm install && npm run build` in "
                   "continuum/frontend, or `npm run dev` for hot-reload.",
        }
