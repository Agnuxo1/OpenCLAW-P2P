"use client";

import { useState, useEffect } from "react";
import { useMempool } from "@/hooks/useMempool";
import { useAgentStore } from "@/store/agentStore";
import { validatePaper } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { ThumbsUp, ThumbsDown, Clock, CheckCircle, Inbox } from "lucide-react";
import type { Paper } from "@/types/api";

const VOTES_PER_DAY = 3;
const STORAGE_KEY = "p2pclaw-votes";

interface VoteRecord {
  date: string; // YYYY-MM-DD
  count: number;
  voted: string[]; // paper IDs voted on today
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadVoteRecord(): VoteRecord {
  if (typeof window === "undefined") return { date: getTodayKey(), count: 0, voted: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: getTodayKey(), count: 0, voted: [] };
    const rec: VoteRecord = JSON.parse(raw);
    if (rec.date !== getTodayKey()) return { date: getTodayKey(), count: 0, voted: [] };
    return rec;
  } catch {
    return { date: getTodayKey(), count: 0, voted: [] };
  }
}

function saveVoteRecord(rec: VoteRecord) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
}

interface MempoolVoteCardProps {
  paper: Paper;
  alreadyVoted: boolean;
  votesLeft: number;
  onVote: (paperId: string, result: boolean) => Promise<void>;
}

function MempoolVoteCard({ paper, alreadyVoted, votesLeft, onVote }: MempoolVoteCardProps) {
  const [voting, setVoting] = useState<"validate" | "reject" | null>(null);
  const [done, setDone] = useState(alreadyVoted);

  async function handleVote(result: boolean) {
    if (done || votesLeft === 0) return;
    setVoting(result ? "validate" : "reject");
    try {
      await onVote(paper.id, result);
      setDone(true);
    } finally {
      setVoting(null);
    }
  }

  const canVote = !done && votesLeft > 0;

  return (
    <div className="border border-[#2c2c30] rounded-lg p-4 bg-[#0c0c0d]">
      {/* Title */}
      <p className="font-mono text-xs font-semibold text-[#f5f0eb] mb-1 line-clamp-2 leading-snug">
        {paper.title}
      </p>
      <p className="font-mono text-[10px] text-[#52504e] mb-3">
        by {paper.author}
      </p>

      {/* Validation progress */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1 bg-[#1a1a1c] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#ff4e1a] transition-all"
            style={{ width: `${Math.min(100, (paper.validations / 3) * 100)}%` }}
          />
        </div>
        <span className="font-mono text-[10px] text-[#52504e]">
          {paper.validations}/3
        </span>
      </div>

      {/* Vote buttons */}
      {done ? (
        <div className="flex items-center gap-1.5 text-[#4caf50] font-mono text-[10px]">
          <CheckCircle className="w-3 h-3" />
          Vote registered
        </div>
      ) : votesLeft === 0 ? (
        <div className="flex items-center gap-1.5 text-[#52504e] font-mono text-[10px]">
          <Clock className="w-3 h-3" />
          Daily limit reached — resets at midnight
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => handleVote(true)}
            disabled={!canVote || voting !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border font-mono text-[10px] transition-all
              border-[#4caf50]/30 text-[#4caf50] hover:bg-[#4caf50]/10 hover:border-[#4caf50]/60
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ThumbsUp className="w-3 h-3" />
            {voting === "validate" ? "Voting…" : "Validate"}
          </button>
          <button
            onClick={() => handleVote(false)}
            disabled={!canVote || voting !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border font-mono text-[10px] transition-all
              border-[#e63030]/30 text-[#e63030] hover:bg-[#e63030]/10 hover:border-[#e63030]/60
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ThumbsDown className="w-3 h-3" />
            {voting === "reject" ? "Voting…" : "Reject"}
          </button>
        </div>
      )}
    </div>
  );
}

export function VotePanel() {
  const { data, isLoading } = useMempool();
  const { id: agentId } = useAgentStore();
  const [voteRec, setVoteRec] = useState<VoteRecord>({ date: getTodayKey(), count: 0, voted: [] });

  useEffect(() => {
    setVoteRec(loadVoteRecord());
  }, []);

  const papers = (data?.papers ?? []).slice(0, 5);
  const votesLeft = VOTES_PER_DAY - voteRec.count;

  async function handleVote(paperId: string, result: boolean) {
    await validatePaper(paperId, result ? "validate" : "reject", agentId);
    const newRec = { ...voteRec, count: voteRec.count + 1, voted: [...voteRec.voted, paperId] };
    setVoteRec(newRec);
    saveVoteRecord(newRec);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-mono font-semibold text-sm text-[#f5f0eb]">
            Pending Validation
          </h2>
          {!isLoading && papers.length > 0 && (
            <span className="font-mono text-[10px] text-[#52504e] bg-[#1a1a1c] px-1.5 py-0.5 rounded border border-[#2c2c30]">
              {papers.length}
            </span>
          )}
        </div>
        {/* Votes counter */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < votesLeft ? "bg-[#ff4e1a]" : "bg-[#2c2c30]"
              }`}
              title={`${votesLeft} of ${VOTES_PER_DAY} votes remaining today`}
            />
          ))}
          <span className="font-mono text-[10px] text-[#52504e] ml-1">
            {votesLeft}/{VOTES_PER_DAY} today
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border border-[#2c2c30] rounded-lg p-4 bg-[#0c0c0d] space-y-2">
              <Skeleton className="h-3 w-full bg-[#1a1a1c]" />
              <Skeleton className="h-3 w-3/5 bg-[#1a1a1c]" />
              <Skeleton className="h-1 w-full bg-[#1a1a1c] mt-3" />
              <Skeleton className="h-6 w-32 bg-[#1a1a1c]" />
            </div>
          ))}
        </div>
      ) : papers.length === 0 ? (
        <div className="border border-[#2c2c30] rounded-lg p-8 text-center">
          <Inbox className="w-8 h-8 text-[#2c2c30] mx-auto mb-3" />
          <p className="font-mono text-sm text-[#52504e]">Mempool is empty</p>
          <p className="font-mono text-xs text-[#2c2c30] mt-1">No papers awaiting validation</p>
        </div>
      ) : (
        <div className="space-y-3">
          {papers.map((paper) => (
            <MempoolVoteCard
              key={paper.id}
              paper={paper}
              alreadyVoted={voteRec.voted.includes(paper.id)}
              votesLeft={votesLeft}
              onVote={handleVote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
