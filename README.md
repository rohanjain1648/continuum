# Continuum — real-time temporal memory for live conversation

> Built for **"The Hangover Part AI: Where's My Context?"** (WeMakeDevs × Cognee).
> Never wake up with no memory of last night's deal.

Continuum listens to a live conversation, builds a **temporal knowledge graph** of
everything said *as it's said*, and surfaces forgotten context, broken
commitments, and **contradictions across time** the instant they happen.

- **Memory:** [Cognee](https://docs.cognee.ai) — hybrid graph + vector, temporal
  cognification, and all four operations: `remember → recall → improve → forget`.
- **LLM:** [Groq](https://console.groq.com) (`llama-3.3-70b` + `llama-3.1-8b-instant`)
  for real-time fact extraction, contradiction reasoning, and Q&A.
- **UI:** a rich real-time dashboard — live transcript, contradiction alerts,
  commitment tracker, temporal timeline, and a live knowledge graph.

---

## The four operations, as core mechanics

| Cognee op | In Continuum |
|---|---|
| `remember(temporal_cognify=True)` | every utterance is ingested into the temporal graph |
| `recall(TEMPORAL / GRAPH_COMPLETION)` | contradiction lookups + "what did they commit to?" Q&A |
| `improve() / memify` | **End call** promotes the session to permanent memory & enriches the graph (continual learning) |
| `forget()` | **Off the record** redacts an utterance from memory *and* the graph |

---

## The UI

- **Animated landing page** (`/`) — framer-motion, an in-canvas React Three Fiber
  hero, and a full walkthrough of the concept, the live loop, and the four ops.
- **Studio** (`/studio`) — the real-time cockpit: live transcript, contradiction
  radar, commitment tracker, temporal timeline, and a **3D force-directed
  knowledge graph rendered with React Three Fiber** (orbit / zoom).

## Quick start

**1. Build the frontend (Vite + React + R3F):**
```bash
cd continuum/frontend
npm install
npm run build        # emits frontend/dist, which the backend serves
```

**2. Run the backend:**
```bash
cd ../backend
python -m venv .venv && .venv\Scripts\activate     # Windows
# source .venv/bin/activate                         # macOS/Linux
pip install -r requirements.txt
copy .env.example .env                               # then add GROQ_API_KEY
python run.py
```

Open **http://localhost:8000** → **Launch the Studio** → **▶ Play demo negotiation**.

### Frontend hot-reload (development)
```bash
cd continuum/frontend && npm run dev     # http://localhost:5173
```
Vite proxies `/api` and `/ws` to the backend on :8000, so run `python run.py` too.

> **Zero-config demo:** the app runs even before you add keys. Without
> `GROQ_API_KEY` it uses deterministic heuristics; without Cognee installed it
> runs in "degraded" memory mode. Add the key + `pip install cognee` to light up
> the full graph. The status chips top-right show what's live.

---

## How the live loop works

```
utterance ─▶ remember() ─▶ Cognee (graph + vector + temporal)
          └▶ Groq extract facts ─▶ ledger
                   └▶ same-subject priors? ─▶ Groq judge ─▶ ⚠ contradiction
          └▶ rebuild graph ─▶ WebSocket ─▶ browser
```

The hot path (contradiction detection) runs on the Groq + fact-ledger so it's
instant; Cognee builds the durable temporal graph in the background and powers
cross-session recall and natural-language Q&A.

---

## Inputs
1. **🎙 Mic** — browser Web Speech API (free, no STT key).
2. **Type** — manual transcript entry.
3. **▶ Demo** — a scripted negotiation that triggers a real contradiction
   (budget "firm at $40k" → later "$55k").

---

## Config (`.env`)
- `GROQ_API_KEY` — your Groq key.
- `USE_COGNEE` / `COGNEE_DATASET` / `COGNIFY_EVERY` — memory layer.
- Cognee is pointed at Groq for generation and a **local** embedding model
  (`fastembed`) so no OpenAI key is needed — ideal for the self-hosted
  *Best Use of Open Source* track.

## Layout
```
continuum/
  backend/
    run.py
    requirements.txt
    .env.example
    app/
      main.py        FastAPI: REST + WebSocket + static
      pipeline.py    ContinuumEngine — the live orchestration
      memory.py      Cognee wrapper (remember/recall/improve/forget)
      groq_llm.py    Groq extraction + contradiction + Q&A (+ heuristics)
      models.py      pydantic models
      ws_manager.py  WebSocket broadcast
      demo_script.py scripted negotiation
  frontend/                          Vite + React + React Three Fiber
    index.html  package.json  vite.config.js
    src/
      main.jsx  App.jsx  index.css
      lib/useContinuum.js            WebSocket + REST + Web Speech state hook
      components/
        HeroCanvas.jsx               R3F animated landing hero
        Graph3D.jsx                  R3F 3D force-directed knowledge graph
        StudioPanels.jsx             TopBar, Transcript, Intelligence, Ask, …
      pages/
        Landing.jsx                  animated explainer / marketing page
        Studio.jsx                   the real-time cockpit
```
