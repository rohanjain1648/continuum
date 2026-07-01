from __future__ import annotations

import time
import uuid
from typing import Literal, Optional

from pydantic import BaseModel, Field

FactType = Literal[
    "commitment", "claim", "decision", "number",
    "date", "preference", "question", "risk",
]


def _id() -> str:
    return uuid.uuid4().hex[:8]


class Utterance(BaseModel):
    id: str = Field(default_factory=_id)
    speaker: str = "Speaker"
    text: str
    ts: float = Field(default_factory=time.time)
    t_index: int = 0


class Fact(BaseModel):
    """A structured unit of memory extracted from an utterance."""
    id: str = Field(default_factory=_id)
    speaker: str = "Unknown"
    type: FactType = "claim"
    subject: str = ""          # canonical topic, e.g. "budget"
    statement: str = ""        # human-readable statement
    value: Optional[str] = None  # e.g. "$40k", "Friday", "firm"
    utterance_id: str = ""
    ts: float = Field(default_factory=time.time)
    t_index: int = 0
    redacted: bool = False


class Contradiction(BaseModel):
    id: str = Field(default_factory=_id)
    subject: str
    new_fact_id: str
    prior_fact_id: str
    new_statement: str
    prior_statement: str
    new_speaker: str = ""
    prior_speaker: str = ""
    reason: str = ""
    confidence: float = 0.6
    severity: Literal["low", "medium", "high"] = "medium"
    ts: float = Field(default_factory=time.time)
