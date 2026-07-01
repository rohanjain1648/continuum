import asyncio
import json
import logging
from typing import Set

from fastapi import WebSocket

log = logging.getLogger("continuum.ws")


class WSManager:
    """Broadcasts JSON events to every connected client."""

    def __init__(self) -> None:
        self.active: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self.active.add(ws)
        log.info("client connected (%d total)", len(self.active))

    def disconnect(self, ws: WebSocket) -> None:
        self.active.discard(ws)

    async def broadcast(self, event_type: str, payload) -> None:
        msg = json.dumps({"type": event_type, "data": payload}, default=str)
        dead = []
        for ws in list(self.active):
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)
