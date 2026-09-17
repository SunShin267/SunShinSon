"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import { CanvasViewportController, canvasPointFromClient, type ViewTransform } from "./canvas-viewport";
import type { ColoringArt } from "./coloring-arts";
import {
  BucketFillTool,
  CanvasManager,
  StrokeCommand,
  type CanvasCommand,
  type CanvasPoint,
  type HistoryState,
  type StrokeData,
} from "./paint-bucket";
import { printColoringImage } from "./print-coloring";

type Tool = "brush" | "bucket" | "eraser";
type PanGesture = { pointerId: number; start: ViewTransform; x: number; y: number };
type TouchPoint = { x: number; y: number };
type PinchGesture = {
  pointerIds: [number, number];
  startCenter: TouchPoint;
  startDistance: number;
  startTransform: ViewTransform;
};
type RecentClickCommand = { command: CanvasCommand; completedAt: number };

const palette = [
  { color: "#ef4444", name: "Đỏ" }, { color: "#f97316", name: "Cam" },
  { color: "#facc15", name: "Vàng" }, { color: "#22c55e", name: "Xanh lá" },
  { color: "#38bdf8", name: "Xanh da trời" }, { color: "#6366f1", name: "Chàm" },
  { color: "#a855f7", name: "Tím" }, { color: "#ec4899", name: "Hồng" },
  { color: "#92400e", name: "Nâu" }, { color: "#111827", name: "Đen" },
];

const brushPresets = [
  { label: "Mảnh", size: 14 },
  { label: "Vừa", size: 28 },
  { label: "To", size: 46 },
  { label: "Rất to", size: 68 },
];

const emptyHistory: HistoryState = { canRedo: false, canUndo: false, count: 0 };

function distanceBetween(first: TouchPoint, second: TouchPoint) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function midpoint(first: TouchPoint, second: TouchPoint): TouchPoint {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

export function ColoringCanvas({ art, childName }: { art: ColoringArt; childName: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brushCursorRef = useRef<HTMLSpanElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportContentRef = useRef<HTMLDivElement>(null);
  const viewportControllerRef = useRef<CanvasViewportController | null>(null);
  const managerRef = useRef<CanvasManager | null>(null);
  const activeStrokeRef = useRef<StrokeData | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const panGestureRef = useRef<PanGesture | null>(null);
  const touchPointsRef = useRef(new Map<number, TouchPoint>());
  const pinchGestureRef = useRef<PinchGesture | null>(null);
  const zoomFrameRef = useRef<number | null>(null);
  const reportedScaleRef = useRef(1);
  const recentClickCommandsRef = useRef<RecentClickCommand[]>([]);
  const viewGestureGenerationRef = useRef(0);
  const activeStrokeAppliedRef = useRef(false);
  const pendingMouseTapTimersRef = useRef(new Set<number>());
  const brushCursorFrameRef = useRef<number | null>(null);
  const brushCursorScaleRef = useRef(1);
  const brushCursorPointRef = useRef<TouchPoint | null>(null);
  const [color, setColor] = useState(palette[0].color);
  const [brushSize, setBrushSize] = useState(28);
  const [tool, setTool] = useState<Tool>("brush");
  const [isPanMode, setIsPanMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [isFilling, setIsFilling] = useState(false);
  const [fillMessage, setFillMessage] = useState("");
  const [tolerance, setTolerance] = useState(32);
  const [zoom, setZoom] = useState(100);
  const [history, setHistory] = useState<HistoryState>(emptyHistory);

  const isEraser = tool === "eraser";
  const isBucket = tool === "bucket";

  useEffect(() => {
    const stage = stageRef.current;
    const content = viewportContentRef.current;
    if (!stage || !content) return;
    const pendingMouseTapTimers = pendingMouseTapTimersRef.current;

    const reportTransform = (state: ViewTransform) => {
      reportedScaleRef.current = state.scale;
      if (zoomFrameRef.current !== null) return;
      zoomFrameRef.current = requestAnimationFrame(() => {
        zoomFrameRef.current = null;
        setZoom(Math.round(reportedScaleRef.current * 100));
      });
    };
    const controller = new CanvasViewportController(stage, content, reportTransform);
    viewportControllerRef.current = controller;
    const observer = new ResizeObserver(() => controller.refreshBounds());
    observer.observe(stage);
    observer.observe(content);
    return () => {
      observer.disconnect();
      if (zoomFrameRef.current !== null) cancelAnimationFrame(zoomFrameRef.current);
      if (brushCursorFrameRef.current !== null) cancelAnimationFrame(brushCursorFrameRef.current);
      pendingMouseTapTimers.forEach((timer) => window.clearTimeout(timer));
      pendingMouseTapTimers.clear();
      viewportControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const cursor = brushCursorRef.current;
    if (!cursor) return;
    cursor.style.backgroundColor = isEraser ? "rgba(255,255,255,.72)" : `${color}55`;
    cursor.style.borderColor = isEraser ? "#2e261e" : color;
    const diameter = Math.max(6, brushSize * brushCursorScaleRef.current);
    cursor.style.width = `${diameter}px`;
    cursor.style.height = `${diameter}px`;
    if (isPanMode || isBucket) cursor.style.opacity = "0";
  }, [brushSize, color, isBucket, isEraser, isPanMode]);

  function prepareCanvas() {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas || !image.naturalWidth || !image.naturalHeight) return;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    managerRef.current = new CanvasManager(canvas, setHistory);
    activeStrokeRef.current = null;
    activePointerRef.current = null;
    activeStrokeAppliedRef.current = false;
    panGestureRef.current = null;
    touchPointsRef.current.clear();
    pinchGestureRef.current = null;
    recentClickCommandsRef.current = [];
    viewGestureGenerationRef.current += 1;
    pendingMouseTapTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    pendingMouseTapTimersRef.current.clear();
    setHistory(emptyHistory);
    setIsPanMode(false);
    setIsDragging(false);
    setIsPinching(false);
    requestAnimationFrame(() => viewportControllerRef.current?.reset());
  }

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>): CanvasPoint {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return canvasPointFromClient(
      { x: event.clientX, y: event.clientY },
      rect,
      { width: canvas.width, height: canvas.height },
    );
  }

  function updateBrushCursor(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "touch") return;
    brushCursorPointRef.current = { x: event.clientX, y: event.clientY };
    if (brushCursorFrameRef.current !== null) return;
    brushCursorFrameRef.current = requestAnimationFrame(() => {
      brushCursorFrameRef.current = null;
      const canvas = canvasRef.current;
      const cursor = brushCursorRef.current;
      const stage = stageRef.current;
      const point = brushCursorPointRef.current;
      if (!canvas || !cursor || !stage || !point) return;
      const canvasRect = canvas.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      brushCursorScaleRef.current = canvas.width ? canvasRect.width / canvas.width : 1;
      const diameter = Math.max(6, brushSize * brushCursorScaleRef.current);
      cursor.style.width = `${diameter}px`;
      cursor.style.height = `${diameter}px`;
      cursor.style.transform = `translate3d(${point.x - stageRect.left}px, ${point.y - stageRect.top}px, 0) translate(-50%, -50%)`;
      cursor.style.opacity = isPanMode || isBucket ? "0" : "1";
    });
  }

  function hideBrushCursor() {
    brushCursorPointRef.current = null;
    if (brushCursorRef.current) brushCursorRef.current.style.opacity = "0";
  }

  function stagePoint(clientX: number, clientY: number): TouchPoint {
    const rect = stageRef.current?.getBoundingClientRect();
    return rect ? { x: clientX - rect.left, y: clientY - rect.top } : { x: clientX, y: clientY };
  }

  function cancelActiveStroke() {
    const canvas = canvasRef.current;
    const pointerId = activePointerRef.current;
    if (canvas && pointerId !== null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    activeStrokeRef.current = null;
    activePointerRef.current = null;
    activeStrokeAppliedRef.current = false;
    managerRef.current?.redraw();
  }

  function cancelPendingMouseTaps() {
    pendingMouseTapTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    pendingMouseTapTimersRef.current.clear();
  }

  function scheduleMouseTap(command: CanvasCommand) {
    const manager = managerRef.current;
    if (!manager) return;
    const timer = window.setTimeout(() => {
      pendingMouseTapTimersRef.current.delete(timer);
      if (managerRef.current !== manager) return;
      manager.commit(command);
      rememberClickCommand(command);
    }, 320);
    pendingMouseTapTimersRef.current.add(timer);
  }

  function rememberClickCommand(command: CanvasCommand) {
    const cutoff = performance.now() - 2_000;
    recentClickCommandsRef.current = [
      ...recentClickCommandsRef.current.filter((entry) => entry.completedAt >= cutoff),
      { command, completedAt: performance.now() },
    ];
  }

  function isTapStroke(stroke: StrokeData) {
    const first = stroke.points[0];
    if (!first) return false;
    const maximumTravel = Math.max(4, stroke.size * 0.15);
    return stroke.points.every((point) => Math.hypot(point.x - first.x, point.y - first.y) <= maximumTravel);
  }

  async function fillAt(point: CanvasPoint, rememberAsClick = false, gestureGeneration = viewGestureGenerationRef.current) {
    const manager = managerRef.current;
    const image = imageRef.current;
    if (!manager || !image || isFilling) return;
    setIsFilling(true);
    setFillMessage("");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const command = await new BucketFillTool(manager, image).createCommand({ color, tolerance, x: point.x, y: point.y });
      if (gestureGeneration !== viewGestureGenerationRef.current) return;
      if (command) {
        manager.commit(command);
        if (rememberAsClick) rememberClickCommand(command);
      }
      else setFillMessage("Vùng này đã có màu hoặc chưa thể đổ thêm.");
    } catch (error) {
      setFillMessage(error instanceof Error && error.message === "canvas-too-large"
        ? "Tranh lớn hơn 5000 × 5000 px nên chưa thể đổ màu an toàn."
        : "Sun chưa thể đổ màu vùng này. Bé thử chạm sâu hơn vào vùng trắng nhé.");
    } finally {
      setIsFilling(false);
    }
  }

  function startStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (isPanMode || isFilling || pinchGestureRef.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    const scale = viewportControllerRef.current?.getState().scale ?? 1;
    if (event.pointerType === "mouse" && event.detail > 1 && Math.abs(scale - 1) >= 0.001) {
      discardMarksAndResetView();
      return;
    }
    updateBrushCursor(event);
    const point = pointFromEvent(event);
    if (isBucket) {
      void fillAt(point, event.pointerType === "mouse");
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const stroke: StrokeData = { color, eraser: isEraser, points: [point], size: brushSize };
    activePointerRef.current = event.pointerId;
    activeStrokeRef.current = stroke;
    activeStrokeAppliedRef.current = event.pointerType !== "mouse";
    if (activeStrokeAppliedRef.current) {
      const context = event.currentTarget.getContext("2d");
      if (context) new StrokeCommand(stroke).apply(context);
    }
  }

  function continueStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (isPanMode || isBucket || pinchGestureRef.current) return;
    updateBrushCursor(event);
    const stroke = activeStrokeRef.current;
    if (!stroke || activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    const previous = stroke.points[stroke.points.length - 1];
    stroke.points.push(point);
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    if (!activeStrokeAppliedRef.current) {
      new StrokeCommand({ ...stroke, points: [previous] }).apply(context);
      activeStrokeAppliedRef.current = true;
    }
    context.save();
    context.globalCompositeOperation = stroke.eraser ? "destination-out" : "source-over";
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.size;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    context.restore();
  }

  function finishStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (isPanMode || isBucket || pinchGestureRef.current) return;
    const stroke = activeStrokeRef.current;
    if (!stroke || activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    const command = new StrokeCommand(stroke);
    if (event.pointerType === "mouse" && !activeStrokeAppliedRef.current && isTapStroke(stroke)) {
      scheduleMouseTap(command);
    } else {
      managerRef.current?.commit(command, activeStrokeAppliedRef.current);
      if (event.pointerType === "mouse" && isTapStroke(stroke)) rememberClickCommand(command);
    }
    activeStrokeRef.current = null;
    activePointerRef.current = null;
    activeStrokeAppliedRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function updateZoom(nextZoom: number) {
    const stage = stageRef.current;
    const controller = viewportControllerRef.current;
    if (!stage || !controller) return;
    controller.zoomAt(nextZoom / 100, stage.clientWidth / 2, stage.clientHeight / 2);
  }

  function resetView() {
    hideBrushCursor();
    viewportControllerRef.current?.reset();
    setIsPanMode(false);
    setIsDragging(false);
  }

  function discardMarksAndResetView() {
    const controller = viewportControllerRef.current;
    if (!controller || Math.abs(controller.getState().scale - 1) < 0.001) return;
    viewGestureGenerationRef.current += 1;
    cancelActiveStroke();
    cancelPendingMouseTaps();
    const cutoff = performance.now() - 2_000;
    const commands = recentClickCommandsRef.current
      .filter((entry) => entry.completedAt >= cutoff)
      .map((entry) => entry.command);
    managerRef.current?.discardCommands(commands);
    recentClickCommandsRef.current = [];
    resetView();
  }

  function resetViewFromDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target !== canvasRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    discardMarksAndResetView();
  }

  function zoomWithWheel(event: ReactWheelEvent<HTMLDivElement>) {
    const controller = viewportControllerRef.current;
    if (!controller) return;
    event.preventDefault();
    const anchor = stagePoint(event.clientX, event.clientY);
    const sensitivity = event.ctrlKey ? 0.0015 : 0.0032;
    controller.zoomAt(controller.getState().scale * Math.exp(-event.deltaY * sensitivity), anchor.x, anchor.y);
  }

  function trackTouchStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse") {
      const scale = viewportControllerRef.current?.getState().scale ?? 1;
      if (event.detail > 1 && Math.abs(scale - 1) >= 0.001 && event.target === canvasRef.current) {
        event.preventDefault();
        event.stopPropagation();
        discardMarksAndResetView();
      }
      return;
    }
    if (event.pointerType !== "touch") return;
    touchPointsRef.current.set(event.pointerId, stagePoint(event.clientX, event.clientY));
    if (touchPointsRef.current.size < 2) return;
    event.preventDefault();
    event.stopPropagation();
    cancelActiveStroke();
    panGestureRef.current = null;
    setIsDragging(false);
    const entries = Array.from(touchPointsRef.current.entries()).slice(0, 2);
    const [firstId, first] = entries[0];
    const [secondId, second] = entries[1];
    const controller = viewportControllerRef.current;
    if (!controller) return;
    for (const pointerId of [firstId, secondId]) {
      try { event.currentTarget.setPointerCapture(pointerId); } catch { /* Pointer may already have ended. */ }
    }
    pinchGestureRef.current = {
      pointerIds: [firstId, secondId],
      startCenter: midpoint(first, second),
      startDistance: Math.max(1, distanceBetween(first, second)),
      startTransform: controller.getState(),
    };
    setIsPinching(true);
  }

  function trackTouchMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch" || !touchPointsRef.current.has(event.pointerId)) return;
    touchPointsRef.current.set(event.pointerId, stagePoint(event.clientX, event.clientY));
    const pinch = pinchGestureRef.current;
    if (!pinch) return;
    const first = touchPointsRef.current.get(pinch.pointerIds[0]);
    const second = touchPointsRef.current.get(pinch.pointerIds[1]);
    if (!first || !second) return;
    event.preventDefault();
    event.stopPropagation();
    const controller = viewportControllerRef.current;
    if (!controller) return;
    controller.pinchFrom(
      pinch.startTransform,
      pinch.startTransform.scale * distanceBetween(first, second) / pinch.startDistance,
      pinch.startCenter,
      midpoint(first, second),
    );
  }

  function trackTouchEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    touchPointsRef.current.delete(event.pointerId);
    const pinch = pinchGestureRef.current;
    if (!pinch || !pinch.pointerIds.includes(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    pinchGestureRef.current = null;
    setIsPinching(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function beginPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isPanMode || zoom <= 100 || pinchGestureRef.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const controller = viewportControllerRef.current;
    if (!controller) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panGestureRef.current = {
      pointerId: event.pointerId,
      start: controller.getState(),
      x: event.clientX,
      y: event.clientY,
    };
    setIsDragging(true);
  }

  function movePan(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = panGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    viewportControllerRef.current?.panFrom(gesture.start, event.clientX - gesture.x, event.clientY - gesture.y);
  }

  function finishPan(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = panGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    panGestureRef.current = null;
    setIsDragging(false);
  }

  function clearPainting() {
    if (!history.count || !window.confirm("Xóa toàn bộ màu bé đã tô trên tranh này?")) return;
    managerRef.current?.clear();
  }

  function createCompositeCanvas() {
    const image = imageRef.current;
    if (!image) return null;
    try { return managerRef.current?.createCompositeCanvas(image, true) ?? null; }
    catch { return null; }
  }

  function downloadColoredPainting() {
    if (!history.count) return;
    const output = createCompositeCanvas();
    if (!output) return;
    output.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${art.id}-be-to-mau.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    }, "image/png");
  }

  function printPainting() {
    const output = createCompositeCanvas();
    if (output) printColoringImage(output.toDataURL("image/png"), art.title);
  }

  const previewDiameter = Math.max(8, Math.round(brushSize * 0.48));

  return (
    <>
      <div
        ref={stageRef}
        className={`coloring-paint-stage ${isPanMode ? "is-pan-mode" : ""} ${isDragging ? "is-dragging" : ""} ${isPinching ? "is-pinching" : ""}`}
        data-zoom={zoom}
        onPointerDownCapture={trackTouchStart}
        onPointerMoveCapture={trackTouchMove}
        onPointerUpCapture={trackTouchEnd}
        onPointerCancelCapture={trackTouchEnd}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={finishPan}
        onPointerCancel={finishPan}
        onWheel={zoomWithWheel}
        onDoubleClickCapture={resetViewFromDoubleClick}
      >
        <div ref={viewportContentRef} className="coloring-zoom-surface">
          <div className="coloring-paper">
            <div className="coloring-paper-heading"><span>SunShinSon</span><strong>Tranh của {childName}</strong></div>
            <div className="coloring-canvas-wrap">
              <img ref={imageRef} src={art.src} alt={art.title} onLoad={prepareCanvas} draggable={false} />
              <canvas
                ref={canvasRef}
                className={`${isEraser ? "is-erasing" : ""} ${isPanMode ? "is-panning" : ""} ${isBucket ? "is-bucket" : ""}`}
                onPointerEnter={updateBrushCursor}
                onPointerDown={startStroke}
                onPointerMove={continueStroke}
                onPointerUp={finishStroke}
                onPointerCancel={finishStroke}
                onPointerLeave={() => {
                  if (activePointerRef.current === null) hideBrushCursor();
                }}
                aria-label={`Vùng tô màu cho tranh ${art.title}`}
              />
              {isFilling ? <div className="coloring-fill-loading" role="status"><span />Đang đổ màu...</div> : null}
            </div>
            <p>{art.title}</p>
          </div>
        </div>
        <span
          ref={brushCursorRef}
          aria-hidden="true"
          className={`coloring-brush-cursor ${isEraser ? "is-eraser" : ""}`}
          style={{
            backgroundColor: isEraser ? "rgba(255,255,255,.72)" : `${color}55`,
            borderColor: isEraser ? "#2e261e" : color,
            height: Math.max(6, brushSize),
            width: Math.max(6, brushSize),
          }}
        />
      </div>

      <div className="coloring-paint-tools">
        <div className="coloring-paint-heading"><strong>🎨 Hộp màu của bé</strong><span>Bút, đổ màu hoặc phóng to để tô chi tiết</span></div>
        <div className="coloring-zoom-tools" role="group" aria-label="Thu phóng và di chuyển tranh">
          <button onClick={() => updateZoom(zoom - 25)} disabled={zoom <= 50} aria-label="Thu nhỏ tranh">−</button>
          <label>
            <span>Thu phóng</span>
            <input type="range" min="50" max="500" step="1" value={zoom} onChange={(event) => updateZoom(Number(event.target.value))} aria-label="Mức thu phóng tranh" />
          </label>
          <output aria-live="polite">{zoom}%</output>
          <button onClick={() => updateZoom(zoom + 25)} disabled={zoom >= 500} aria-label="Phóng to tranh">＋</button>
          <button className={isPanMode ? "is-active" : ""} onClick={() => setIsPanMode((value) => !value)} aria-pressed={isPanMode} disabled={zoom <= 100}>
            {isPanMode ? "✎ Tô tiếp" : "✥ Di chuyển"}
          </button>
          <button onClick={resetView} disabled={zoom === 100} aria-label="Đặt lại góc nhìn">⟲ Reset View</button>
        </div>
        <p className="coloring-pan-tip">1 ngón để tô · 2 ngón để thu phóng và kéo · nhấp đúp để về 100% · chọn Di chuyển nếu muốn kéo bằng 1 ngón</p>
        <div className="coloring-palette" role="group" aria-label="Chọn màu vẽ">
          {palette.map((item) => (
            <button key={item.color} className={color === item.color && !isEraser ? "is-active" : ""} style={{ backgroundColor: item.color }}
              onClick={() => { setColor(item.color); if (tool === "eraser") setTool("brush"); }} aria-label={`Màu ${item.name}`} title={item.name} />
          ))}
          <label className="coloring-custom-color" title="Chọn màu khác">
            <input type="color" value={color} onChange={(event) => { setColor(event.target.value); if (tool === "eraser") setTool("brush"); }} aria-label="Chọn màu tùy ý" />
            <span>＋</span>
          </label>
        </div>
        <div className="coloring-bucket-row">
          <button className={tool === "bucket" ? "is-active" : ""} onClick={() => { setTool("bucket"); setIsPanMode(false); }} aria-pressed={tool === "bucket"}>▰ Đổ màu</button>
          <label>
            <span>Dung sai</span>
            <input type="range" min="0" max="255" step="1" value={tolerance} onChange={(event) => setTolerance(Number(event.target.value))} aria-label="Dung sai đổ màu" />
            <output>{tolerance}</output>
          </label>
        </div>
        {fillMessage ? <p className="coloring-fill-message" role="status">{fillMessage}</p> : null}
        <div className="coloring-brush-presets" role="group" aria-label="Chọn nhanh cỡ bút">
          {brushPresets.map((preset) => {
            const dotSize = Math.max(7, Math.round(preset.size * 0.34));
            return (
              <button key={preset.size} className={brushSize === preset.size ? "is-active" : ""} onClick={() => { setBrushSize(preset.size); setTool("brush"); }} aria-pressed={brushSize === preset.size}>
                <span className="coloring-brush-preset-dot" style={{ width: dotSize, height: dotSize, backgroundColor: isEraser ? "#fff" : color }} aria-hidden="true" />
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>
        <div className="coloring-tool-row">
          <button className={tool === "brush" ? "is-active" : ""} onClick={() => { setTool("brush"); setIsPanMode(false); }}>✎ Bút màu</button>
          <button className={tool === "eraser" ? "is-active" : ""} onClick={() => { setTool("eraser"); setIsPanMode(false); }}>▱ Tẩy</button>
          <label className="coloring-brush-size">
            <span>Nét</span>
            <span className="coloring-brush-size-dot" style={{ width: previewDiameter, height: previewDiameter, backgroundColor: isEraser ? "#fff" : color }} aria-hidden="true" />
            <input type="range" min="10" max="72" step="2" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} aria-label="Độ dày nét vẽ" />
            <output aria-live="polite">{brushSize}</output>
          </label>
          <button onClick={() => managerRef.current?.undo()} disabled={!history.canUndo}>↶ Hoàn tác</button>
          <button onClick={() => managerRef.current?.redo()} disabled={!history.canRedo}>↷ Làm lại</button>
          <button onClick={clearPainting} disabled={!history.count}>× Xóa màu</button>
        </div>
      </div>

      <div className="coloring-preview-actions coloring-paint-actions">
        <button onClick={printPainting}>⌁ In tranh</button>
        <button className="coloring-download-painted" onClick={downloadColoredPainting} disabled={!history.count}>↓ Tải tranh đã tô</button>
      </div>
    </>
  );
}
