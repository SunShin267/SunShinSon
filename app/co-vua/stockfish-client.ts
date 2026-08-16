import { internalPath } from "../lib/navigation";
import { STOCKFISH_LEVELS, type StockfishLevel } from "./stockfish-levels";

type PendingSearch = {
  resolve: (move: string) => void;
  reject: (error: Error) => void;
  cleanup: () => void;
};

type ClientOptions = {
  basePath?: string;
  createWorker?: (url: string) => Worker;
};

function enginePath(basePath?: string) {
  const asset = "/engines/stockfish/stockfish-18-lite-single.js";
  if (basePath === undefined) return internalPath(asset);
  return `${basePath.replace(/\/$/, "")}${asset}`;
}

export class StockfishClient {
  readonly workerUrl: string;
  private worker: Worker;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((error: Error) => void) | null = null;
  private pending: PendingSearch | null = null;
  private disposed = false;

  constructor(options: ClientOptions = {}) {
    this.workerUrl = enginePath(options.basePath);
    this.worker = (options.createWorker ?? ((url) => new Worker(url)))(this.workerUrl);
    this.worker.addEventListener("message", this.onMessage);
    this.worker.addEventListener("error", this.onError);
  }

  private onMessage = (event: MessageEvent) => {
    const lines = String(event.data).split(/\r?\n/);
    for (const line of lines) {
      if (line === "uciok") this.worker.postMessage("isready");
      if (line === "readyok") {
        this.readyResolve?.();
        this.readyResolve = null;
        this.readyReject = null;
      }
      const match = /^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/.exec(line);
      if (match && this.pending) {
        const pending = this.pending;
        this.pending = null;
        pending.cleanup();
        pending.resolve(match[1]);
      }
    }
  };

  private onError = () => {
    const error = new Error("Không thể tải máy chơi cờ.");
    this.readyReject?.(error);
    this.readyReject = null;
    this.readyResolve = null;
    if (this.pending) {
      const pending = this.pending;
      this.pending = null;
      pending.cleanup();
      pending.reject(error);
    }
  };

  ready() {
    if (this.disposed) return Promise.reject(new Error("Máy chơi cờ đã dừng."));
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Máy chơi cờ khởi động quá lâu.")), 8000);
      this.readyResolve = () => { window.clearTimeout(timeout); resolve(); };
      this.readyReject = (error) => { window.clearTimeout(timeout); reject(error); };
      this.worker.postMessage("uci");
    });
    return this.readyPromise;
  }

  async bestMove(fen: string, level: StockfishLevel, signal?: AbortSignal) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (signal) {
      await new Promise<void>((resolve, reject) => {
        const abort = () => reject(new DOMException("Aborted", "AbortError"));
        signal.addEventListener("abort", abort, { once: true });
        this.ready().then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
      });
    } else {
      await this.ready();
    }
    this.cancel();
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const settings = STOCKFISH_LEVELS[level];
    return new Promise<string>((resolve, reject) => {
      const abort = () => {
        this.worker.postMessage("stop");
        const pending = this.pending;
        this.pending = null;
        pending?.cleanup();
        reject(new DOMException("Aborted", "AbortError"));
      };
      const timeout = window.setTimeout(() => {
        this.worker.postMessage("stop");
        const pending = this.pending;
        this.pending = null;
        pending?.cleanup();
        reject(new Error("Máy chơi cờ đã hết thời gian suy nghĩ."));
      }, settings.movetimeMs + 4000);
      const cleanup = () => {
        window.clearTimeout(timeout);
        signal?.removeEventListener("abort", abort);
      };
      this.pending = { resolve, reject, cleanup };
      signal?.addEventListener("abort", abort, { once: true });
      this.worker.postMessage(`setoption name Skill Level value ${settings.skill}`);
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go movetime ${settings.movetimeMs}`);
    });
  }

  cancel() {
    if (!this.pending) return;
    this.worker.postMessage("stop");
    const pending = this.pending;
    this.pending = null;
    pending.cleanup();
    pending.reject(new DOMException("Aborted", "AbortError"));
  }

  dispose() {
    if (this.disposed) return;
    this.cancel();
    this.readyReject?.(new Error("Máy chơi cờ đã dừng."));
    this.readyReject = null;
    this.readyResolve = null;
    this.disposed = true;
    this.worker.removeEventListener("message", this.onMessage);
    this.worker.removeEventListener("error", this.onError);
    this.worker.terminate();
  }
}
