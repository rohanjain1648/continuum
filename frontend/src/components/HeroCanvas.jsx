import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Icosahedron, MeshDistortMaterial, Stars, Float } from "@react-three/drei";
import * as THREE from "three";

function Core() {
  const ref = useRef();
  useFrame((_, d) => {
    if (ref.current) {
      ref.current.rotation.y += d * 0.18;
      ref.current.rotation.x += d * 0.06;
    }
  });
  return (
    <Icosahedron ref={ref} args={[2.3, 4]}>
      <MeshDistortMaterial
        color="#7c5cff"
        emissive="#3a1d8a"
        emissiveIntensity={0.5}
        wireframe
        distort={0.35}
        speed={1.6}
        roughness={0.2}
      />
    </Icosahedron>
  );
}

/* Orbiting "memory nodes" */
function Motes() {
  const group = useRef();
  const motes = useMemo(
    () =>
      Array.from({ length: 26 }, () => ({
        r: 3.2 + Math.random() * 2.6,
        speed: 0.15 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
        y: (Math.random() - 0.5) * 4,
        size: 0.05 + Math.random() * 0.1,
        color: Math.random() > 0.5 ? "#22d3ee" : "#34d399",
      })),
    []
  );
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.children.forEach((m, i) => {
      const o = motes[i];
      const t = clock.elapsedTime * o.speed + o.phase;
      m.position.set(Math.cos(t) * o.r, o.y + Math.sin(t * 1.3) * 0.6, Math.sin(t) * o.r);
    });
  });
  return (
    <group ref={group}>
      {motes.map((m, i) => (
        <mesh key={i}>
          <sphereGeometry args={[m.size, 12, 12]} />
          <meshBasicMaterial color={m.color} />
        </mesh>
      ))}
    </group>
  );
}

export default function HeroCanvas() {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 55 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <ambientLight intensity={0.7} />
      <pointLight position={[6, 6, 6]} intensity={1.4} color="#a78bff" />
      <pointLight position={[-6, -4, -4]} intensity={0.8} color="#22d3ee" />
      <Float speed={1.4} rotationIntensity={0.4} floatIntensity={0.8}>
        <Core />
      </Float>
      <Motes />
      <Stars radius={40} depth={30} count={1200} factor={2.5} fade speed={0.6} />
    </Canvas>
  );
}
