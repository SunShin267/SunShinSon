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
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequest(value: unknown): MoveRequest {
  if (!isRecord(value) || !isRecord(value.state)
      || value.state.visibility !== "public"
      || "seed" in value.state
      || "concealedPieces" in value.state
      || (value.difficulty !== "easy" && value.difficulty !== "medium" && value.difficulty !== "hard")
      || (value.budgetMs !== undefined && (typeof value.budgetMs !== "number" || !Number.isFinite(value.budgetMs)))) {
    throw new TypeError("Invalid Xiangqi AI request");
  }
  return value as MoveRequest;
}

function errorDetails(error: unknown): { name: string; message: string } {
  return error instanceof Error
    ? { name: error.name || "Error", message: error.message }
    : { name: "Error", message: "Computer search failed" };
}

workerScope.onmessage = (event) => {
  let request: MoveRequest;
  try {
    request = parseRequest(event.data);
  } catch (error) {
    workerScope.postMessage({ error: errorDetails(error) });
    return;
  }
  const { state, difficulty, budgetMs } = request;
  chooseComputerMove(state, difficulty, { budgetMs })
    .then((move) => workerScope.postMessage({ move }))
    .catch((error: unknown) => {
      workerScope.postMessage({ error: errorDetails(error) });
    });
};
