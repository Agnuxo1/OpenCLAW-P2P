"use client";

import { useRef, useMemo, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { Agent } from "@/types/api";
import { RANK_COLORS } from "@/types/network";

/* ── Constants ─────────────────────────────────────────────────────── */
const MAX_NODES = 80;
const SPHERE_RADIUS = 7;
const NODE_BASE_SIZE = 0.4;
const CONNECTION_OPACITY = 0.2;
const WOBBLE_SPEED = 0.3;
const WOBBLE_AMP = 0.12;
const SPRING_K = 0.002;
const DAMPING = 0.96;
const REPULSION = 0.8;
const CONNECTION_DIST = 5.0;

/* ── Types ─────────────────────────────────────────────────────────── */
interface NodeData {
  id: string;
  rank: string;
  active: boolean;
  size: number;
  color: THREE.Color;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  target: THREE.Vector3;
  phase: number;
}

interface EdgeData {
  a: number;
  b: number;
}

/* ── Helpers ───────────────────────────────────────────────────────── */
function rankSize(rank: string): number {
  switch (rank) {
    case "DIRECTOR":    return 0.8;
    case "ARCHITECT":   return 0.65;
    case "RESEARCHER":  return 0.5;
    case "ANALYST":     return 0.42;
    default:            return NODE_BASE_SIZE;
  }
}

function fibonacciSphere(i: number, n: number, radius: number): THREE.Vector3 {
  const golden = (1 + Math.sqrt(5)) / 2;
  const theta = (2 * Math.PI * i) / golden;
  const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/* ── Set background color ──────────────────────────────────────────── */
function Background() {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color("#0c0c0d");
  }, [scene]);
  return null;
}

/* ── Bubbles (InstancedMesh) ───────────────────────────────────────── */
function Bubbles({ nodes }: { nodes: NodeData[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Set per-instance colors
  useEffect(() => {
    if (!meshRef.current || nodes.length === 0) return;
    for (let i = 0; i < nodes.length; i++) {
      meshRef.current.setColorAt(i, nodes[i].color);
      // Initialize positions
      dummy.position.copy(nodes[i].pos);
      dummy.scale.setScalar(nodes[i].size);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [nodes, dummy]);

  useFrame(() => {
    if (!meshRef.current || nodes.length === 0) return;
    const t = performance.now() * 0.001;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];

      // Spring toward target
      n.vel.x += (n.target.x - n.pos.x) * SPRING_K;
      n.vel.y += (n.target.y - n.pos.y) * SPRING_K;
      n.vel.z += (n.target.z - n.pos.z) * SPRING_K;

      // Soft repulsion from nearby nodes
      for (let j = i + 1; j < nodes.length; j++) {
        const o = nodes[j];
        const rx = n.pos.x - o.pos.x;
        const ry = n.pos.y - o.pos.y;
        const rz = n.pos.z - o.pos.z;
        const d2 = rx * rx + ry * ry + rz * rz;
        if (d2 < 4 && d2 > 0.01) {
          const f = REPULSION / d2 * 0.016;
          n.vel.x += rx * f;
          n.vel.y += ry * f;
          n.vel.z += rz * f;
          o.vel.x -= rx * f;
          o.vel.y -= ry * f;
          o.vel.z -= rz * f;
        }
      }

      n.vel.multiplyScalar(DAMPING);
      n.pos.add(n.vel);

      // Organic wobble
      const wobbleT = t * WOBBLE_SPEED + n.phase;
      const wx = Math.sin(wobbleT * 1.3) * WOBBLE_AMP;
      const wy = Math.cos(wobbleT * 0.9) * WOBBLE_AMP;
      const wz = Math.sin(wobbleT * 1.1 + 1.5) * WOBBLE_AMP;

      // Breathe: subtle scale pulse
      const breathe = 1 + Math.sin(wobbleT * 0.7) * 0.06;
      const s = n.size * breathe;

      dummy.position.set(n.pos.x + wx, n.pos.y + wy, n.pos.z + wz);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, nodes.length]} frustumCulled={false}>
      <sphereGeometry args={[1, 24, 24]} />
      <meshStandardMaterial
        metalness={0.3}
        roughness={0.15}
        transparent
        opacity={0.88}
        toneMapped={false}
        emissive="#ffffff"
        emissiveIntensity={0.15}
      />
    </instancedMesh>
  );
}

/* ── Glow shells (additive outer halo) ─────────────────────────────── */
function GlowShells({ nodes }: { nodes: NodeData[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!meshRef.current || nodes.length === 0) return;
    for (let i = 0; i < nodes.length; i++) {
      const c = nodes[i].color;
      meshRef.current.setColorAt(i, new THREE.Color(c.r * 0.4, c.g * 0.4, c.b * 0.4));
      dummy.position.copy(nodes[i].pos);
      dummy.scale.setScalar(nodes[i].size * 1.6);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [nodes, dummy]);

  useFrame(() => {
    if (!meshRef.current || nodes.length === 0) return;
    const t = performance.now() * 0.001;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const wobbleT = t * WOBBLE_SPEED + n.phase;
      const wx = Math.sin(wobbleT * 1.3) * WOBBLE_AMP;
      const wy = Math.cos(wobbleT * 0.9) * WOBBLE_AMP;
      const wz = Math.sin(wobbleT * 1.1 + 1.5) * WOBBLE_AMP;
      const breathe = 1 + Math.sin(wobbleT * 0.7) * 0.06;
      const s = n.size * breathe * 1.6;

      dummy.position.set(n.pos.x + wx, n.pos.y + wy, n.pos.z + wz);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const pulse = 0.25 + Math.sin(wobbleT * 0.5) * 0.15;
      const c = nodes[i].color;
      meshRef.current.setColorAt(i, new THREE.Color(c.r * pulse, c.g * pulse, c.b * pulse));
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, nodes.length]} frustumCulled={false}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial
        transparent
        opacity={0.22}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}

/* ── Elastic connections ───────────────────────────────────────────── */
function Connections({ nodes, edges }: { nodes: NodeData[]; edges: EdgeData[] }) {
  const ref = useRef<THREE.BufferGeometry>(null!);
  const posArr = useMemo(() => new Float32Array(edges.length * 6), [edges.length]);

  useFrame(() => {
    if (!ref.current || edges.length === 0) return;
    for (let i = 0; i < edges.length; i++) {
      const a = nodes[edges[i].a];
      const b = nodes[edges[i].b];
      posArr[i * 6]     = a.pos.x;
      posArr[i * 6 + 1] = a.pos.y;
      posArr[i * 6 + 2] = a.pos.z;
      posArr[i * 6 + 3] = b.pos.x;
      posArr[i * 6 + 4] = b.pos.y;
      posArr[i * 6 + 5] = b.pos.z;
    }
    const attr = ref.current.getAttribute("position") as THREE.BufferAttribute;
    if (attr) {
      (attr.array as Float32Array).set(posArr);
      attr.needsUpdate = true;
    }
  });

  return (
    <lineSegments frustumCulled={false}>
      <bufferGeometry ref={ref}>
        <bufferAttribute
          attach="attributes-position"
          args={[posArr, 3]}
          count={edges.length * 2}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color="#ff4e1a"
        transparent
        opacity={CONNECTION_OPACITY}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

/* ── Ambient particles ─────────────────────────────────────────────── */
function AmbientParticles({ count = 200 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null!);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 15 + Math.random() * 10;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.cos(phi);
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, [count]);

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.01;
  });

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
      </bufferGeometry>
      <pointsMaterial
        color="#ff4e1a"
        size={0.08}
        transparent
        opacity={0.4}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

/* ── Fallback: single visible mesh when no agents loaded ───────────── */
function CenterGlow() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.5;
  });
  return (
    <mesh ref={ref} frustumCulled={false}>
      <icosahedronGeometry args={[0.5, 2]} />
      <meshStandardMaterial color="#ff4e1a" emissive="#ff4e1a" emissiveIntensity={0.3} wireframe />
    </mesh>
  );
}

/* ── Scene internals (inside Canvas) ───────────────────────────────── */
function SceneContent({ agents }: { agents: Agent[] }) {
  const { nodes, edges } = useMemo(() => {
    const count = Math.min(agents.length, MAX_NODES);
    if (count === 0) return { nodes: [] as NodeData[], edges: [] as EdgeData[] };

    const n: NodeData[] = agents.slice(0, count).map((a, i) => {
      const pos = fibonacciSphere(i, count, SPHERE_RADIUS);
      const rankColor = RANK_COLORS[a.rank as keyof typeof RANK_COLORS] ?? "#9a9490";
      // Idle nodes get a dim tinted version of their rank color
      const color = new THREE.Color(a.status === "ACTIVE" ? rankColor : "#3a3835");
      if (a.status !== "ACTIVE") {
        // Tint idle nodes slightly toward their rank color
        const tint = new THREE.Color(rankColor);
        color.lerp(tint, 0.15);
      }
      return {
        id: a.id,
        rank: a.rank,
        active: a.status === "ACTIVE",
        size: rankSize(a.rank),
        color,
        pos: pos.clone(),
        vel: new THREE.Vector3(),
        target: pos.clone(),
        phase: Math.random() * Math.PI * 2,
      };
    });

    const e: EdgeData[] = [];
    for (let i = 0; i < n.length; i++) {
      for (let j = i + 1; j < n.length; j++) {
        if (n[i].target.distanceTo(n[j].target) < CONNECTION_DIST) {
          e.push({ a: i, b: j });
        }
      }
    }
    return { nodes: n, edges: e };
  }, [agents]);

  return (
    <>
      <Background />
      <ambientLight intensity={0.8} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#ff8855" />
      <pointLight position={[-8, -5, 8]} intensity={0.8} color="#4488ff" />
      <pointLight position={[0, -10, 0]} intensity={0.5} color="#9a9490" />

      {nodes.length > 0 ? (
        <>
          <Bubbles nodes={nodes} />
          <GlowShells nodes={nodes} />
          <Connections nodes={nodes} edges={edges} />
        </>
      ) : (
        <CenterGlow />
      )}

      <AmbientParticles />

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        autoRotate
        autoRotateSpeed={0.3}
        minDistance={5}
        maxDistance={35}
      />
    </>
  );
}

/* ── Public export ─────────────────────────────────────────────────── */
export function NetworkScene({ agents }: { agents: Agent[] }) {
  const onCreated = useCallback((state: { gl: THREE.WebGLRenderer }) => {
    state.gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    state.gl.setClearColor(new THREE.Color("#0c0c0d"), 1);
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 3, 14], fov: 60 }}
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        powerPreference: "default",
      }}
      onCreated={onCreated}
    >
      <SceneContent agents={agents} />
    </Canvas>
  );
}
