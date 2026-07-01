"""Groq is the LLM (used instead of Claude).

Three jobs:
  1. extract_facts      — fast, per-utterance structured extraction
  2. judge_contradiction— reasoning over prior facts that share a subject
  3. answer_question    — Q&A over the conversation memory

Everything degrades to deterministic heuristics when no GROQ_API_KEY is set,
so the project always runs for a demo.
"""
from __future__ import annotations

import json
import logging
import re
from typing import List, Optional

from .config import settings
from .models import Contradiction, Fact

log = logging.getLogger("continuum.groq")

try:
    from groq import AsyncGroq
    _client: Optional["AsyncGroq"] = (
        AsyncGroq(api_key=settings.groq_api_key) if settings.groq_enabled else None
    )
except Exception as e:  # pragma: no cover
    log.warning("groq sdk unavailable: %s", e)
    _client = None


def groq_ready() -> bool:
    return _client is not None


async def _chat_json(model: str, system: str, user: str, temperature: float = 0.2) -> dict:
    """Call Groq with JSON mode and parse the result defensively."""
    assert _client is not None
    resp = await _client.chat.completions.create(
        model=model,
        temperature=temperature,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    content = resp.choices[0].message.content or "{}"
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, re.S)
        return json.loads(match.group(0)) if match else {}


# --------------------------------------------------------------------------- #
#  1. Fact extraction
# --------------------------------------------------------------------------- #
_EXTRACT_SYS = (
    "You extract structured memory from a single line of a live conversation. "
    "Return JSON: {\"facts\":[{\"type\":..,\"subject\":..,\"statement\":..,\"value\":..}]}. "
    "type is one of: commitment, claim, decision, number, date, preference, question, risk. "
    "subject is a short canonical topic (e.g. 'budget', 'deadline', 'scope'). "
    "statement is a concise normalized restatement. value is the key figure/term or null. "
    "Extract 0-3 facts. Skip pure pleasantries (return empty list)."
)


async def extract_facts(speaker: str, text: str, t_index: int, utt_id: str) -> List[Fact]:
    if groq_ready():
        try:
            data = await _chat_json(
                settings.groq_fast_model,
                _EXTRACT_SYS,
                f"Speaker: {speaker}\nLine: {text}",
            )
            out = []
            for f in data.get("facts", [])[:3]:
                out.append(
                    Fact(
                        speaker=speaker,
                        type=(f.get("type") or "claim").lower(),
                        subject=(f.get("subject") or "general").lower().strip(),
                        statement=f.get("statement") or text,
                        value=f.get("value"),
                        utterance_id=utt_id,
                        t_index=t_index,
                    )
                )
            return out
        except Exception as e:
            log.warning("extract_facts groq error: %s", e)
    return _heuristic_facts(speaker, text, t_index, utt_id)


# --------------------------------------------------------------------------- #
#  2. Contradiction judgment
# --------------------------------------------------------------------------- #
_JUDGE_SYS = (
    "You detect whether a NEW statement contradicts any PRIOR statement about the "
    "same subject in a conversation. Consider changed numbers, reversed decisions, "
    "broken commitments. Return JSON: "
    "{\"contradiction\": null} OR "
    "{\"contradiction\":{\"prior_id\":\"..\",\"reason\":\"..\",\"confidence\":0-1,"
    "\"severity\":\"low|medium|high\"}}. Only flag genuine conflicts."
)


async def judge_contradiction(new_fact: Fact, priors: List[Fact]) -> Optional[Contradiction]:
    if not priors:
        return None
    if groq_ready():
        try:
            prior_lines = "\n".join(
                f"- id={p.id} [{p.speaker}] {p.statement} (value={p.value})" for p in priors
            )
            data = await _chat_json(
                settings.groq_model,
                _JUDGE_SYS,
                f"NEW: [{new_fact.speaker}] {new_fact.statement} (value={new_fact.value})\n"
                f"SUBJECT: {new_fact.subject}\nPRIOR statements:\n{prior_lines}",
            )
            c = data.get("contradiction")
            if not c:
                return None
            prior = next((p for p in priors if p.id == c.get("prior_id")), priors[-1])
            return _make_contradiction(new_fact, prior, c.get("reason", ""),
                                       float(c.get("confidence", 0.7)),
                                       c.get("severity", "medium"))
        except Exception as e:
            log.warning("judge_contradiction groq error: %s", e)
    return _heuristic_contradiction(new_fact, priors)


# --------------------------------------------------------------------------- #
#  3. Q&A
# --------------------------------------------------------------------------- #
_QA_SYS = (
    "You are Continuum, a memory copilot for live conversations. Answer the user's "
    "question using ONLY the supplied memory (facts + retrieved context). Be concise. "
    "Cite who said what when relevant. If the memory does not contain the answer, say so."
)


async def answer_question(question: str, facts: List[Fact], cognee_context: str = "") -> str:
    if groq_ready():
        try:
            ledger = "\n".join(
                f"[t{f.t_index}] {f.speaker}: {f.statement} (value={f.value}, type={f.type})"
                for f in facts if not f.redacted
            )
            resp = await _client.chat.completions.create(  # type: ignore
                model=settings.groq_model,
                temperature=0.2,
                messages=[
                    {"role": "system", "content": _QA_SYS},
                    {"role": "user", "content":
                        f"MEMORY LEDGER:\n{ledger}\n\n"
                        f"COGNEE RETRIEVED CONTEXT:\n{cognee_context or '(none)'}\n\n"
                        f"QUESTION: {question}"},
                ],
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception as e:
            log.warning("answer_question groq error: %s", e)
    return _heuristic_answer(question, facts)


# --------------------------------------------------------------------------- #
#  Heuristic fallbacks (no API key required)
# --------------------------------------------------------------------------- #
_COMMIT_RE = re.compile(r"\b(i'?ll|we'?ll|i will|we will|commit|promise|send you|deliver|by (monday|tuesday|wednesday|thursday|friday|eod|q[1-4]))\b", re.I)
_DECIDE_RE = re.compile(r"\b(decided|let'?s go with|let'?s keep|we'?ll go with|agree|go with the|out of scope)\b", re.I)
_MONEY_RE = re.compile(r"\$\s?\d[\d,\.]*\s?(k|thousand|million|m)?", re.I)
_RISK_RE = re.compile(r"\b(risk|slip|delay|concern|blocker|problem)\b", re.I)
_BUDGET_RE = re.compile(r"budget|price|cost|dollar|\$|thousand|million", re.I)

_UNITS = {"zero":0,"one":1,"two":2,"three":3,"four":4,"five":5,"six":6,"seven":7,
          "eight":8,"nine":9,"ten":10,"eleven":11,"twelve":12,"thirteen":13,
          "fourteen":14,"fifteen":15,"sixteen":16,"seventeen":17,"eighteen":18,"nineteen":19}
_TENS = {"twenty":20,"thirty":30,"forty":40,"fifty":50,"sixty":60,"seventy":70,
         "eighty":80,"ninety":90}
_SCALES = {"hundred":100,"thousand":1_000,"million":1_000_000}


def _spoken_number(text: str) -> Optional[float]:
    total = current = 0
    found = False
    for w in re.findall(r"[a-z]+", text.lower()):
        if w in _UNITS:
            current += _UNITS[w]; found = True
        elif w in _TENS:
            current += _TENS[w]; found = True
        elif w == "hundred":
            current = (current or 1) * 100; found = True
        elif w in ("thousand", "million"):
            current = (current or 1) * _SCALES[w]; total += current; current = 0; found = True
    return (total + current) if found else None


def _num(s: Optional[str]) -> Optional[float]:
    """Parse a money/quantity value from digits OR spelled-out words."""
    if not s:
        return None
    m = re.search(r"\d[\d,\.]*", s.replace(",", ""))
    if m:
        v = float(m.group(0))
        if re.search(r"\bk\b|thousand", s, re.I):
            v *= 1_000
        if re.search(r"\bm\b|million", s, re.I):
            v *= 1_000_000
        return v
    return _spoken_number(s)


def _fmt_money(v: float) -> str:
    return f"${v:,.0f}"


def _heuristic_facts(speaker, text, t_index, utt_id) -> List[Fact]:
    facts: List[Fact] = []
    is_money = bool(_BUDGET_RE.search(text))
    amount = _num(text) if is_money else None

    if _COMMIT_RE.search(text):
        facts.append(Fact(speaker=speaker, type="commitment", subject="commitment",
                          statement=text, utterance_id=utt_id, t_index=t_index))
    if _DECIDE_RE.search(text):
        facts.append(Fact(speaker=speaker, type="decision", subject="scope",
                          statement=text, utterance_id=utt_id, t_index=t_index))
    if amount is not None:
        facts.append(Fact(speaker=speaker, type="number", subject="budget",
                          statement=text, value=_fmt_money(amount),
                          utterance_id=utt_id, t_index=t_index))
    if _RISK_RE.search(text):
        facts.append(Fact(speaker=speaker, type="risk", subject="risk",
                          statement=text, utterance_id=utt_id, t_index=t_index))
    if not facts and len(text.split()) > 4:
        facts.append(Fact(speaker=speaker, type="claim",
                          subject="budget" if is_money else "general",
                          statement=text, utterance_id=utt_id, t_index=t_index))
    return facts


def _heuristic_contradiction(new_fact: Fact, priors: List[Fact]) -> Optional[Contradiction]:
    nv = _num(new_fact.value) or _num(new_fact.statement)
    if nv is None:
        return None
    for p in reversed(priors):
        pv = _num(p.value) or _num(p.statement)
        if pv is not None and abs(pv - nv) / max(pv, nv) > 0.1:
            prior_str = p.value or f"{pv:,.0f}"
            new_str = new_fact.value or f"{nv:,.0f}"
            return _make_contradiction(
                new_fact, p,
                f"Value changed from {prior_str} to {new_str}.",
                0.8, "high")
    return None


def _make_contradiction(new_fact, prior, reason, confidence, severity) -> Contradiction:
    return Contradiction(
        subject=new_fact.subject,
        new_fact_id=new_fact.id, prior_fact_id=prior.id,
        new_statement=new_fact.statement, prior_statement=prior.statement,
        new_speaker=new_fact.speaker, prior_speaker=prior.speaker,
        reason=reason, confidence=confidence, severity=severity,
    )


def _heuristic_answer(question: str, facts: List[Fact]) -> str:
    q = question.lower()
    pool = [f for f in facts if not f.redacted]
    if any(w in q for w in ("commit", "promise", "owe", "deliver")):
        c = [f for f in pool if f.type == "commitment"]
        return ("Commitments:\n" + "\n".join(f"• {f.speaker}: {f.statement}" for f in c)) if c else "No commitments captured yet."
    if any(w in q for w in ("budget", "price", "cost", "money")):
        c = [f for f in pool if f.subject == "budget"]
        return ("Budget mentions:\n" + "\n".join(f"• [t{f.t_index}] {f.speaker}: {f.statement}" for f in c)) if c else "No budget figures captured yet."
    if "decid" in q or "decision" in q:
        c = [f for f in pool if f.type == "decision"]
        return ("Decisions:\n" + "\n".join(f"• {f.statement}" for f in c)) if c else "No decisions captured yet."
    return "I captured " + str(len(pool)) + " facts. (Set GROQ_API_KEY for full natural-language answers.)"
