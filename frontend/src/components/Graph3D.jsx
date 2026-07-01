import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Billboard, Text, Line, Stars } from "@react-three/drei";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
} from "d3-force-3d";
import * as THREE from "three";

const COLORS = {
  speaker: "#7c5cff",
  subject: "#22d3ee",
  commitment: "#34d399",
  decision: "#60a5fa",
  number: "#fbbf24",
  claim: "#94a0c0",
  risk: "#fb923c",
  date: "#22d3ee",
  preference: "#a78bff",
  question: "#94a0c0",
};

const SIZE = { speaker: 1.15, subject: 0.85 };
const SCALE = 0.22;

/* Run a 3D force simulation once per graph update. */
function useLayout(graph) {
  return useMemo(() => {
    const nodes = graph.nodes.map((n) => ({ ...n }));
    const links = graph.edges.map((e) => ({
      source: e.from,
      target: e.to,
      contradiction: !!e.contradiction,
    }));
    if (nodes.length) {
      const sim = forceSimulation(nodes, 3)
        .force("charge", forceManyBody().strength(-170))
        .force("link", forceLink(links).id((d) => d.id).distance(34).strength(0.75))
        .force("center", forceCenter(0, 0, 0))
        .stop();
      for (let i = 0; i < 300; i++) sim.tick();
    }
    const pos = (n) => [n.x * SCALE, n.y * SCALE, n.z * SCALE];
    const map = new Map(nodes.map((n) => [n.id, pos(n)]));
    const edges = links
      .map((l) => ({
        a: map.get(typeof l.source === "object" ? l.source.id : l.source),
        b: map.get(typeof l.target === "object" ? l.target.id : l.target),
        contradiction: l.contradiction,
      }))
      .filter((e) => e.a && e.b);
    return { nodes: nodes.map((n) => ({ ...n, pos: pos(n) })), edges };
  }, [graph]);
}

function Node({ node }) {
  const ref = useRef();
  const seed = useMemo(() => Math.random() * 10, []);
  const color = node.conflict ? "#fb7185" : COLORS[node.group] || "#94a0c0";
  const size = SIZE[node.group] || 0.55;

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y =
        node.pos[1] + Math.sin(clock.elapsedTime * 0.8 + seed) * 0.14;
    }
  });

  return (
    <group ref={ref} position={node.pos}>
      <mesh>
        <sphereGeometry args={[size, 28, 28]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={node.conflict ? 1.1 : 0.45}
          roughness={0.25}
          metalness={0.5}
        />
      </mesh>
      {node.conflict && (
        <mesh>
          <sphereGeometry args={[size * 1.5, 20, 20]} />
          <meshBasicMaterial color="#fb7185" transparent opacity={0.14} />
        </mesh>
      )}
      <Billboard position={[0, size + 0.55, 0]}>
        <Text
          fontSize={node.group === "speaker" ? 0.62 : 0.44}
          color={node.conflict ? "#ffd5dc" : "#dfe4f2"}
          anchorX="center"
          anchorY="middle"
          maxWidth={6}
          outlineWidth={0.012}
          outlineColor="#05060d"
        >
          {String(node.label).slice(0, 26)}
        </Text>
      </Billboard>
    </group>
  );
}

function Scene({ graph }) {
  const { nodes, edges } = useLayout(graph);
  return (
    <>
      <color attach="background" args={["#05060f"]} />
      <fog attach="fog" args={["#05060f", 22, 60]} />
      <ambientLight intensity={0.65} />
      <pointLight position={[12, 14, 12]} intensity={1.4} color="#a78bff" />
      <pointLight position={[-12, -8, -10]} intensity={0.9} color="#22d3ee" />
      <Stars radius={70} depth={45} count={1600} factor={3.5} fade speed={0.8} />

      {edges.map((e, i) => (
        <Line
          key={i}
          points={[e.a, e.b]}
          color={e.contradiction ? "#fb7185" : "#39406a"}
          lineWidth={e.contradiction ? 2.4 : 1}
          dashed={e.contradiction}
          dashSize={0.5}
          gapSize={0.28}
          transparent
          opacity={e.contradiction ? 0.95 : 0.4}
        />
      ))}

      {nodes.map((n) => (
        <Node key={n.id} node={n} />
      ))}

      <OrbitControls
        autoRotate
        autoRotateSpeed={0.55}
        enablePan={false}
        minDistance={6}
        maxDistance={55}
      />
    </>
  );
}

export default function Graph3D({ graph }) {
  const empty = !graph.nodes.length;
  return (
    <div className="graph3d">
      <Canvas camera={{ position: [0, 2, 22], fov: 55 }} dpr={[1, 2]}>
        <Scene graph={graph} />
      </Canvas>
      {empty && (
        <div className="graph3d-empty">
          The knowledge graph builds itself as the conversation unfolds…
        </div>
      )}
      <div className="graph3d-hint">drag to orbit · scroll to zoom</div>
    </div>
  );
}
