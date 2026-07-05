# Continuum — Demo Video Script

Same format as Mnemo's script, adapted to what Continuum actually does: live
**contradiction detection** over a temporal memory graph, not a personal
memory agent. No Alibaba Cloud segment here — Continuum runs on **Groq +
Cognee**, so there's no separate cloud-proof clip required the way the
QwenCloud track asks for one. Just double-check the actual hackathon page
for any submission-specific requirements (demo length, links, etc.) before
you lock the final cut — this script targets ~5:30–6:30, matching what you
asked for, not a length pulled from the brief itself.

Lines marked **VO** are voiceover/on-camera narration to read; **ON SCREEN**
is what should be visible while you say it.

---

## Pre-recording checklist

- [ ] `GROQ_API_KEY` set in `backend/.env` so chips show `groq: on` (not `heuristic`) — the demo works either way, but "on" looks better on camera.
- [ ] `cd frontend && npm run build`, then `cd ../backend && python run.py`
- [ ] Open `http://localhost:8000` fresh in a clean browser window, no stacked toasts from a previous run
- [ ] Start a **new session** right before recording so the archive panel is empty until you deliberately trigger it
- [ ] Screen resolution ≥ 1440×900 — the three Studio columns (Transcript / Intelligence / Graph3D) get cramped below that

---

## 0:00 – 0:25 — Cold open (the problem)

**ON SCREEN:** Black/blank, or a plain slide: "Every negotiation has a moment where someone's story quietly changes — and nobody in the room catches it."

**VO:**
> "A vendor call. Someone says the budget is firm at forty thousand dollars. Twenty minutes later, casually, in the middle of talking about something else — fifty five thousand comes up instead. Nobody's lying. They just forgot what was said earlier, under load, mid-conversation.
>
> A transcript doesn't catch that — you'd have to re-read the whole thing. A summary is worse, it flattens the exact tension you needed to see. This is Continuum, built for WeMakeDevs × Cognee's 'The Hangover Part AI' — a memory layer that catches that drift the instant it happens."

---

## 0:25 – 1:00 — What Continuum is (35s pitch)

**ON SCREEN:** Cut to the Continuum landing page (`/`), slow scroll from hero through the "live loop" section.

**VO:**
> "Continuum listens to a live conversation and builds a knowledge graph of it as it's spoken. Every line runs through four operations: it *remembers* the utterance into a temporal graph, *recalls* prior statements on the same subject, and the moment a new number or decision contradicts something said earlier, it flags it — live, with evidence, not after the call. Say 'off the record' and it *forgets* that line entirely, from both the transcript and memory.
>
> Reasoning runs on **Groq** — a fast model tags facts on every single line, a slower reasoning model judges contradictions and answers questions. Durable memory is **Cognee**, with temporal cognification as the actual mechanism, not just a buzzword."

**ON SCREEN:** Pause on the "Cognee's four operations, as core mechanics" section long enough to read the four cards.

---

## 1:00 – 1:40 — Architecture (40s)

**ON SCREEN:** Switch to a rendered version of the system diagram from `README.md` / `README_DETAILED.md` (or just show the file).

**VO:**
> "Architecture: a React frontend talks to a FastAPI backend over REST and a WebSocket. Every utterance goes through `ContinuumEngine.ingest()` in `pipeline.py` — five steps: store it, call `memory.remember()` which is a cheap, non-blocking `cognee.add`, extract structured facts with Groq's fast model, check for contradictions against any prior fact on the same subject using the slower reasoning model, rebuild the live graph, and broadcast all of it over the WebSocket to every open tab.
>
> The heavy part — `cognee.cognify` with `temporal_cognify=True` — is batched in the background every four utterances, so durable memory never makes the live loop feel laggy. The contradiction check only ever fires when there's actually something to compare against, so it's not burning tokens on the first mention of anything."

---

## 1:40 – 2:05 — Into the Studio (25s)

**ON SCREEN:** Back to the landing page, click **"Launch the Studio"** → transition into `/studio`. Let the three-column layout settle: Transcript+Composer | Memory intelligence | 3D graph + Ask box.

**VO:**
> "This is the Studio. Left is the live transcript. Middle is memory intelligence — every fact extracted, every contradiction, a temporal timeline. Right is a live 3D knowledge graph, orbit-able, plus an Ask box.
>
> Up top, these four pills — remember, recall, improve, forget — actually light up as those operations fire, so you're watching Cognee's real API surface work, not a mocked-up status bar."

**ON SCREEN:** Point the cursor briefly at the status chips: `memory: live`, `groq: on`, the WebSocket `live` chip.

---

## 2:05 – 4:15 — Live demo: the vendor negotiation (2:10 — the core segment)

**ON SCREEN:** Click **"▶ Play demo negotiation"**. The scripted 11-line Acme × Northwind call plays automatically (1.6s between lines, plus Groq's reasoning time on the contradiction turn). Let it run in the background while you narrate over/around it.

**VO — as the first couple of lines land:**
> "I'm running a scripted negotiation so the timing is repeatable on camera, but every line here runs through the exact same live pipeline as if you'd typed or spoken it yourself."

**ON SCREEN:** Line 1 lands — Maya: *"our budget for this rollout is firm at forty thousand dollars for the year."* A `number` fact card appears in Intelligence; the graph gains a `budget` subject node.

**VO:**
> "First line — budget, forty thousand, firm. That's now a structured fact tied to a `budget` subject node in the graph, not just a line of text."

**ON SCREEN:** Lines 3–7 land: the Q3 deadline, Dev's Friday proposal commitment, the annual-plan decision, the analytics risk, keeping analytics out of scope. Commitment/decision cards stack up in the "✓ Commitments & decisions" section; the temporal timeline fills in below.

**VO:**
> "Over the next few lines, Continuum pulls out a hard deadline, a commitment — 'I'll send the proposal by Friday' — a decision to go annual instead of monthly, and a risk about analytics pushing the timeline. Each one is speaker-tagged and timestamped in the timeline at the bottom."

**ON SCREEN:** Line 8 lands: *"Honestly, between us, off the record, our actual ceiling could stretch a bit if needed."* No action yet — just let it sit in the transcript; you'll use it in a minute.

**VO:**
> "This 'off the record' line is there deliberately — we'll come back to it."

**ON SCREEN:** Line 9 lands — Dev: *"we could actually go up to fifty five thousand to include analytics."* **This is the key moment.** A toast fires top-right ("⚠ Contradiction detected"), a contradiction card animates into the "⚠ Contradictions across time" section showing the NOW ($55k) and EARLIER ($40k) statements side by side with a reason and confidence/severity, and in the 3D graph both the old and new budget-fact nodes light up with a coral halo, connected by a dashed red "⚠ contradicts" edge.

**VO (slow down here):**
> "And there it is — the moment the whole project is built around. Continuum checked this new number against every prior fact on the same subject, found the forty-thousand claim from nine lines earlier, and flagged it: value changed from forty thousand to fifty five thousand, high severity, eighty percent confidence. Watch the graph — both nodes glow, and a dashed red edge connects them. That's the one visual cue in the whole cockpit that means 'stop and look here.'"

**ON SCREEN:** Line 10 lands — Maya: *"Wait, fifty five? Earlier we said the budget was firm at forty."* — showing the human in the call catching the same thing Continuum already flagged a beat earlier.

**VO:**
> "And notice the timing — Continuum flagged it before Maya even finished typing her own objection. That's the difference between catching this live versus in a follow-up email three days later."

**ON SCREEN:** Once the script finishes, click into the **Ask box** and type: *"What has each side committed to?"* Press Ask. The answer streams into the answer panel below, citing Dev's Friday commitment and Maya's annual-plan decision.

**VO:**
> "You can also just ask it directly — natural-language Q&A over the whole conversation, routed through Cognee's recall and answered by Groq's reasoning model."

**ON SCREEN:** Click **"🙈 Off the record · forget()"** in the action bar. The off-the-record line from earlier visibly strikes through/fades in the transcript, and its node disappears from the graph.

**VO:**
> "And that off-the-record line from earlier — one click, and it's redacted from the transcript, the fact ledger, and pruned from Cognee. Not hidden. Gone."

---

## 4:15 – 4:50 — The 3D knowledge graph (35s)

**ON SCREEN:** Drag to orbit the graph, let it auto-rotate for a moment. Point out node colors and the dashed contradiction edge again from a different angle.

**VO:**
> "This graph is a live force-directed layout — speakers in violet, subjects in cyan, facts color-coded by type: green for commitments, blue for decisions, amber for numbers. It's not a static diagram; it rebuilds every time a new fact lands, using the same taxonomy the extractor uses. Color here is doing real work, not decoration."

---

## 4:50 – 5:20 — Continual learning across sessions (30s)

**ON SCREEN:** Click **"🎓 End call · improve()"**. A toast appears with a generated summary of commitments, decisions, and contradictions. Click **"＋ New session"**. Click the archived session chip at the bottom to reopen the summary.

**VO:**
> "Ending the call runs `improve()` — Cognee enriches the temporal graph and Continuum writes a summary — then archives the whole session: facts, contradictions, everything. Start a new session and the live transcript resets, but durable memory persists underneath, so a follow-up call next week can build on what this one already established."

---

## 5:20 – 5:50 — Recap against the four operations (30s)

**ON SCREEN:** Optional checklist overlay, or just talk over the Studio view.

**VO:**
> "To tie it back to Cognee directly: `remember` — every utterance ingested the instant it's spoken. `recall` — auto-routed search powering both the contradiction check and the Ask box. `improve` — temporal cognify, batched live and again at end-of-call, so the graph keeps getting richer. And `forget` — surgical, on command, off the record. All four aren't demo dressing — the UI's op pills only light up when the real Cognee call actually fires."

---

## 5:50 – 6:15 — Close (25s)

**ON SCREEN:** Back to the landing page hero, or an end card with the repo link.

**VO:**
> "That's Continuum — a memory layer that catches the contradiction you'd otherwise only notice in an awkward follow-up email. Code's public on GitHub under MIT. Thanks for watching."

**ON SCREEN:** End card: repo URL, "WeMakeDevs × Cognee — The Hangover Part AI", "Groq + Cognee".
