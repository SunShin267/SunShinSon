import { chooseComputerMove } from "../../lib/xiangqi/ai";
import { legalMoves, toPublicState } from "../../lib/xiangqi/rules";
import { sameCoord, type Difficulty, type Move, type PublicXiangqiState, type XiangqiState } from "../../lib/xiangqi/types";

type ClientOptions = { signal?: AbortSignal; budgetMs?: number };
type WorkerResponse = { move?: Move; error?: { name: string; message: string } };

export type ComputerMoveResult = {
  move: Move;
  fallbackUsed: boolean;
};

function asPublicState(state: XiangqiState | PublicXiangqiState): PublicXiangqiState {
  return state.visibility === "private" ? toPublicState(state) : state;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function sameMove(left: Move, right: Move): boolean {
  return sameCoord(left.from, right.from) && sameCoord(left.to, right.to);
}

export function findLegalFallbackMove(state: PublicXiangqiState): Move | null {
  return legalMoves(state)[0] ?? null;
}

function moveOrFallback(state: PublicXiangqiState, candidate?: Move): ComputerMoveResult {
  const moves = legalMoves(state);
  if (candidate && moves.some((move) => sameMove(move, candidate))) {
    return { move: candidate, fallbackUsed: false };
  }
  const fallback = moves[0];
  if (!fallback) throw new Error("No legal computer move is available");
  return { move: fallback, fallbackUsed: true };
}

export function requestComputerMove(
  state: XiangqiState | PublicXiangqiState,
  difficulty: Difficulty,
  options: ClientOptions = {},
): Promise<ComputerMoveResult> {
  const publicState = asPublicState(state);
  if (options.signal?.aborted) {
    return Promise.reject(new DOMException("Computer move cancelled", "AbortError"));
  }

  if (typeof Worker === "undefined") {
    return chooseComputerMove(publicState, difficulty, options).then(
      (move) => moveOrFallback(publicState, move),
      (error: unknown) => {
        if (isAbortError(error)) throw error;
        return moveOrFallback(publicState);
      },
    );
  }

  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./xiangqi-ai.worker.ts", import.meta.url), { type: "module" });
    } catch (error) {
      try {
        resolve(moveOrFallback(publicState));
      } catch {
        reject(error);
      }
      return;
    }
    let settled = false;

    function finish(callback: () => void): void {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener("abort", abort);
      worker.terminate();
      callback();
    }

    function abort(): void {
      finish(() => reject(new DOMException("Computer move cancelled", "AbortError")));
    }

    function resolveFallback(error?: unknown): void {
      finish(() => {
        try {
          resolve(moveOrFallback(publicState));
        } catch {
          reject(error instanceof Error ? error : new Error("Computer worker failed"));
        }
      });
    }

    options.signal?.addEventListener("abort", abort, { once: true });
    worker.onerror = () => resolveFallback(new Error("Computer worker failed"));
    worker.onmessage = (event: MessageEvent<unknown>) => {
      const response = event.data;
      if (!response || typeof response !== "object") {
        resolveFallback(new TypeError("Computer worker returned an invalid response"));
        return;
      }
      const typedResponse = response as WorkerResponse;
      if (typedResponse.error) {
        resolveFallback(new DOMException(typedResponse.error.message, typedResponse.error.name));
        return;
      }
      try {
        const result = moveOrFallback(publicState, typedResponse.move);
        finish(() => resolve(result));
      } catch (error) {
        finish(() => reject(error));
      }
    };
    try {
      worker.postMessage({ state: publicState, difficulty, budgetMs: options.budgetMs });
    } catch (error) {
      resolveFallback(error);
    }
  });
}
