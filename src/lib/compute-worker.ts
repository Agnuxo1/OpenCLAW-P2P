/**
 * Web Worker manager — CLIENT ONLY.
 * Distributes paper validation and EigenTrust computation
 * to a background thread so the UI never freezes.
 * With 1,000,000 users = 1,000,000 CPUs for validation — zero server cost.
 */

let _worker: Worker | null = null;
const _pendingTasks = new Map<number, { resolve: (r: unknown) => void; reject: (e: Error) => void }>();
let _taskCounter = 0;

function getWorker(): Worker {
  if (!_worker && typeof Worker !== "undefined") {
    _worker = new Worker("/workers/validator.worker.js", { type: "classic" });

    _worker.addEventListener("message", (event) => {
      const { id, success, result, error } = event.data as {
        id: number; success: boolean; result: unknown; error: string;
      };
      const pending = _pendingTasks.get(id);
      if (!pending) return;
      _pendingTasks.delete(id);
      if (success) {
        pending.resolve(result);
      } else {
        pending.reject(new Error(error));
      }
    });

    _worker.addEventListener("error", (err) => {
      console.error("[Worker] Error:", err.message);
    });
  }
  return _worker!;
}

function dispatch<T>(type: string, payload: unknown, timeoutMs = 10000): Promise<T> {
  const id = ++_taskCounter;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      _pendingTasks.delete(id);
      reject(new Error(`Worker task ${type} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    _pendingTasks.set(id, {
      resolve: (r) => { clearTimeout(timer); resolve(r as T); },
      reject: (e) => { clearTimeout(timer); reject(e); },
    });

    try {
      getWorker().postMessage({ id, type, payload });
    } catch (err) {
      _pendingTasks.delete(id);
      clearTimeout(timer);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  warnings: string[];
  wordCount: number;
  score: number;
  validatedAt: number;
  validatedBy: string;
}

export interface EigenTrustResult {
  [agentId: string]: number;
}

/** Validate a single paper in the background thread */
export const validatePaper = (paper: unknown): Promise<ValidationResult> =>
  dispatch<ValidationResult>("VALIDATE_PAPER", { paper });

/** Validate multiple papers in batch */
export const validateBatch = (papers: unknown[]): Promise<ValidationResult[]> =>
  dispatch<ValidationResult[]>("VALIDATE_BATCH", { papers }, 30000);

/** Compute EigenTrust scores in the background thread */
export const computeEigenTrust = (
  votes: Record<string, Record<string, boolean>>,
  papers: Record<string, { authorDid: string }>
): Promise<EigenTrustResult> =>
  dispatch<EigenTrustResult>("COMPUTE_EIGENTRUST", { votes, papers }, 15000);

/** Terminate the worker (cleanup on unmount) */
export function terminateWorker(): void {
  _worker?.terminate();
  _worker = null;
  _pendingTasks.clear();
}
