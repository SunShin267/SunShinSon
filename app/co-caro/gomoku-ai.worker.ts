import { chooseComputerMove } from "./gomoku-ai";
import type { Difficulty, GomokuState } from "./gomoku-types";

type MoveRequest = { state: GomokuState; level: Difficulty; budgetMs?: number };
type WorkerMessage = { coord?: readonly [number, number]; error?: { name: string; message: string } };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<MoveRequest>) => void) | null;
  postMessage: (message: WorkerMessage) => void;
};

workerScope.onmessage = (event) => {
  chooseComputerMove(event.data.state, event.data.level, { budgetMs: event.data.budgetMs })
    .then((coord) => workerScope.postMessage({ coord }))
    .catch((error: unknown) => {
      const details = error instanceof Error ? { name: error.name, message: error.message } : { name: "Error", message: "Computer search failed" };
      workerScope.postMessage({ error: details });
    });
};
