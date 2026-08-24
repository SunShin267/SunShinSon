import { chooseComputerMove } from "../../lib/xiangqi/ai";
import type { Difficulty, Move, PublicXiangqiState } from "../../lib/xiangqi/types";

type MoveRequest = {
  state: PublicXiangqiState;
  difficulty: Difficulty;
  budgetMs?: number;
};

type WorkerResponse = {
  move?: Move;
  error?: { name: string; message: string };
};

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<MoveRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};

workerScope.onmessage = (event) => {
  const { state, difficulty, budgetMs } = event.data;
  chooseComputerMove(state, difficulty, { budgetMs })
    .then((move) => workerScope.postMessage({ move }))
    .catch((error: unknown) => {
      const details = error instanceof Error
        ? { name: error.name || "Error", message: error.message }
        : { name: "Error", message: "Computer search failed" };
      workerScope.postMessage({ error: details });
    });
};
