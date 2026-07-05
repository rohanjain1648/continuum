# Continuum

**Real-time temporal memory for live conversation.**

> Built for *"The Hangover Part AI: Where's My Context?"* — WeMakeDevs × Cognee
> Hackathon (June 29 – July 5, 2026).

Continuum listens to a conversation as it happens, extracts structured facts
from each line, and flags the instant someone's story stops matching what
they said earlier — a budget that quietly grows, a decision that gets
reversed, a commitment nobody follows up on. Everything is backed by
[Cognee](https://docs.cognee.ai) as the durable memory layer and
[Groq](https://console.groq.com) as the LLM, wired together behind a
FastAPI/WebSocket backend and a React + Three.js cockpit.

```
Maya (Acme):     Our budget for this rollout is firm at forty thousand dollars.
   ...
Dev (Northwind):  Looking at the numbers, I think we could go up to fifty five
                   thousand to include analytics.
                   ⚠ contradicts t0 · budget: "$40,000" → "$55,000" · high · 0.8
Maya (Acme):     Wait, fifty five? Earlier we said the budget was firm at forty.
```

That exchange — caught live, not in a post-call review — is the whole product.

---

## Table of contents

1. [The problem](#the-problem)
2. [The four operations](#the-four-operations)
3. [Architecture](#architecture)
4. [The ingest pipeline, step by step](#the-ingest-pipeline-step-by-step)
5. [Data model](#data-model)
6. [REST + WebSocket API](#rest--websocket-api)
7. [Frontend](#frontend)
8. [Graceful degradation](#graceful-degradation)
9. [Tech stack](#tech-stack)
10. [Configuration](#configuration)
11. [Getting started](#getting-started)
12. [Project layout](#project-layout)
13. [Deployment](#deployment)
14. [Known limitations & roadmap](#known-limitations--roadmap)
15. [FAQ](#faq)
16. [License](#license)

---

## The problem

Nobody lies on purpose in the transcript above. Dev just genuinely forgot what
was said nine lines earlier, mid-negotiation, while thinking about analytics
pricing. That's an ordinary failure of working memory under load — and it's
exactly the failure mode that transcripts, meeting notes, and most "AI meeting
assistant" tools don't catch, because they store *words*, not the *claims*
those words made and how those claims change over time.

A raw transcript doesn't fix this — you'd have to re-read the whole thing to
catch the drift. A summary is worse: it flattens the exact tension you needed
to see. What's missing is something closer to a sharp chief of staff sitting
in on the call: remembers every number anyone has said, notices the instant a
new one doesn't match, and — because not everything said in a room should
live forever — can be told to strike a line from the record.

That's four verbs, not one feature: **remember**, **recall**, **improve**,
**forget**. Cognee's API is already organized around exactly those four verbs
(`add`, `search`, `cognify`, `prune`), so the hard product question — *what
should a memory system actually do?* — arrives pre-answered. Continuum's job
is wiring a live conversation into it fast enough that a contradiction gets
flagged mid-sentence, not in a follow-up email three days later.

## The four operations

Every Cognee call in the backend is deliberately kept close to the surface —
the UI's "op pills" light up (`_flash_op` in
[pipeline.py](backend/app/pipeline.py)) every time one of these fires, so the
memory system's behavior is visible, not hidden behind a chat window.

| Op | Cognee call | In Continuum |
|---|---|---|
| **remember** | `cognee.add(text, dataset_name=...)` | Every utterance is ingested the instant it's spoken. Cheap, non-blocking. |
| **recall** | `cognee.search(query_text, query_type=...)` | Powers the Ask box and contradiction lookups, auto-routed across `GRAPH_COMPLETION`, `TEMPORAL`, `CHUNKS`, `INSIGHTS`, `SUMMARIES`. |
| **improve** | `cognee.cognify(datasets=[...], temporal_cognify=True)` | Batched every `COGNIFY_EVERY` utterances (default 4) and again at "End call" — builds/enriches the temporal knowledge graph. |
| **forget** | `cognee.prune.prune_data()` / `prune_system()` | Triggered by phrases like "off the record" — redacts the most recent matching utterance from the live graph *and* durable memory. |

## Architecture

```
┌──────────────────────────────── Browser ─────────────────────────────────┐
│  Landing (/)                         Studio (/studio)                    │
│  framer-motion explainer page        ┌───────────┬───────────┬────────┐  │
│                                       │ Transcript│Intelligence│Graph3D│  │
│                                       │ + Composer│ (facts +   │ (R3F +│  │
│                                       │           │contradict.)│d3-force│  │
│                                       └───────────┴───────────┴────────┘  │
│                       useContinuum() — one WebSocket + REST POSTs        │
└───────────────────────────────┬──────────────────────────┬──────────────┘
                                 │ REST                      │ WS (event stream)
                                 ▼                            ▲
┌───────────────────────────── FastAPI ─────────────────────┴──────────────┐
│  main.py — routes + WSManager (fan-out broadcast to all connected tabs)  │
│                                                                            │
│  ContinuumEngine (pipeline.py)                                           │
│    ingest()          remember → extract → judge → build_graph → broadcast│
│    ask()             recall → answer_question → broadcast                │
│    forget_last_offrecord()   redact utterance + facts, re-broadcast graph│
│    end_call_learn()  improve → summarize → archive session               │
│           │                              │                               │
│           ▼                              ▼                               │
│  groq_llm.py (Groq)               memory.py (CogneeMemory)               │
│  • extract_facts()  8B-instant    • remember() / recall()                │
│  • judge_contradiction() 70B      • improve() / forget()                 │
│  • answer_question()     70B      • degrades to available=False if       │
│  • heuristic fallbacks              Cognee isn't installed/configured    │
│    (regex + spoken-number             (status "degraded", UI shows it)  │
│     parser — no key required)                                            │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                         Groq API (remote)              Cognee (local process)
                    llama-3.3-70b-versatile        hybrid graph + vector store,
                    llama-3.1-8b-instant           local by default (SQLite +
                                                    LanceDB; Kuzu optional) —
                                                    no external DB required
```

Two things worth calling out about this shape:

- **The hot path never waits on the memory layer.** `memory.remember()` is a
  cheap `add`; the expensive graph build (`cognify`) is deferred and batched
  via `asyncio.create_task`, so durable memory never makes the live loop feel
  laggy.
- **The contradiction judge is opportunistic.** It only runs when there's a
  prior fact on the same subject to compare against — no wasted Groq calls on
  the first mention of anything.

## The ingest pipeline, step by step

Every utterance POSTed to `/api/utterance` runs through
`ContinuumEngine.ingest()` in [pipeline.py](backend/app/pipeline.py):

1. **Store the utterance** — appended to the in-memory transcript, broadcast
   to all clients as a `utterance` event.
2. **`memory.remember()`** — `cognee.add(f"[{ts}] {speaker}: {text}", dataset_name="continuum")`.
   Increments a pending counter; every `COGNIFY_EVERY` utterances (default 4)
   it kicks off `improve()` in the background.
3. **`groq_llm.extract_facts()`** — the fast model (`llama-3.1-8b-instant`)
   pulls 0–3 structured facts out of the line: type (`commitment` / `claim` /
   `decision` / `number` / `date` / `preference` / `question` / `risk`),
   a canonical `subject` (e.g. `budget`, `scope`), a normalized `statement`,
   and an optional `value`.
4. **Contradiction check** — for each new fact, gather every prior
   non-redacted fact with the same `subject`. If there are any, call
   `groq_llm.judge_contradiction()` (the reasoning model,
   `llama-3.3-70b-versatile`), which returns either `null` or a structured
   contradiction with a `reason`, `confidence` (0–1), and `severity`.
5. **Rebuild the graph** — `build_graph()` turns the current fact ledger into
   `{nodes, edges}`: speaker nodes, subject nodes, fact nodes (colored by
   type), a `said` edge from speaker → fact, an `about` edge from fact →
   subject, and a dashed `⚠ contradicts` edge between any two facts a
   contradiction was raised over.
6. **Broadcast** — `fact`, `contradiction` (if any), `graph`, and `stats`
   events go out over the WebSocket to every open tab. The UI never polls.

`ask()`, `forget_last_offrecord()`, and `end_call_learn()` follow the same
pattern — call into `memory.py` and/or `groq_llm.py`, then broadcast the
result — see [pipeline.py](backend/app/pipeline.py) for the full engine.

## Data model

Defined in [models.py](backend/app/models.py) as Pydantic models (so every
REST/WS payload is type-checked at the boundary):

```python
class Utterance(BaseModel):
    id: str; speaker: str; text: str; ts: float; t_index: int

class Fact(BaseModel):
    id: str; speaker: str
    type: Literal["commitment","claim","decision","number",
                  "date","preference","question","risk"]
    subject: str; statement: str; value: Optional[str]
    utterance_id: str; t_index: int; redacted: bool = False

class Contradiction(BaseModel):
    id: str; subject: str
    new_fact_id: str; prior_fact_id: str
    new_statement: str; prior_statement: str
    new_speaker: str; prior_speaker: str
    reason: str; confidence: float; severity: Literal["low","medium","high"]
```

## REST + WebSocket API

All routes live in [main.py](backend/app/main.py).

| Method | Path | Body | Does |
|---|---|---|---|
| `GET` | `/api/state` | — | Full snapshot: stats, memory/Groq status, utterances, facts, contradictions, graph, archive. |
| `POST` | `/api/utterance` | `{speaker, text}` | Runs one utterance through the full ingest pipeline. |
| `POST` | `/api/ask` | `{question}` | Natural-language Q&A over the fact ledger + Cognee recall. |
| `POST` | `/api/forget` | — | Redacts the most recent "off the record"-style utterance (or the last one, if none matches). |
| `POST` | `/api/end-call` | — | Runs `improve()`, generates a summary, archives the session. |
| `POST` | `/api/new-session` | `{title}` | Clears the live transcript/facts/contradictions and starts a fresh session id. |
| `POST` | `/api/demo/play` | — | Starts a new session and plays the scripted negotiation from [demo_script.py](backend/app/demo_script.py), one line every 1.6s. |
| `GET` | `/healthz` | — | `{ok, groq}` liveness + Groq-configured check. |
| `WS` | `/ws` | — | On connect: one `snapshot` message with the full state, then a live stream of `utterance` / `fact` / `contradiction` / `graph` / `stats` / `op` / `answer` / `forget` / `call_ended` / `reset` events. |

The frontend never polls — `useContinuum()` opens the socket once, reconnects
with a 1.5s backoff on drop, and dispatches every event straight into a
reducer (see [useContinuum.js](frontend/src/lib/useContinuum.js)).

## Frontend

Vite + React 18, two routes:

- **`/` — Landing.** A framer-motion explainer with an animated hero canvas,
  walking through the pitch and the four operations before sending you into
  the Studio.
- **`/studio` — Studio.** The real-time cockpit, three columns:
  - **Transcript + Composer** — type a line, toggle the mic (browser
    `SpeechRecognition` API, free, no STT key), or hit *Play demo*.
  - **Intelligence** — the live fact ledger and contradiction cards as they
    stream in.
  - **Knowledge graph** — `Graph3D.jsx`: `d3-force-3d` runs a headless force
    simulation (charge + link + center forces, 300 ticks) on every graph
    update; the settled layout is rendered with `@react-three/fiber` as
    glowing spheres — violet for speakers, cyan for subjects, and per-type
    colors for facts (green `commitment`, blue `decision`, amber `number`,
    coral `risk`/contradiction). Contradicting nodes get a translucent coral
    halo and a dashed edge — the one visual cue in the cockpit that means
    "look here." `OrbitControls` auto-rotates the scene; drag to orbit,
    scroll to zoom.
  - An **Ask box** underneath the graph, wired straight to `/api/ask`.

## Graceful degradation

A live demo has to survive bad wifi, an expired free-tier key, or a Cognee
install that didn't finish. So every layer has a floor it can't fall through:

- **No `GROQ_API_KEY`** → `groq_llm.py` falls back to regex-based heuristics:
  commitment/decision/risk pattern matching, a `$`/`k`/`million` money parser,
  and a small spoken-number parser (`"fifty five thousand"` → `55000.0`) so
  numbers spoken aloud in a negotiation still get caught without an LLM in
  the loop at all.
- **No Cognee installed / import fails** → `CogneeMemory.available` is
  `False`; every method on it becomes a safe no-op, and `status()` reports
  `"degraded"` so the UI can say so honestly rather than pretending nothing's
  wrong.
- **Bad JSON from Groq** → `_chat_json()` regex-rescues a `{...}` block from
  the raw response before giving up.

Crucially, the headline feature — live contradiction detection — never
depends on either Groq or Cognee being present; it runs end-to-end on the
heuristic path alone. The frontend surfaces all of this as status chips
(`memory: live/degraded`, `groq: on/heuristic`, `ws: live/offline`) so it's
never ambiguous which mode you're watching.

## Tech stack

**Backend** — [requirements.txt](backend/requirements.txt)

| | |
|---|---|
| FastAPI ≥0.111 | async REST + WebSocket, Pydantic validation |
| Uvicorn ≥0.30 | ASGI server |
| Pydantic ≥2.7 / pydantic-settings ≥2.3 | typed models + `.env` config |
| groq ≥0.11 | Groq SDK (`AsyncGroq`) |
| cognee ≥0.1.30 | memory layer — hybrid graph + vector, temporal cognify |

**Frontend** — [package.json](frontend/package.json)

| | |
|---|---|
| React 18.3 + React Router 6.27 | SPA, two routes |
| Vite 5.4 | dev server + build |
| @react-three/fiber 8.17 + @react-three/drei 9.14 + three 0.169 | 3D rendering |
| d3-force-3d 3.0 | force-directed graph layout |
| framer-motion 11.11 | landing page animation |

## Configuration

All settings load from `.env` via [config.py](backend/app/config.py)
(`pydantic-settings`, so env vars override the file). Full reference —
[.env.example](backend/.env.example):

```bash
# Groq (the LLM)
GROQ_API_KEY=                            # get one free at console.groq.com
GROQ_MODEL=llama-3.3-70b-versatile       # reasoning: contradiction judge + Q&A
GROQ_FAST_MODEL=llama-3.1-8b-instant     # fast: per-utterance fact extraction

# Cognee memory layer
USE_COGNEE=true
COGNEE_DATASET=continuum
COGNIFY_EVERY=4                          # build/enrich the graph every N utterances

# Cognee's own LLM + embedding config (separate from the two vars above —
# these tell Cognee itself how to call Groq and how to embed locally)
LLM_PROVIDER=groq
LLM_MODEL=groq/llama-3.3-70b-versatile
LLM_API_KEY=                             # same value as GROQ_API_KEY
LLM_ENDPOINT=https://api.groq.com/openai/v1
EMBEDDING_PROVIDER=fastembed             # local embeddings, no OpenAI key needed
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
EMBEDDING_DIMENSIONS=384
# GRAPH_DATABASE_PROVIDER=kuzu           # optional; defaults to local SQLite + LanceDB

# Server
HOST=0.0.0.0
PORT=8000
```

Only `GROQ_MODEL`, `GROQ_FAST_MODEL`, `USE_COGNEE`, `COGNEE_DATASET`, and
`COGNIFY_EVERY` are read by Continuum's own code
([config.py](backend/app/config.py)); the `LLM_*` / `EMBEDDING_*` block
configures Cognee itself, which by default persists to a local SQLite +
LanceDB store — nothing external to run or provision.

## Getting started

### Prerequisites
- Python 3.10+ (developed and verified against 3.12)
- Node.js 18+
- A free [Groq API key](https://console.groq.com) (optional — the app runs
  without one, in heuristic mode)

### Backend

```bash
cd continuum/backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

pip install -r requirements.txt
copy .env.example .env          # then fill in GROQ_API_KEY (optional)
python run.py                   # → http://localhost:8000
```

`cognee>=0.1.30` is a heavy install. To iterate on the contradiction logic
without waiting on it, set `USE_COGNEE=false` — Continuum runs the full live
loop on the Groq + fact-ledger path alone.

### Frontend

```bash
cd continuum/frontend
npm install
npm run build      # emits frontend/dist — the backend serves this directly
```

Open **http://localhost:8000**, go to the Studio, and click **▶ Play demo
negotiation**.

For hot-reload during frontend development:

```bash
npm run dev         # http://localhost:5173
```

Vite proxies `/api` and `/ws` to `:8000` (see [vite.config.js](frontend/vite.config.js)),
so keep `python run.py` running alongside it.

## Project layout

```
continuum/
  backend/
    run.py                single entrypoint — uvicorn app.main:app
    requirements.txt
    .env.example
    app/
      main.py              FastAPI: REST routes, WebSocket, static SPA serving
      pipeline.py          ContinuumEngine — the live orchestration loop
      memory.py            CogneeMemory — remember / recall / improve / forget
      groq_llm.py          Groq extraction + contradiction judge + Q&A, heuristic fallbacks
      models.py            Utterance / Fact / Contradiction (Pydantic)
      ws_manager.py         WebSocket connection registry + broadcast
      config.py            pydantic-settings, reads .env
      demo_script.py       the scripted negotiation used by "Play demo"
  frontend/
    index.html  package.json  vite.config.js
    src/
      main.jsx  App.jsx  index.css
      lib/
        useContinuum.js     WebSocket + REST + Web Speech state hook
      components/
        HeroCanvas.jsx      landing-page animated hero (R3F)
        Graph3D.jsx         3D force-directed knowledge graph
        StudioPanels.jsx    TopBar, Transcript, Composer, Intelligence, AskBox, ActionBar, Toasts
      pages/
        Landing.jsx         explainer / marketing page
        Studio.jsx          the real-time cockpit
  Dockerfile               multi-stage build: Node (frontend) -> Python (backend)
  render.yaml              Render Blueprint — one Docker web service
  DEPLOYMENT.md            step-by-step Render deploy guide
  DEPLOY_STEPS.txt         condensed version of the same
```

## Deployment

Continuum deploys as a single Render Web Service — see
[DEPLOYMENT.md](DEPLOYMENT.md) and [DEPLOY_STEPS.txt](DEPLOY_STEPS.txt) for
the full walkthrough. A multi-stage [Dockerfile](Dockerfile) builds the Vite
frontend (Node stage) and bundles the result into the FastAPI image (Python
stage), which serves the API, the `/ws` WebSocket, and the built UI from one
origin — `main.py`'s SPA fallback already serves `frontend/dist` directly, so
there's no separate frontend host to wire up.

[render.yaml](render.yaml) is a Render Blueprint — connect the repo via
**New → Blueprint** in the Render dashboard and it provisions the service
from that file, prompting for the secret env vars (`GROQ_API_KEY`, and
optionally `COGNEE_API_KEY`/`COGNEE_BASE_URL` for Cognee Cloud, recommended
since Render's filesystem is ephemeral between deploys).

## Known limitations & roadmap

Being direct about what's built versus what's aspirational:

- **State is in-process.** `ContinuumEngine` holds the live transcript, fact
  ledger, and session archive in memory — a server restart clears the live
  session (durable memory in Cognee itself survives). There's no
  multi-worker or multi-instance story yet; `WSManager` broadcasts to
  whatever's connected to *this* process.
- **Cross-session recall is scaffolded, not surfaced.** Ended sessions are
  archived with a summary and are visible in `state.archive`, but there's no
  UI yet for asking a question against a *previous* call specifically.
- **Speaker input is a free-text field**, not diarization — the mic path
  (`Web Speech API`) transcribes but doesn't distinguish speakers; you tag
  the active speaker yourself before typing/speaking.
- **Single-process WebSocket fan-out.** Fine for a demo or a small team;
  scaling to many concurrent sessions would need session-scoped rooms
  instead of one global broadcast.
- **No auth.** Every route is open. Fine for a hackathon demo, not for
  anything holding real conversation data.

None of this blocks the core loop — remember/recall/improve/forget and live
contradiction detection are fully wired and verified end-to-end, including in
heuristic mode with no external keys — but it's the honest list of what a
production version would need next.

## FAQ

**Does it work without a Groq key or Cognee installed?**
Yes, both independently. Fact extraction and contradiction detection fall
back to deterministic heuristics; without Cognee, the live loop runs on the
Groq + fact-ledger path and durable memory is simply unavailable
(`status: degraded`). This was a deliberate choice so a dependency hiccup on
demo day degrades the app instead of breaking it.

**Why Groq instead of Claude/GPT for the live loop?**
Latency. A memory copilot that lags behind the conversation it's tracking has
already failed at its one job — the per-utterance extraction call needs to
return well under a second, which is what the fast 8B model is for. The
heavier reasoning calls (contradiction judgment, Q&A) only fire when there's
actually something to reason about.

**What happens when I click "off the record"?**
`forget_last_offrecord()` finds the most recent utterance matching phrases
like "off the record" or "between us" (or just the last utterance if none
match), marks its facts `redacted: true` so they drop out of the graph and
the fact ledger, and calls `memory.forget()` to prune it from Cognee too.
It's not a soft delete — the node disappears from the live 3D graph.

**Can I add my own fact types or contradiction rules?**
Fact types are a closed `Literal` set in
[models.py](backend/app/models.py); extending it means adding to the type
and to the `_EXTRACT_SYS` prompt (and the heuristic regexes) in
[groq_llm.py](backend/app/groq_llm.py). Custom contradiction logic lives in
`_heuristic_contradiction()` for the no-key path, or the `_JUDGE_SYS` prompt
for the Groq path.

## License

MIT.
