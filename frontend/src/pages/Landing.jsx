import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import HeroCanvas from "../components/HeroCanvas.jsx";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { show: { transition: { staggerChildren: 0.09 } } };

const flowPulse = {
  hidden: { opacity: 0, y: 28 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      delay: i * 0.08,
    },
  }),
  pulse: {
    boxShadow: [
      "0 0 0 0 rgba(124, 92, 255, 0.3)",
      "0 0 30px 8px rgba(124, 92, 255, 0.1)",
      "0 0 0 0 rgba(124, 92, 255, 0)",
    ],
    transition: {
      duration: 2.5,
      repeat: Infinity,
      delay: 0,
    },
  },
};

const OPS = [
  { k: "remember", c: "#7c5cff", d: "Ingest every utterance into a hybrid graph + vector store with temporal cognification — events get real timestamps." },
  { k: "recall", c: "#22d3ee", d: "Auto-routed retrieval across the graph. Powers contradiction lookups and natural-language Q&A over the whole conversation." },
  { k: "improve", c: "#34d399", d: "On call-end, session memory is promoted to permanent and the graph is enriched — continual learning across infinite sessions." },
  { k: "forget", c: "#fb7185", d: "Say “off the record” and Continuum surgically prunes the statement from both memory and the live graph. GDPR-ready." },
];

const FEATURES = [
  { icon: "⚡", t: "Real-time", d: "Live transcript → live graph → live alerts over WebSocket. Nothing is batch." },
  { icon: "🧠", t: "Temporal memory", d: "Events, timestamps and before/after relations — ask “what changed since March?”." },
  { icon: "⚠️", t: "Contradiction radar", d: "The instant someone reverses a number or a promise, Continuum flags it with evidence." },
  { icon: "🌐", t: "3D knowledge graph", d: "A living force-directed graph of speakers, subjects and facts you can orbit in 3D." },
  { icon: "♾️", t: "Cross-session recall", d: "Reopen last week’s call and pick up exactly where the memory left off." },
  { icon: "🎙️", t: "Any input", d: "Browser mic (Web Speech), typed transcript, or a scripted demo — all wired." },
];

const STEPS = [
  { n: "01", t: "Listen", d: "Mic or transcript streams in, speaker-tagged." },
  { n: "02", t: "Remember", d: "Cognee ingests it into the temporal graph." },
  { n: "03", t: "Reason", d: "Groq extracts commitments, decisions & claims." },
  { n: "04", t: "Detect", d: "New facts are checked against the past for conflicts." },
  { n: "05", t: "Surface", d: "Alerts, timeline & 3D graph update instantly." },
];

export default function Landing() {
  return (
    <div className="landing">
      <div className="landing-aurora" />

      {/* nav */}
      <nav className="l-nav">
        <div className="l-brand">
          <span className="l-logo">∞</span> Continuum
        </div>
        <div className="l-nav-links">
          <a href="#how">How it works</a>
          <a href="#ops">Operations</a>
          <a href="#features">Features</a>
          <Link to="/studio" className="l-cta-sm">Launch Studio →</Link>
        </div>
      </nav>

      {/* hero */}
      <header className="l-hero">
        <div className="l-hero-canvas">
          <HeroCanvas />
        </div>
        <motion.div
          className="l-hero-copy"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={fadeUp} className="l-pill">
            🍸 The Hangover Part AI · WeMakeDevs × Cognee
          </motion.div>
          <motion.h1 variants={fadeUp} className="l-title">
            Give your AI a memory that <span className="grad">never forgets last night</span>.
          </motion.h1>
          <motion.p variants={fadeUp} className="l-sub">
            Continuum listens to a live conversation, builds a <b>temporal knowledge graph</b> as
            it’s spoken, and catches forgotten commitments and <b>contradictions across time</b> the
            instant they happen. Powered by <b>Cognee</b> memory + <b>Groq</b> reasoning.
          </motion.p>
          <motion.div variants={fadeUp} className="l-hero-actions">
            <Link to="/studio" className="l-cta">Launch the Studio</Link>
            <a className="l-ghost" href="#how">See how it works</a>
          </motion.div>
          <motion.div variants={fadeUp} className="l-stack">
            <span>Cognee</span><i>·</i><span>Groq</span><i>·</i><span>FastAPI</span>
            <i>·</i><span>React Three Fiber</span>
          </motion.div>
        </motion.div>
      </header>

      {/* problem */}
      <Section>
        <div className="l-problem">
          <motion.h2 variants={fadeUp} className="l-h2">
            AI agents wake up in Vegas with <span className="grad-bad">no memory of the deal they made</span>.
          </motion.h2>
          <motion.p variants={fadeUp} className="l-p">
            Every new session, the context is gone. Promises evaporate. Numbers drift. Decisions get
            silently reversed. Continuum is the memory layer that remembers, recalls, improves — and
            forgets on command — so nothing said ever slips through the cracks.
          </motion.p>
        </div>
      </Section>

      {/* how it works */}
      <Section id="how">
        <motion.h2 variants={fadeUp} className="l-h2 center">The live loop</motion.h2>
        <motion.p variants={fadeUp} className="l-p center">
          Four steps, running continuously, sub-second on the hot path.
        </motion.p>
        <div className="l-steps-container">
          <svg className="l-steps-arrows" viewBox="0 0 1200 200" preserveAspectRatio="none">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <polygon points="0 0, 10 3, 0 6" fill="#7c5cff" />
              </marker>
            </defs>
            {[0, 1, 2, 3].map((i) => (
              <motion.line
                key={`arrow-${i}`}
                x1={`${(i + 1) * 20}%`}
                y1="50%"
                x2={`${(i + 1) * 20 + 14}%`}
                y2="50%"
                stroke="#7c5cff"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
                opacity="0.4"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 0.6 }}
                transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity, repeatDelay: 2.5 }}
              />
            ))}
          </svg>
          <motion.div className="l-steps" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: false, amount: 0.3 }}>
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                variants={flowPulse}
                custom={i}
                className="l-step glass"
                animate={i === 0 ? "pulse" : ""}
              >
                <div className="l-step-n">{s.n}</div>
                <div className="l-step-t">{s.t}</div>
                <div className="l-step-d">{s.d}</div>
                <motion.div
                  className="l-step-pulse-ring"
                  animate={{ scale: [1, 1.15, 1], opacity: [1, 0.3, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>

      {/* operations */}
      <Section id="ops">
        <motion.h2 variants={fadeUp} className="l-h2 center">Cognee’s four operations, as core mechanics</motion.h2>
        <motion.div variants={stagger} className="l-ops">
          {OPS.map((o) => (
            <motion.div key={o.k} variants={fadeUp} className="l-op glass" style={{ "--oc": o.c }}>
              <div className="l-op-dot" />
              <div className="l-op-k">{o.k}()</div>
              <div className="l-op-d">{o.d}</div>
            </motion.div>
          ))}
        </motion.div>
      </Section>

      {/* features */}
      <Section id="features">
        <motion.h2 variants={fadeUp} className="l-h2 center">Everything, in real time</motion.h2>
        <motion.div variants={stagger} className="l-features">
          {FEATURES.map((f) => (
            <motion.div key={f.t} variants={fadeUp} className="l-feat glass">
              <div className="l-feat-ic">{f.icon}</div>
              <div className="l-feat-t">{f.t}</div>
              <div className="l-feat-d">{f.d}</div>
            </motion.div>
          ))}
        </motion.div>
      </Section>

      {/* final cta */}
      <Section>
        <motion.div variants={fadeUp} className="l-final glass">
          <h2 className="l-h2">Total recall. Four operations.</h2>
          <p className="l-p">Spin up the Studio and watch memory build itself, live and in 3D.</p>
          <Link to="/studio" className="l-cta">Launch the Studio →</Link>
        </motion.div>
      </Section>

      <footer className="l-footer">
        <span>∞ Continuum</span>
        <span>Built for The Hangover Part AI — WeMakeDevs × Cognee · powered by Groq</span>
      </footer>
    </div>
  );
}

function Section({ children, id }) {
  return (
    <motion.section
      id={id}
      className="l-section"
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
    >
      {children}
    </motion.section>
  );
}
