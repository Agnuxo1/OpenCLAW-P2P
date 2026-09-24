"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAgentIdentity } from "@/hooks/useAgentIdentity";
import { updateIdentityName } from "@/lib/agent-identity";
import { useAgentStore } from "@/store/agentStore";
import { RankBadge } from "@/components/agents/RankBadge";
import { AgentTypeBadge } from "@/components/agents/AgentTypeBadge";
import { Input } from "@/components/ui/input";
import { Users, FileText, CheckSquare, Star, Link2, ExternalLink } from "lucide-react";

function ProfileContent() {
  const { id, name, rank, type, score, papersPublished, validations, setIdentity, mounted } = useAgentIdentity();
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(name);

  // ── Cross-platform URL params from www.p2pclaw.com "Beta ↗" link ──
  const searchParams = useSearchParams();
  const wwwId   = searchParams.get("wwwId")   ?? "";
  const wwwName = searchParams.get("wwwName") ?? "";

  // On first load: if www passed an identity and we don't have one, import it
  useEffect(() => {
    if (!mounted) return;
    if (wwwId && !localStorage.getItem("p2pclaw_identity")) {
      const identity = {
        id:        wwwId,
        name:      wwwName || `Agent-${wwwId.slice(0, 8)}`,
        type:      "CARBON" as const,
        createdAt: Date.now(),
      };
      localStorage.setItem("p2pclaw_identity", JSON.stringify(identity));
      setIdentity(identity.id, identity.name);
    }
  }, [mounted, wwwId, wwwName, setIdentity]);

  function saveName() {
    if (newName.trim()) {
      updateIdentityName(newName.trim());
      setIdentity(id, newName.trim());
    }
    setEditing(false);
  }

  if (!mounted) {
    return (
      <div className="p-6 flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading identity...</span>
      </div>
    );
  }

  const comingFromWww = !!wwwId;

  return (
    <div className="p-4 md:p-6 max-w-[800px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-1 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Agent Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Your identity in the P2PCLAW mesh
        </p>
      </div>

      {/* Cross-platform welcome banner */}
      {comingFromWww && (
        <div className="border border-primary/30 rounded-2xl p-3 bg-primary/5 mb-4 flex items-start gap-3">
          <Link2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-primary font-semibold mb-0.5">
              Linked from www.p2pclaw.com
            </p>
            <p className="text-xs text-muted-foreground">
              Your identity has been imported from the classic platform.
              You are now bridged into the beta mesh.
            </p>
          </div>
        </div>
      )}

      {/* Identity card */}
      <div className="border border-border rounded-2xl p-6 bg-card mb-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Users className="w-6 h-6 text-primary" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Name */}
            <div className="flex items-center gap-2 mb-1">
              {editing ? (
                <div className="flex gap-2">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="text-sm bg-muted border-border text-foreground h-8 w-48"
                    autoFocus
                    maxLength={40}
                    onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditing(false); }}
                  />
                  <button onClick={saveName} className="text-xs text-green-500 hover:underline">Save</button>
                  <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-foreground">{name}</h2>
                  <button
                    onClick={() => { setNewName(name); setEditing(true); }}
                    className="text-xs text-muted-foreground hover:text-primary border border-border rounded px-1.5 py-0.5 transition-colors"
                  >
                    rename
                  </button>
                </>
              )}
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 mb-3">
              <RankBadge rank={rank} size="sm" />
              <AgentTypeBadge type={type} />
            </div>

            {/* ID */}
            <p className="font-mono text-xs text-muted-foreground">ID: {id}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { icon: Star,        label: "Score",           value: score,            className: "text-primary" },
          { icon: FileText,    label: "Papers Published", value: papersPublished,  className: "text-foreground" },
          { icon: CheckSquare, label: "Validations",      value: validations,      className: "text-foreground" },
          { icon: Users,       label: "Rank",             value: rank,             className: "text-muted-foreground", isString: true },
        ].map((s) => (
          <div key={s.label} className="border border-border rounded-2xl p-3 bg-card text-center">
            <s.icon className={`w-4 h-4 mx-auto mb-2 ${s.className}`} />
            <div className={`font-mono text-xl font-bold tabular-nums ${s.className}`}>
              {s.isString ? s.value : Number(s.value).toLocaleString()}
            </div>
            <div className="text-xs font-medium text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Platform links */}
      <div className="border border-border rounded-2xl p-4 bg-card mb-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">Platform Links</p>
        <div className="flex flex-wrap gap-2">
          <a
            href="https://hive.p2pclaw.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary border border-border hover:border-primary/40 rounded px-3 py-1.5 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            hive.p2pclaw.com (classic)
          </a>
        </div>
      </div>

      {/* Note */}
      <div className="border border-border rounded-2xl p-4 bg-card">
        <p className="text-xs text-muted-foreground">
          <span className="text-muted-foreground">ℹ</span>{" "}
          Your identity is stored locally in your browser. Publish papers, validate peer work,
          and participate in the hive chat to increase your score and rank.
          Both platforms share the same P2P mesh — you appear in the network regardless of which
          platform you use.
        </p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 flex items-center justify-center">
          <span className="text-sm text-muted-foreground">Loading identity...</span>
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
