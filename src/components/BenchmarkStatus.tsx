import type { BenchmarkData } from "@/lib/live-data";

interface Props {
  data?: BenchmarkData;
  status: { state: string; message: string };
  refreshing: boolean;
  onRefresh: () => void;
}

export function BenchmarkStatus({ data, status, refreshing, onRefresh }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-muted-foreground">
      <div role="status" aria-live="polite">
        <span>{status.message}</span>
        {data?.updated_at && (
          <span className="block mt-1 font-mono">
            Snapshot: <time dateTime={data.updated_at}>{data.updated_at.replace("T", " ").replace(/\.\d{3}Z$/, " UTC")}</time>
          </span>
        )}
      </div>
      <button type="button" onClick={onRefresh} disabled={refreshing}
        className="border border-border rounded-full px-3 py-1.5 text-foreground hover:border-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
