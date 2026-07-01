import { useCallback, useEffect, useReducer, useRef, useState } from "react";

/* ------------------------------------------------------------------ api */
const post = (path, body) =>
  fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.json());

/* ------------------------------------------------------------------ state */
const initial = {
  connected: false,
  memoryMode: "…",
  memoryAvailable: false,
  groqReady: false,
  sessionTitle: "—",
  stats: { facts: 0, commitments: 0, decisions: 0, contradictions: 0 },
  utterances: [],
  facts: [],
  contradictions: [],
  graph: { nodes: [], edges: [] },
  archive: [],
  answer: "",
  asking: false,
  ops: {}, // {remember: ts, recall: ts, ...}
};

function reducer(s, a) {
  switch (a.type) {
    case "CONNECTED":
      return { ...s, connected: a.value };
    case "SNAPSHOT": {
      const d = a.data;
      return {
        ...s,
        memoryMode: d.memory.mode,
        memoryAvailable: d.memory.available,
        groqReady: d.groq,
        sessionTitle: d.stats.title || "—",
        stats: d.stats,
        utterances: d.utterances,
        facts: d.facts,
        contradictions: d.contradictions,
        graph: d.graph,
        archive: d.archive || [],
      };
    }
    case "UTTERANCE":
      return { ...s, utterances: [...s.utterances, a.data] };
    case "FACT":
      return { ...s, facts: [...s.facts, a.data] };
    case "CONTRADICTION":
      return { ...s, contradictions: [a.data, ...s.contradictions] };
    case "GRAPH":
      return { ...s, graph: a.data };
    case "STATS":
      return { ...s, stats: a.data, sessionTitle: a.data.title || s.sessionTitle };
    case "OP":
      return { ...s, ops: { ...s.ops, [a.op]: Date.now() } };
    case "ANSWER":
      return { ...s, answer: a.answer, asking: false };
    case "ASKING":
      return { ...s, asking: true, answer: "" };
    case "FORGET":
      return {
        ...s,
        utterances: s.utterances.map((u) =>
          u.id === a.data.utterance_id ? { ...u, redacted: true } : u
        ),
      };
    case "RESET":
      return {
        ...s,
        utterances: [],
        facts: [],
        contradictions: [],
        graph: { nodes: [], edges: [] },
        answer: "",
        sessionTitle: a.data.title || "—",
      };
    default:
      return s;
  }
}

/* ------------------------------------------------------------------ hook */
export function useContinuum() {
  const [state, dispatch] = useReducer(reducer, initial);
  const [toasts, setToasts] = useState([]);
  const [micOn, setMicOn] = useState(false);
  const wsRef = useRef(null);
  const recogRef = useRef(null);
  const speakerRef = useRef("Me");

  const pushToast = useCallback((html, kind = "") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, html, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);
  const dismissToast = useCallback(
    (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    []
  );

  /* ---- websocket ---- */
  useEffect(() => {
    let stop = false;
    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;
      ws.onopen = () => dispatch({ type: "CONNECTED", value: true });
      ws.onclose = () => {
        dispatch({ type: "CONNECTED", value: false });
        if (!stop) setTimeout(connect, 1500);
      };
      ws.onmessage = (ev) => {
        const { type, data } = JSON.parse(ev.data);
        switch (type) {
          case "snapshot": return dispatch({ type: "SNAPSHOT", data });
          case "utterance": return dispatch({ type: "UTTERANCE", data });
          case "fact": return dispatch({ type: "FACT", data });
          case "graph": return dispatch({ type: "GRAPH", data });
          case "stats": return dispatch({ type: "STATS", data });
          case "op": return dispatch({ type: "OP", op: data.op });
          case "answer": return dispatch({ type: "ANSWER", answer: data.answer });
          case "reset": return dispatch({ type: "RESET", data });
          case "contradiction":
            dispatch({ type: "CONTRADICTION", data });
            pushToast(
              `⚠ <b>Contradiction detected</b><br>${esc(data.subject)}: ${esc(data.reason)}`,
              "bad"
            );
            return;
          case "forget":
            dispatch({ type: "FORGET", data });
            pushToast("🙈 <b>Forgotten.</b> Removed from memory &amp; graph.");
            return;
          case "call_ended":
            pushToast(`🎓 <b>Session learned &amp; archived.</b><br>${esc(data.summary || "")}`);
            return;
          default:
            return;
        }
      };
    };
    connect();
    return () => {
      stop = true;
      wsRef.current?.close();
    };
  }, [pushToast]);

  /* ---- Web Speech API ---- */
  const micSupported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const toggleMic = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (!recogRef.current) {
      const r = new SR();
      r.continuous = true;
      r.interimResults = false;
      r.lang = "en-US";
      r.onresult = (e) => {
        const text = e.results[e.results.length - 1][0].transcript.trim();
        if (text) post("/api/utterance", { speaker: speakerRef.current, text });
      };
      r.onend = () => {
        if (recogRef.current?._on) r.start();
      };
      recogRef.current = r;
    }
    const r = recogRef.current;
    r._on = !r._on;
    setMicOn(r._on);
    r._on ? r.start() : r.stop();
  }, []);

  /* ---- actions ---- */
  const actions = {
    setSpeaker: (name) => (speakerRef.current = name || "Me"),
    send: (speaker, text) => post("/api/utterance", { speaker, text }),
    ask: (question) => {
      dispatch({ type: "ASKING" });
      return post("/api/ask", { question });
    },
    forget: () => post("/api/forget"),
    endCall: () => post("/api/end-call"),
    newSession: () =>
      post("/api/new-session", { title: "Live session " + new Date().toLocaleTimeString() }),
    playDemo: () => post("/api/demo/play"),
    toggleMic,
    micOn,
    micSupported: !!micSupported,
  };

  return { state, toasts, dismissToast, pushToast, actions };
}

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}
