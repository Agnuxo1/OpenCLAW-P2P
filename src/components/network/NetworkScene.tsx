"use client";

import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Billboard, Text, Line } from "@react-three/drei";
import { type Mesh } from "three";
import type { Agent } from "@/types/api";
import { RANK_COLORS, RANK_SIZES } from "@/types/network";

// ── Single node mesh ───────────────────────────────────────────────────
function AgentNode({
  agent,
  position,
  pulsePhase,
}: {
  agent: Agent;
  position: [number, number, number];
  pulsePhase: number;
}) {
  const meshRef = useRef<Mesh>(null!);
  const color = RANK_COLORS[agent.rank] ?? "#9a9490";
  const size = (RANK_SIZES[agent.rank] ?? 0.8) * 0.25;
  const isActive = agent.status === "ACTIVE";

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime() + pulsePhase;
    const scale = isActive ? 1 + Math.sin(t * 2) * 0.08 : 1;
    meshRef.current.scale.setScalar(scale);
    // Gentle float
    meshRef.current.position.y = position[1] + Math.sin(t * 0.7) * 0.15;
  });

  return (
    <group position={position}>
      {/* Glow halo (inactive-friendly) */}
      {isActive && (
        <mesh>
          <sphereGeometry args={[size * 2.5, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.04} />
        </mesh>
      )}

      {/* Main sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive ? 0.6 : 0.15}
          roughness={0.3}
          metalness={0.4}
        />
      </mesh>

      {/* Label */}
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <Text
          position={[0, size + 0.18, 0]}
          fontSize={0.12}
          color={color}
          anchorX="center"
          anchorY="bottom"
        >
          {agent.name.slice(0, 16)}
        </Text>
      </Billboard>
    </group>
  );
}

// ── Edge line between two nodes ─────────────────────────────────────────
function Edge({
  from,
  to,
  opacity = 0.15,
}: {
  from: [number, number, number];
  to: [number, number, number];
  opacity?: number;
}) {
  const points = useMemo(() => [from, to], [from, to]);

  return (
    <Line
      points={points}
      color="#ff4e1a"
      lineWidth={1}
      transparent
      opacity={opacity}
    />
  );
}

// ── Camera auto-rotate setup ────────────────────────────────────────────
function CameraController() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 5, 18);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
}

// ── Main scene ──────────────────────────────────────────────────────────
function Scene({ agents }: { agents: Agent[] }) {
  // Layout agents in a spherical arrangement
  const positions = useMemo<[number, number, number][]>(() => {
    if (!agents.length) return [];
    const PHI = Math.PI * (3 - Math.sqrt(5)); // golden angle
    return agents.map((_, i) => {
      const y = 1 - (i / Math.max(agents.length - 1, 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = PHI * i;
      const spread = Math.max(6, agents.length * 0.8);
      return [r * Math.cos(theta) * spread, y * spread * 0.6, r * Math.sin(theta) * spread];
    });
  }, [agents]);

  const pulsePhases = useMemo(
    () => agents.map(() => Math.random() * Math.PI * 2),
    [agents],
  );

  // Build a sparse set of edges (active agents to nearby agents)
  const edges = useMemo(() => {
    const result: Array<{ from: [number, number, number]; to: [number, number, number] }> = [];
    const maxEdges = Math.min(agents.length * 2, 40);
    const active = agents.filter((a) => a.status === "ACTIVE");
    for (let i = 0; i < active.length && result.length < maxEdges; i++) {
      const fromIdx = agents.indexOf(active[i]);
      // Connect to next 1-2 agents
      for (let j = 1; j <= 2; j++) {
        const toIdx = (fromIdx + j) % agents.length;
        if (positions[fromIdx] && positions[toIdx]) {
          result.push({ from: positions[fromIdx], to: positions[toIdx] });
        }
      }
    }
    return result;
  }, [agents, positions]);

  return (
    <>
      <CameraController />
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 10, 10]} intensity={0.8} color="#ff4e1a" />
      <pointLight position={[-10, -5, -10]} intensity={0.3} color="#448aff" />

      <Stars
        radius={80}
        depth={50}
        count={2000}
        factor={2}
        saturation={0}
        fade
      />

      {/* Edges */}
      {edges.map((e, i) => (
        <Edge key={i} from={e.from} to={e.to} />
      ))}

      {/* Nodes */}
      {agents.map((agent, i) =>
        positions[i] ? (
          <AgentNode
            key={agent.id}
            agent={agent}
            position={positions[i]}
            pulsePhase={pulsePhases[i]}
          />
        ) : null,
      )}
    </>
  );
}

// ── Exported component ──────────────────────────────────────────────────
export function NetworkScene({ agents }: { agents: Agent[] }) {
  return (
    <Canvas
      camera={{ position: [0, 5, 18], fov: 60 }}
      style={{ background: "#0c0c0d" }}
      gl={{ antialias: true, alpha: false }}
    >
      <Scene agents={agents} />
      <OrbitControls
        enablePan={false}
        enableZoom
        autoRotate
        autoRotateSpeed={0.4}
        minDistance={5}
        maxDistance={40}
      />
    </Canvas>
  );
}
