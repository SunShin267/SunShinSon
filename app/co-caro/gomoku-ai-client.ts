import { chooseComputerMove } from "./gomoku-ai";
import { isLegalMove } from "./gomoku-engine";
import type { Coord, Difficulty, GomokuState } from "./gomoku-types";

type ClientOptions = { signal?: AbortSignal; budgetMs?: number };
type WorkerResponse = { coord?: Coord; error?: { name: string; message: string } };

export function findLegalFallbackMove(state: GomokuState): Coord | null {
  const anchor = state.moves[state.moves.length - 1]?.coord ?? [Math.floor(state.size / 2), Math.floor(state.size / 2)];
  for (let radius = 0; radius < state.size; radius += 1) {
    const minX = Math.max(0, anchor[0] - radius);
    const maxX = Math.min(state.size - 1, anchor[0] + radius);
    const minY = Math.max(0, anchor[1] - radius);
    const maxY = Math.min(state.size - 1, anchor[1] + radius);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (radius > 0 && x > minX && x < maxX && y > minY && y < maxY) continue;
        const coord: Coord = [x, y];
        if (isLegalMove(state, coord)) return coord;
      }
    }
  }
  return null;
}

export function requestComputerMove(state: GomokuState, level: Difficulty, options: ClientOptions = {}): Promise<Coord> {
  if (typeof Worker === "undefined") return chooseComputerMove(state, level, options);

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./gomoku-ai.worker.ts", import.meta.url), { type: "module" });
    let settled = false;

    function finish(callback: () => void) {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener("abort", abort);
      worker.terminate();
      callback();
    }
    function abort() {
      finish(() => reject(new DOMException("Computer move cancelled", "AbortError")));
    }

    if (options.signal?.aborted) {
      abort();
      return;
    }
    options.signal?.addEventListener("abort", abort, { once: true });
    worker.onerror = () => finish(() => reject(new Error("Computer worker failed")));
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (response.error) finish(() => reject(new DOMException(response.error?.message, response.error?.name)));
      else if (response.coord) finish(() => resolve(response.coord as Coord));
      else finish(() => reject(new Error("Computer worker returned no move")));
    };
    worker.postMessage({ state, level, budgetMs: options.budgetMs });
  });
}
