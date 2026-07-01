"""ContinuumEngine — orchestrates the live loop.

For each incoming utterance:
  1. remember()  -> store in Cognee (durable hybrid graph + temporal)
  2. extract     -> Groq pulls structured facts (commitments/claims/numbers...)
  3. judge       -> Groq checks new facts against prior facts on the same subject
  4. graph       -> rebuild the live knowledge graph for the UI
  5. broadcast   -> push everything to the browser over WebSocket
"""
from __future__ import annotations

import logging
import time
from typing import Dict, List, Optional

from . import groq_llm
from .memory import memory
from .models import Contradiction, Fact, Utterance
from .ws_manager import WSManager

log = logging.getLogger("continuum.engine")


class ContinuumEngine:
    def __init__(self, ws: WSManager) -> None:
        self.ws = ws
        self.session_id = f"call_{int(time.time())}"
        self.title = "Live session"
        self.utterances: List[Utterance] = []
        self.facts: List[Fact] = []
        self.contradictions: List[Contradiction] = []
        self.archive: Dict[str, dict] = {}  # previous sessions (cross-session demo)

    # ------------------------------------------------------------------ ops
    async def ingest(self, speaker: str, text: str) -> dict:
        text = text.strip()
        if not text:
            return {"ok": False}

        t_index = len(self.utterances)
        utt = Utterance(speaker=speaker, text=text, t_index=t_index)
        self.utterances.append(utt)
        await self.ws.broadcast("utterance", utt.model_dump())
        await self._flash_op("remember")

        # 1. durable memory (non-blocking inside)
        await memory.remember(f"[{utt.ts:.0f}] {speaker}: {text}")

        # 2. extract structured facts (Groq fast model)
        new_facts = await groq_llm.extract_facts(speaker, text, t_index, utt.id)

        new_contradictions: List[Contradiction] = []
        for f in new_facts:
            priors = [
                p for p in self.facts
                if p.subject == f.subject and p.id != f.id and not p.redacted
            ]
            self.facts.append(f)
            await self.ws.broadcast("fact", f.model_dump())

            # 3. contradiction check (only when there is something to compare to)
            if priors:
                await self._flash_op("recall")
                c = await groq_llm.judge_contradiction(f, priors)
                if c:
                    self.contradictions.append(c)
                    new_contradictions.append(c)
                    await self.ws.broadcast("contradiction", c.model_dump())

        # 4. live knowledge graph
        await self.ws.broadcast("graph", self.build_graph())
        await self.ws.broadcast("stats", self.stats())

        return {
            "ok": True,
            "facts": [f.model_dump() for f in new_facts],
            "contradictions": [c.model_dump() for c in new_contradictions],
        }

    async def ask(self, question: str) -> str:
        await self._flash_op("recall")
        cognee_ctx = await memory.recall(question, kind="graph")
        answer = await groq_llm.answer_question(question, self.facts, cognee_ctx)
        await self.ws.broadcast("answer", {"question": question, "answer": answer})
        return answer

    async def forget_last_offrecord(self) -> Optional[str]:
        """Redact the most recent 'off the record' style utterance + its facts."""
        target = None
        for utt in reversed(self.utterances):
            if any(k in utt.text.lower() for k in ("off the record", "between us", "don't minute", "do not record")):
                target = utt
                break
        if target is None and self.utterances:
            target = self.utterances[-1]
        if target is None:
            return None

        for f in self.facts:
            if f.utterance_id == target.id:
                f.redacted = True
        await self._flash_op("forget")
        await memory.forget(scope="item")
        await self.ws.broadcast("forget", {"utterance_id": target.id, "text": target.text})
        await self.ws.broadcast("graph", self.build_graph())
        await self.ws.broadcast("stats", self.stats())
        return target.text

    async def end_call_learn(self) -> dict:
        """Continual learning: promote session -> permanent + enrich the graph."""
        await self._flash_op("improve")
        await memory.improve()
        summary = await groq_llm.answer_question(
            "Summarize this conversation: key commitments, decisions, open risks, and any contradictions.",
            self.facts,
        )
        # archive so we can 'reopen yesterday's call' (cross-session recall)
        self.archive[self.session_id] = {
            "title": self.title,
            "session_id": self.session_id,
            "summary": summary,
            "facts": [f.model_dump() for f in self.facts],
            "contradictions": [c.model_dump() for c in self.contradictions],
            "ended": time.time(),
        }
        await self.ws.broadcast("call_ended", {"summary": summary, "session_id": self.session_id})
        return {"summary": summary}

    async def new_session(self, title: str = "Live session") -> None:
        self.session_id = f"call_{int(time.time())}"
        self.title = title
        self.utterances.clear()
        self.facts.clear()
        self.contradictions.clear()
        await self.ws.broadcast("reset", {"session_id": self.session_id, "title": title})
        await self.ws.broadcast("stats", self.stats())

    # --------------------------------------------------------------- helpers
    def build_graph(self) -> dict:
        """A force-directed graph from speakers, subjects and facts."""
        nodes: Dict[str, dict] = {}
        edges: List[dict] = []

        def node(nid, label, group, **extra):
            nodes[nid] = {"id": nid, "label": label, "group": group, **extra}

        speakers = {f.speaker for f in self.facts if not f.redacted}
        for sp in speakers:
            node(f"sp::{sp}", sp, "speaker")

        for f in self.facts:
            if f.redacted:
                continue
            subj = f"subj::{f.subject}"
            if subj not in nodes:
                node(subj, f.subject, "subject")
            fid = f"fact::{f.id}"
            label = (f.value or f.statement)[:42]
            node(fid, label, f.type, title=f.statement)
            edges.append({"from": f"sp::{f.speaker}", "to": fid, "label": "said"})
            edges.append({"from": fid, "to": subj, "label": "about"})

        contradicting = set()
        for c in self.contradictions:
            edges.append({
                "from": f"fact::{c.new_fact_id}", "to": f"fact::{c.prior_fact_id}",
                "label": "⚠ contradicts", "contradiction": True,
            })
            contradicting.add(f"fact::{c.new_fact_id}")
            contradicting.add(f"fact::{c.prior_fact_id}")
        for nid in contradicting:
            if nid in nodes:
                nodes[nid]["conflict"] = True

        return {"nodes": list(nodes.values()), "edges": edges}

    def stats(self) -> dict:
        return {
            "session_id": self.session_id,
            "title": self.title,
            "utterances": len(self.utterances),
            "facts": len([f for f in self.facts if not f.redacted]),
            "commitments": len([f for f in self.facts if f.type == "commitment" and not f.redacted]),
            "decisions": len([f for f in self.facts if f.type == "decision" and not f.redacted]),
            "contradictions": len(self.contradictions),
            "archived_sessions": len(self.archive),
        }

    def snapshot(self) -> dict:
        return {
            "stats": self.stats(),
            "memory": memory.status(),
            "groq": groq_llm.groq_ready(),
            "utterances": [u.model_dump() for u in self.utterances],
            "facts": [f.model_dump() for f in self.facts if not f.redacted],
            "contradictions": [c.model_dump() for c in self.contradictions],
            "graph": self.build_graph(),
            "archive": list(self.archive.values()),
        }

    async def _flash_op(self, op: str) -> None:
        """Light up one of the four-operation indicators in the UI."""
        await self.ws.broadcast("op", {"op": op})
