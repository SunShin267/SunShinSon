export type CanvasPoint = { x: number; y: number };
export type StrokeData = { color: string; eraser: boolean; points: CanvasPoint[]; size: number };
export type HistoryState = { canRedo: boolean; canUndo: boolean; count: number };

type Rgba = { r: number; g: number; b: number; a: number };

export interface CanvasCommand {
  readonly memoryBytes: number;
  apply(context: CanvasRenderingContext2D): void;
}

/** Color helpers keep RGBA and tolerance rules in one testable place. */
export class ColorHelper {
  static fromHex(hex: string): Rgba {
    const normalized = hex.replace("#", "");
    const value = Number.parseInt(normalized.length === 3
      ? normalized.split("").map((character) => character.repeat(2)).join("")
      : normalized.slice(0, 6), 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255, a: 255 };
  }

  static read(data: Uint8ClampedArray, offset: number): Rgba {
    return { r: data[offset], g: data[offset + 1], b: data[offset + 2], a: data[offset + 3] };
  }

  static distance(left: Rgba, right: Rgba): number {
    // RGB values are irrelevant when both pixels are fully transparent.
    if (left.a === 0 && right.a === 0) return 0;
    const red = left.r - right.r;
    const green = left.g - right.g;
    const blue = left.b - right.b;
    const alpha = left.a - right.a;
    return Math.sqrt((red * red + green * green + blue * blue + alpha * alpha) / 4);
  }

  static luminance(color: Rgba): number {
    return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
  }

  static matches(data: Uint8ClampedArray, offset: number, target: Rgba, tolerance: number): boolean {
    return ColorHelper.distance(ColorHelper.read(data, offset), target) <= tolerance;
  }

  static isAntiAliasedEdge(candidate: Rgba, target: Rgba, tolerance: number): boolean {
    if (target.a < 16) return candidate.a > Math.max(20, tolerance);
    const targetLight = ColorHelper.luminance(target);
    if (targetLight < 180) return false;
    // Antialiased outlines are gray pixels around black ink. Keep that luminance
    // drop as a wall even when the child chooses a generous tolerance.
    const edgeDrop = Math.max(35, 105 - tolerance * 0.24);
    return ColorHelper.luminance(candidate) < targetLight - edgeDrop;
  }
}

function drawDot(context: CanvasRenderingContext2D, stroke: StrokeData, point: CanvasPoint) {
  context.save();
  context.globalCompositeOperation = stroke.eraser ? "destination-out" : "source-over";
  context.fillStyle = stroke.color;
  context.beginPath();
  context.arc(point.x, point.y, stroke.size / 2, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSegment(context: CanvasRenderingContext2D, stroke: StrokeData, from: CanvasPoint, to: CanvasPoint) {
  context.save();
  context.globalCompositeOperation = stroke.eraser ? "destination-out" : "source-over";
  context.strokeStyle = stroke.color;
  context.lineWidth = stroke.size;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
  context.restore();
}

/** A brush stroke is replayable, so undo never needs a full canvas snapshot. */
export class StrokeCommand implements CanvasCommand {
  readonly memoryBytes: number;
  private readonly stroke: StrokeData;

  constructor(stroke: StrokeData) {
    this.stroke = stroke;
    this.memoryBytes = 64 + stroke.points.length * 16;
  }

  apply(context: CanvasRenderingContext2D) {
    const first = this.stroke.points[0];
    if (!first) return;
    drawDot(context, this.stroke, first);
    for (let index = 1; index < this.stroke.points.length; index += 1) {
      drawSegment(context, this.stroke, this.stroke.points[index - 1], this.stroke.points[index]);
    }
  }
}

/** The fill result is stored as horizontal spans, not millions of pixels. */
export class BucketFillCommand implements CanvasCommand {
  readonly memoryBytes: number;
  private readonly spans: Uint32Array;
  private readonly color: string;

  constructor(spans: Uint32Array, color: string) {
    this.spans = spans;
    this.color = color;
    this.memoryBytes = 64 + spans.byteLength;
  }

  apply(context: CanvasRenderingContext2D) {
    context.save();
    context.globalCompositeOperation = "source-over";
    context.fillStyle = this.color;
    for (let index = 0; index < this.spans.length; index += 3) {
      const y = this.spans[index];
      const left = this.spans[index + 1];
      const right = this.spans[index + 2];
      context.fillRect(left, y, right - left + 1, 1);
    }
    context.restore();
  }
}

/** Command history is capped to prevent old edits exhausting mobile memory. */
export class CanvasManager {
  private commands: CanvasCommand[] = [];
  private redoCommands: CanvasCommand[] = [];
  private readonly maximumHistoryBytes = 64 * 1024 * 1024;
  private readonly canvas: HTMLCanvasElement;
  private readonly onHistoryChange: (state: HistoryState) => void;

  constructor(
    canvas: HTMLCanvasElement,
    onHistoryChange: (state: HistoryState) => void,
  ) {
    this.canvas = canvas;
    this.onHistoryChange = onHistoryChange;
  }

  commit(command: CanvasCommand, alreadyApplied = false) {
    if (!alreadyApplied) command.apply(this.context());
    this.commands.push(command);
    this.redoCommands = [];
    this.trimHistory();
    this.emitHistory();
  }

  undo() {
    const command = this.commands.pop();
    if (!command) return;
    this.redoCommands.push(command);
    this.redraw();
    this.emitHistory();
  }

  redo() {
    const command = this.redoCommands.pop();
    if (!command) return;
    this.commands.push(command);
    command.apply(this.context());
    this.emitHistory();
  }

  /** Remove only the supplied commands, used to discard marks created by a UI gesture. */
  discardCommands(commands: readonly CanvasCommand[]) {
    if (!commands.length) return;
    const discarded = new Set(commands);
    const remaining = this.commands.filter((command) => !discarded.has(command));
    if (remaining.length === this.commands.length) return;
    this.commands = remaining;
    this.redoCommands = [];
    this.redraw();
    this.emitHistory();
  }

  clear() {
    this.commands = [];
    this.redoCommands = [];
    this.context().clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.emitHistory();
  }

  createCompositeCanvas(image: CanvasImageSource, whiteBackground = false): HTMLCanvasElement {
    const output = document.createElement("canvas");
    output.width = this.canvas.width;
    output.height = this.canvas.height;
    const context = output.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("canvas-unavailable");
    if (whiteBackground) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, output.width, output.height);
    }
    context.drawImage(image, 0, 0, output.width, output.height);
    context.globalCompositeOperation = "multiply";
    context.drawImage(this.canvas, 0, 0);
    context.globalCompositeOperation = "source-over";
    return output;
  }

  private context() {
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("canvas-unavailable");
    return context;
  }

  redraw() {
    const context = this.context();
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.commands.forEach((command) => command.apply(context));
  }

  private trimHistory() {
    let bytes = this.commands.reduce((total, command) => total + command.memoryBytes, 0);
    while (bytes > this.maximumHistoryBytes && this.commands.length > 1) {
      const discarded = this.commands.shift();
      if (discarded) bytes -= discarded.memoryBytes;
    }
  }

  private emitHistory() {
    this.onHistoryChange({ canRedo: this.redoCommands.length > 0, canUndo: this.commands.length > 0, count: this.commands.length });
  }
}

class Uint32Builder {
  private values = new Uint32Array(4096);
  private length = 0;
  private readonly maximumValues: number;

  constructor(maximumValues = 16_000_000) { this.maximumValues = maximumValues; }

  push(first: number, second: number, third: number) {
    if (this.length + 3 > this.values.length) {
      if (this.values.length >= this.maximumValues) throw new Error("bucket-memory-limit");
      const next = new Uint32Array(Math.min(this.maximumValues, this.values.length * 2));
      next.set(this.values);
      this.values = next;
    }
    this.values[this.length++] = first;
    this.values[this.length++] = second;
    this.values[this.length++] = third;
  }

  finish() { return this.values.slice(0, this.length); }
}

/** Compact FIFO used by scanline BFS; it grows only with pending regions. */
class PixelQueue {
  private values = new Uint32Array(4096);
  private head = 0;
  private tail = 0;
  private readonly maximumEntries: number;

  constructor(maximumEntries: number) { this.maximumEntries = maximumEntries; }

  get hasValues() { return this.head < this.tail; }
  shift() { return this.values[this.head++]; }

  push(value: number) {
    if (this.tail >= this.values.length) this.makeRoom();
    this.values[this.tail++] = value;
  }

  private makeRoom() {
    if (this.head > 0) {
      this.values.copyWithin(0, this.head, this.tail);
      this.tail -= this.head;
      this.head = 0;
      return;
    }
    if (this.values.length >= this.maximumEntries) throw new Error("bucket-memory-limit");
    const next = new Uint32Array(Math.min(this.maximumEntries, this.values.length * 2));
    next.set(this.values);
    this.values = next;
  }
}

export type BucketFillOptions = { color: string; tolerance: number; x: number; y: number };

/** High-performance connected-region fill using a scanline BFS queue. */
export class BucketFillTool {
  static readonly maximumPixels = 5_000 * 5_000;
  private readonly manager: CanvasManager;
  private readonly image: CanvasImageSource;

  constructor(manager: CanvasManager, image: CanvasImageSource) {
    this.manager = manager;
    this.image = image;
  }

  async createCommand(options: BucketFillOptions): Promise<BucketFillCommand | null> {
    const source = this.manager.createCompositeCanvas(this.image);
    const { width, height } = source;
    const pixelCount = width * height;
    if (!pixelCount || pixelCount > BucketFillTool.maximumPixels) throw new Error("canvas-too-large");

    const context = source.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("canvas-unavailable");
    const imageData = context.getImageData(0, 0, width, height);
    const x = Math.min(width - 1, Math.max(0, Math.floor(options.x)));
    const y = Math.min(height - 1, Math.max(0, Math.floor(options.y)));
    const target = ColorHelper.read(imageData.data, (y * width + x) * 4);
    const replacement = ColorHelper.fromHex(options.color);
    if (ColorHelper.distance(target, replacement) <= 1) return null;

    // One bit per pixel costs about 3 MB for a full 5000 × 5000 canvas.
    const visited = new Uint8Array(Math.ceil(pixelCount / 8));
    const queue = new PixelQueue(Math.min(pixelCount, 16_000_000));
    const spans = new Uint32Builder();
    const isVisited = (index: number) => (visited[index >> 3] & (1 << (index & 7))) !== 0;
    const markVisited = (index: number) => { visited[index >> 3] |= 1 << (index & 7); };
    const isFillable = (index: number) => {
      if (isVisited(index)) return false;
      const offset = index * 4;
      const candidate = ColorHelper.read(imageData.data, offset);
      return ColorHelper.matches(imageData.data, offset, target, options.tolerance)
        && !ColorHelper.isAntiAliasedEdge(candidate, target, options.tolerance);
    };

    queue.push(y * width + x);
    let processedSpans = 0;
    while (queue.hasValues) {
      const seed = queue.shift();
      if (!isFillable(seed)) continue;
      const row = Math.floor(seed / width);
      let left = seed % width;
      let right = left;
      while (left > 0 && isFillable(row * width + left - 1)) left -= 1;
      while (right + 1 < width && isFillable(row * width + right + 1)) right += 1;
      for (let column = left; column <= right; column += 1) markVisited(row * width + column);
      spans.push(row, left, right);

      for (const nextRow of [row - 1, row + 1]) {
        if (nextRow < 0 || nextRow >= height) continue;
        let column = left;
        while (column <= right) {
          const index = nextRow * width + column;
          if (!isFillable(index)) { column += 1; continue; }
          queue.push(index);
          column += 1;
          while (column <= right && isFillable(nextRow * width + column)) column += 1;
        }
      }

      // Yield so the loading indicator remains animated on large regions.
      processedSpans += 1;
      if (processedSpans % 1200 === 0) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }

    const result = spans.finish();
    return result.length ? new BucketFillCommand(result, options.color) : null;
  }
}
