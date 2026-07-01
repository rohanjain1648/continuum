"""The Cognee memory layer — the heart of Continuum.

Wraps the four operations the hackathon cares about:
    remember()  -> cognee.add (+ temporal cognify in the background)
    recall()    -> cognee.search (TEMPORAL / GRAPH_COMPLETION, auto-routing)
    improve()   -> cognee.cognify / memify  (continual learning)
    forget()    -> cognee.prune / delete    (off-the-record / GDPR)

Every call is defensive: if Cognee is not installed/configured the app keeps
working (the live contradiction engine runs on the Groq + fact-ledger path),
and `status()` reports memory as "degraded" so the UI can show it.
"""
from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

from .config import settings

log = logging.getLogger("continuum.memory")


class CogneeMemory:
    def __init__(self) -> None:
        self.available = False
        self.dataset = settings.cognee_dataset
        self._pending = 0
        self._cognee = None
        self._SearchType = None
        self._lock = asyncio.Lock()
        if settings.use_cognee:
            self._try_import()

    def _try_import(self) -> None:
        try:
            import cognee  # type: ignore
            from cognee.api.v1.search import SearchType  # type: ignore

            self._cognee = cognee
            self._SearchType = SearchType
            self.available = True
            log.info("Cognee loaded — memory layer is LIVE")
        except Exception as e:  # pragma: no cover
            log.warning("Cognee unavailable (degraded mode): %s", e)

    # --------------------------------------------------------------- remember
    async def remember(self, text: str) -> None:
        """Ingest one utterance. Cheap add now; graph build batched in improve()."""
        if not self.available:
            return
        try:
            await self._cognee.add(text, dataset_name=self.dataset)
            self._pending += 1
            if self._pending >= settings.cognify_every:
                # build graph in the background so the live loop never blocks
                asyncio.create_task(self.improve())
        except Exception as e:
            log.warning("remember/add failed: %s", e)

    # --------------------------------------------------------------- improve
    async def improve(self) -> None:
        """Continual learning: build/enrich the temporal knowledge graph."""
        if not self.available:
            return
        async with self._lock:
            pending = self._pending
            self._pending = 0
        if pending == 0:
            return
        try:
            await self._cognify_temporal()
            log.info("cognify complete (+%d utterances)", pending)
        except Exception as e:
            log.warning("improve/cognify failed: %s", e)

    async def _cognify_temporal(self) -> None:
        cognify = self._cognee.cognify
        # Try the temporal path first (our moat), fall back to plain cognify.
        for kwargs in (
            dict(datasets=[self.dataset], temporal_cognify=True),
            dict(datasets=[self.dataset]),
            dict(),
        ):
            try:
                await cognify(**kwargs)
                return
            except TypeError:
                continue

    # --------------------------------------------------------------- recall
    async def recall(self, query: str, kind: str = "graph") -> str:
        """Query memory. kind in {graph, temporal, chunks, insights}."""
        if not self.available:
            return ""
        try:
            st = self._search_type(kind)
            results = await self._search(query, st)
            return self._format(results)
        except Exception as e:
            log.warning("recall/search failed: %s", e)
            return ""

    async def _search(self, query: str, st):
        search = self._cognee.search
        for kwargs in (
            dict(query_text=query, query_type=st),
            dict(query_text=query, query_type=st, datasets=[self.dataset]),
        ):
            try:
                return await search(**kwargs)
            except TypeError:
                continue
        # very old positional signature
        return await search(st, query)

    def _search_type(self, kind: str):
        st = self._SearchType
        table = {
            "graph": "GRAPH_COMPLETION",
            "temporal": "TEMPORAL",
            "chunks": "CHUNKS",
            "insights": "INSIGHTS",
            "summaries": "SUMMARIES",
        }
        name = table.get(kind, "GRAPH_COMPLETION")
        return getattr(st, name, getattr(st, "GRAPH_COMPLETION"))

    @staticmethod
    def _format(results) -> str:
        if not results:
            return ""
        if isinstance(results, str):
            return results
        parts = []
        for r in (results if isinstance(results, list) else [results])[:8]:
            parts.append(r if isinstance(r, str) else str(getattr(r, "text", r)))
        return "\n".join(parts)

    # --------------------------------------------------------------- forget
    async def forget(self, scope: str = "all") -> None:
        """Surgically remove memory. scope='all' prunes the whole dataset."""
        if not self.available:
            return
        try:
            if hasattr(self._cognee, "prune"):
                await self._cognee.prune.prune_data()
                await self._cognee.prune.prune_system(metadata=True)
            elif hasattr(self._cognee, "delete"):
                await self._cognee.delete(dataset_name=self.dataset)
            log.info("forget(%s) complete", scope)
        except Exception as e:
            log.warning("forget failed: %s", e)

    # --------------------------------------------------------------- status
    def status(self) -> dict:
        return {
            "available": self.available,
            "mode": "live" if self.available else "degraded",
            "dataset": self.dataset,
            "pending": self._pending,
        }


memory = CogneeMemory()
