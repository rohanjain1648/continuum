import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const OPS = ["remember", "recall", "improve", "forget"];

/* ------------------------------------------------------------------ TopBar */
export function TopBar({ state }) {
  const now = Date.now();
  return (
    <header className="topbar glass">
      <div className="brand">
        <div className="logo">∞</div>
        <div>
          <div className="brand-name">Continuum</div>
          <div className="brand-sub">
            real-time temporal memory · <b>Cognee</b> + <b>Groq</b>
          </div>
        </div>
      </div>

      <div className="ops">
        {OPS.map((op) => {
          const active = state.ops[op] && now - state.ops[op] < 1400;
          return (
            <div key={op} className={"op-pill" + (active ? " active" : "")}>
              <span className="dot" />
              {op}
            </div>
          );
        })}
      </div>

      <div className="status">
        <span className={"chip " + (state.memoryAvailable ? "chip-good" : "chip-warn")}>
          memory: {state.memoryMode}
        </span>
        <span className={"chip " + (state.groqReady ? "chip-good" : "chip-warn")}>
          groq: {state.groqReady ? "on" : "heuristic"}
        </span>
        <span className={"chip " + (state.connected ? "chip-good" : "chip-bad")}>
          {state.connected ? "live" : "offline"}
        </span>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------- Transcript */
export function Transcript({ utterances, title }) {
  const boxRef = useRef();
  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [utterances.length]);

  return (
    <>
      <div className="col-head">
        <h2>Live transcript</h2>
        <span className="muted">{title}</span>
      </div>
      <div className="transcript" ref={boxRef}>
        <AnimatePresence initial={false}>
          {utterances.map((u) => (
            <motion.div
              key={u.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={"bubble" + (u.redacted ? " redacted" : "")}
            >
              <div className="who">
                <span>{u.speaker}</span>
                <span className="t">
                  {new Date(u.ts * 1000).toLocaleTimeString([], {
                    hour: "2-digit", minute: "2-digit", second: "2-digit",
                  })}
                </span>
              </div>
              <div className="said">{u.text}</div>
            </motion.div>
          ))}
        </AnimatePresence>
        {!utterances.length && <div className="empty">Waiting for the conversation to begin…</div>}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- Composer */
export function Composer({ actions }) {
  const [speaker, setSpeaker] = useState("Me");
  const [text, setText] = useState("");
  const send = () => {
    if (!text.trim()) return;
    actions.send(speaker || "Me", text.trim());
    setText("");
  };
  return (
    <div className="composer">
      <div className="composer-row">
        <input
          className="speaker-in"
          value={speaker}
          onChange={(e) => { setSpeaker(e.target.value); actions.setSpeaker(e.target.value); }}
          placeholder="Speaker"
        />
        {actions.micSupported && (
          <button
            className={"btn btn-mic" + (actions.micOn ? " live" : "")}
            onClick={actions.toggleMic}
            title="Speak (Web Speech API)"
          >
            🎙
          </button>
        )}
      </div>
      <div className="composer-row">
        <input
          className="utter-in"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type what was said and hit Enter…"
        />
        <button className="btn btn-primary" onClick={send}>Send</button>
      </div>
      <button className="btn btn-demo" onClick={actions.playDemo}>▶ Play demo negotiation</button>
    </div>
  );
}

/* ------------------------------------------------------------ Intelligence */
export function Intelligence({ state }) {
  const commitments = state.facts.filter(
    (f) => ["commitment", "decision", "risk"].includes(f.type) && !f.redacted
  );
  const timeline = state.facts.filter((f) => !f.redacted);

  return (
    <>
      <div className="col-head">
        <h2>Memory intelligence</h2>
        <span className="muted">contradictions · commitments · timeline</span>
      </div>

      <div className="stat-row">
        <Stat n={state.stats.facts} l="facts" />
        <Stat n={state.stats.commitments} l="commitments" />
        <Stat n={state.stats.decisions} l="decisions" />
        <Stat n={state.stats.contradictions} l="conflicts" alert />
      </div>

      <div className="subhead">⚠ Contradictions across time</div>
      <div className="cards">
        <AnimatePresence initial={false}>
          {state.contradictions.map((c) => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card contra-card"
            >
              <div className="contra-head">
                ⚠ {c.subject}
                <span className="contra-sev">
                  {c.severity} · {Math.round(c.confidence * 100)}%
                </span>
              </div>
              <div className="contra-line">
                <span className="tag">NOW · {c.new_speaker}</span>{c.new_statement}
              </div>
              <div className="contra-line">
                <span className="tag">EARLIER · {c.prior_speaker}</span>{c.prior_statement}
              </div>
              <div className="contra-reason">↳ {c.reason}</div>
            </motion.div>
          ))}
        </AnimatePresence>
        {!state.contradictions.length && (
          <div className="empty">No conflicts yet. Continuum is listening…</div>
        )}
      </div>

      <div className="subhead">✓ Commitments &amp; decisions</div>
      <div className="cards small">
        <AnimatePresence initial={false}>
          {commitments.map((f) => (
            <motion.div
              key={f.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className={"card commit-card " + f.type}
            >
              <span className="ic">{{ commitment: "✓", decision: "◆", risk: "⚠" }[f.type] || "•"}</span>
              <div>
                <span className="who">{f.speaker}</span> · {f.statement}
                {f.value && <b> ({f.value})</b>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {!commitments.length && <div className="empty">No commitments captured yet.</div>}
      </div>

      <div className="subhead">⏱ Temporal timeline</div>
      <div className="timeline">
        {timeline.map((f) => (
          <div key={f.id} className="tl-item">
            <div className="tl-t">t{f.t_index} · {f.type}</div>
            <div>{String(f.value || f.statement).slice(0, 40)}</div>
          </div>
        ))}
        {!timeline.length && <div className="empty">—</div>}
      </div>
    </>
  );
}

function Stat({ n, l, alert }) {
  return (
    <div className={"stat" + (alert ? " stat-alert" : "")}>
      <b>{n}</b>
      <span>{l}</span>
    </div>
  );
}

/* --------------------------------------------------------------- AskBox */
export function AskBox({ state, actions }) {
  const [q, setQ] = useState("");
  const ask = () => { if (q.trim()) actions.ask(q.trim()); };
  return (
    <>
      <div className="subhead">Ask Continuum</div>
      <div className="ask">
        <input
          className="utter-in"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="e.g. What has each side committed to?"
        />
        <button className="btn btn-primary" onClick={ask}>Ask</button>
      </div>
      <div className={"answer" + (state.answer || state.asking ? " show" : "")}>
        {state.asking ? "…thinking" : state.answer}
      </div>
    </>
  );
}

/* ------------------------------------------------------------- ActionBar */
export function ActionBar({ actions, archive, pushToast }) {
  return (
    <footer className="actionbar glass">
      <button className="btn btn-ghost" onClick={actions.forget}>🙈 Off the record · forget()</button>
      <button className="btn btn-ghost" onClick={actions.endCall}>🎓 End call · improve()</button>
      <button className="btn btn-ghost" onClick={actions.newSession}>＋ New session</button>
      <div className="spacer" />
      <div className="archive">
        {archive.map((a) => (
          <div
            key={a.session_id}
            className="ar"
            title={a.summary}
            onClick={() => pushToast(`<b>${a.title}</b><br>${a.summary || "no summary"}`)}
          >
            ↺ {a.title || a.session_id}
          </div>
        ))}
      </div>
    </footer>
  );
}

/* ---------------------------------------------------------------- Toasts */
export function Toasts({ toasts, dismiss }) {
  return (
    <div className="toasts">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className={"toast " + t.kind}
            onClick={() => dismiss(t.id)}
            dangerouslySetInnerHTML={{ __html: t.html }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
