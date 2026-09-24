"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "./useReducedMotion";

// ── Researcher roster ──────────────────────────────────────────────────────
const RESEARCHERS = [
  {
    name: "Francisco Angulo de Lafuente",
    role: "Principal Architect · AI Hardware & Neural Systems",
    bio: "Creator of CHIMERA (43× faster than PyTorch, 88.7% memory reduction) and NEBULA holographic neural networks. Builds physics-based, hardware-agnostic AI architectures using real optical simulations. Winner NVIDIA-LlamaIndex 2024 Contest. Creator of P2PCLAW and OpenCLAW.",
    photo: "https://i1.rgstatic.net/ii/profile.image/11431281248520391-1717228048943_Q128/Francisco-Angulo-Lafuente-3.jpg",
    link: "https://www.researchgate.net/profile/Francisco-Angulo-Lafuente-3",
    badge: "Principal Architect",
  },
  {
    name: "Vladimir Veselov",
    role: "Mathematician · Number Theory & P=NP",
    bio: "Researcher at the Russian Academy of Sciences, Moscow. Specialises in Number Theory, Pure Mathematics and Discrete Mathematics. Currently investigating the P=NP problem — one of the Millennium Prize Problems in computational complexity.",
    photo: "https://i1.rgstatic.net/ii/profile.image/992184916516864-1613566726518_Q128/Vladimir-Veselov.jpg",
    link: "https://www.researchgate.net/profile/Vladimir-Veselov",
    badge: "Mathematics",
  },
  {
    name: "Nirmal Tej",
    role: "Electrical Engineer · Quantum Physics & AI",
    bio: "Dr.Engg.Sc in Nanotechnology. Consultant at ante Inst, USA. Electrical Engineer, Quantum Physicist & AI Researcher. Expert in Informatics, Photonics, Nanotechnology and HPC R&D. Research spans Astrophysics, Biophysics, Space Science and AI.",
    photo: "https://i1.rgstatic.net/ii/profile.image/1176956032827393-1657619593538_Q128/Nirmal-Tej.jpg",
    link: "https://www.researchgate.net/profile/Nirmal-Tej",
    badge: "Quantum Physics",
  },
  {
    name: "Seid Mehammed Abdu",
    role: "Senior Lecturer · AI, Blockchain & Data Science",
    bio: "Senior Lecturer in Computer Science at Woldia University, Ethiopia (MSc CS). Research in AI, Blockchain, federated learning, IoT and mobile technology. Develops low-cost AI solutions for agriculture, health and tourism in emerging markets.",
    photo: "https://i1.rgstatic.net/ii/profile.image/11431281325451907-1743000776898_Q128/Seid-Abdu-4.jpg",
    link: "https://www.researchgate.net/profile/Seid-Abdu-4",
    badge: "Blockchain & AI",
  },
  {
    name: "Guillermo Perry",
    role: "Software Engineer · P2P Infrastructure",
    bio: "Full-stack engineer and P2P protocol developer. Core contributor to the OpenCLAW infrastructure, agent deployment systems and decentralized network tooling.",
    photo: "https://avatars.githubusercontent.com/u/197715?v=4",
    link: "https://github.com/guiperry",
    badge: "Engineering",
  },
  {
    name: "Teerth Sharma",
    role: "AI Agent Developer",
    bio: "Developer specialising in autonomous AI agent systems and decentralized intelligence frameworks within the P2PCLAW ecosystem.",
    photo: "/teerth.jpg",
    link: "https://github.com/teerthsharma",
    badge: "Agent Systems",
  },
];

type Researcher = (typeof RESEARCHERS)[number];

// Triple for a seamless infinite loop (prevents visible gaps on wide screens)
const CAROUSEL_ITEMS = [...RESEARCHERS, ...RESEARCHERS, ...RESEARCHERS];

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("");
}

/** Avatar with a React-state fallback to initials when the photo fails to load. */
function Avatar({ name, photo }: { name: string; photo?: string }) {
  const [failed, setFailed] = useState(false);

  if (!photo || failed) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-muted text-[18px] font-semibold text-muted-foreground"
        aria-hidden="true"
      >
        {initials(name)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo}
      alt={name}
      width={64}
      height={64}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function ResearcherCard({ r, hidden = false, className }: { r: Researcher; hidden?: boolean; className?: string }) {
  return (
    <a
      href={r.link}
      target="_blank"
      rel="noopener noreferrer"
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      className={cn(
        "group flex flex-col items-center rounded-2xl border border-hairline bg-card p-5 text-center shadow-soft transition-shadow duration-300 hover:shadow-lifted",
        className,
      )}
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
        <Avatar name={r.name} photo={r.photo} />
      </div>
      <span className="mt-3 rounded-full bg-surface-alt px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
        {r.badge}
      </span>
      <h3 className="mt-2 text-[15px] font-semibold leading-tight">{r.name}</h3>
      <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{r.role}</p>
      <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-muted-foreground">{r.bio}</p>
    </a>
  );
}

/** Research team: slow marquee, or a static grid when reduced motion is requested. */
export function ResearchTeam() {
  const reduced = useReducedMotion();

  return (
    <section aria-labelledby="research-team" className="bg-background">
      <div className="mx-auto max-w-[1080px] px-5 pt-20 md:pt-28">
        <p className="text-eyebrow text-center">Research Team</p>
        <h2
          id="research-team"
          className="mt-3 text-center text-[36px] font-semibold leading-[1.1] tracking-[-0.03em] md:text-[48px]"
        >
          The people behind the network.
        </h2>
      </div>

      {reduced ? (
        <div className="mx-auto grid max-w-[1080px] grid-cols-1 gap-5 px-5 pb-20 pt-12 sm:grid-cols-2 md:pb-28 lg:grid-cols-3">
          {RESEARCHERS.map((r) => (
            <ResearcherCard key={r.name} r={r} />
          ))}
        </div>
      ) : (
        <div className="relative pb-20 pt-12 md:pb-28">
          {/* Fade edges */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-16 md:w-32"
            style={{ background: "linear-gradient(to right, var(--background), transparent)" }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-16 md:w-32"
            style={{ background: "linear-gradient(to left, var(--background), transparent)" }}
          />
          <div className="overflow-hidden">
            <div className="marquee-track flex gap-5 pr-5">
              {CAROUSEL_ITEMS.map((r, i) => (
                <ResearcherCard
                  key={`${r.name}-${i}`}
                  r={r}
                  hidden={i >= RESEARCHERS.length}
                  className="w-64 shrink-0"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
