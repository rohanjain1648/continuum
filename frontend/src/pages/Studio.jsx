import { Link } from "react-router-dom";
import { useContinuum } from "../lib/useContinuum.js";
import Graph3D from "../components/Graph3D.jsx";
import {
  TopBar, Transcript, Composer, Intelligence, AskBox, ActionBar, Toasts,
} from "../components/StudioPanels.jsx";

export default function Studio() {
  const { state, toasts, dismissToast, pushToast, actions } = useContinuum();

  return (
    <div className="studio">
      <div className="studio-aurora" />

      <div className="studio-topwrap">
        <Link to="/" className="home-btn" title="Back to landing">←</Link>
        <TopBar state={state} />
      </div>

      <main className="grid">
        <section className="col glass">
          <Transcript utterances={state.utterances} title={state.sessionTitle} />
          <Composer actions={actions} />
        </section>

        <section className="col glass">
          <Intelligence state={state} />
        </section>

        <section className="col glass">
          <div className="col-head">
            <h2>Knowledge graph · 3D</h2>
            <span className="muted">hybrid graph + vector</span>
          </div>
          <Graph3D graph={state.graph} />
          <AskBox state={state} actions={actions} />
        </section>
      </main>

      <ActionBar actions={actions} archive={state.archive} pushToast={pushToast} />
      <Toasts toasts={toasts} dismiss={dismissToast} />
    </div>
  );
}
