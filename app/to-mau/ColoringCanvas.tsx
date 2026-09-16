"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import type { ColoringArt } from "./coloring-arts";
import {
  BucketFillTool,
  CanvasManager,
  StrokeCommand,
  type CanvasPoint,
  type HistoryState,
  type StrokeData,
} from "./paint-bucket";
import { printColoringImage } from "./print-coloring";

type BrushCursor = { x: number; y: number; scale: number; visible: boolean };
type Tool = "brush" | "bucket" | "eraser";
type PanGesture = { pointerId: number; scrollLeft: number; scrollTop: number; x: number; y: number };

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

export function ColoringCanvas({ art, childName }: { art: ColoringArt; childName: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<CanvasManager | null>(null);
  const activeStrokeRef = useRef<StrokeData | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const panGestureRef = useRef<PanGesture | null>(null);
  const [color, setColor] = useState(palette[0].color);
  const [brushSize, setBrushSize] = useState(28);
  const [tool, setTool] = useState<Tool>("brush");
  const [isPanMode, setIsPanMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isFilling, setIsFilling] = useState(false);
  const [fillMessage, setFillMessage] = useState("");
  const [tolerance, setTolerance] = useState(32);
  const [zoom, setZoom] = useState(100);
  const [history, setHistory] = useState<HistoryState>(emptyHistory);
  const [brushCursor, setBrushCursor] = useState<BrushCursor>({ x: 0, y: 0, scale: 1, visible: false });

  const isEraser = tool === "eraser";
  const isBucket = tool === "bucket";

  function prepareCanvas() {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas || !image.naturalWidth || !image.naturalHeight) return;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    managerRef.current = new CanvasManager(canvas, setHistory);
    activeStrokeRef.current = null;
    activePointerRef.current = null;
    panGestureRef.current = null;
    setHistory(emptyHistory);
    setIsPanMode(false);
    setIsDragging(false);
    setZoom(100);
  }

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>): CanvasPoint {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function updateBrushCursor(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setBrushCursor({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      scale: canvas.width ? rect.width / canvas.width : 1,
      visible: event.pointerType !== "touch",
    });
  }

  async function fillAt(point: CanvasPoint) {
    const manager = managerRef.current;
    const image = imageRef.current;
    if (!manager || !image || isFilling) return;
    setIsFilling(true);
    setFillMessage("");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const command = await new BucketFillTool(manager, image).createCommand({ color, tolerance, x: point.x, y: point.y });
      if (command) manager.commit(command);
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
    if (isPanMode || isFilling) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    updateBrushCursor(event);
    const point = pointFromEvent(event);
    if (isBucket) {
      void fillAt(point);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const stroke: StrokeData = { color, eraser: isEraser, points: [point], size: brushSize };
    activePointerRef.current = event.pointerId;
    activeStrokeRef.current = stroke;
    const context = event.currentTarget.getContext("2d");
    if (context) new StrokeCommand(stroke).apply(context);
  }

  function continueStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (isPanMode || isBucket) return;
    updateBrushCursor(event);
    const stroke = activeStrokeRef.current;
    if (!stroke || activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    const previous = stroke.points[stroke.points.length - 1];
    stroke.points.push(point);
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
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
    if (isPanMode || isBucket) return;
    const stroke = activeStrokeRef.current;
    if (!stroke || activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    managerRef.current?.commit(new StrokeCommand(stroke), true);
    activeStrokeRef.current = null;
    activePointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function updateZoom(nextZoom: number) {
    const next = Math.min(300, Math.max(50, nextZoom));
    const stage = stageRef.current;
    const centerX = stage ? stage.scrollLeft + stage.clientWidth / 2 : 0;
    const centerY = stage ? stage.scrollTop + stage.clientHeight / 2 : 0;
    const ratio = next / zoom;
    setZoom(next);
    if (next > 100 && zoom <= 100) setIsPanMode(true);
    if (next <= 100) setIsPanMode(false);
    requestAnimationFrame(() => {
      if (!stage) return;
      stage.scrollLeft = centerX * ratio - stage.clientWidth / 2;
      stage.scrollTop = centerY * ratio - stage.clientHeight / 2;
    });
  }

  function beginPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isPanMode || zoom <= 100) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panGestureRef.current = {
      pointerId: event.pointerId,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
      x: event.clientX,
      y: event.clientY,
    };
    setIsDragging(true);
  }

  function movePan(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = panGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.currentTarget.scrollLeft = gesture.scrollLeft - (event.clientX - gesture.x);
    event.currentTarget.scrollTop = gesture.scrollTop - (event.clientY - gesture.y);
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

  const cursorDiameter = Math.max(6, brushSize * brushCursor.scale);
  const previewDiameter = Math.max(8, Math.round(brushSize * 0.48));

  return (
    <>
      <div
        ref={stageRef}
        className={`coloring-paint-stage ${isPanMode ? "is-pan-mode" : ""} ${isDragging ? "is-dragging" : ""}`}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={finishPan}
        onPointerCancel={finishPan}
      >
        <div className="coloring-zoom-surface" style={{ width: `${zoom}%` }}>
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
                  if (activePointerRef.current === null) setBrushCursor((cursor) => ({ ...cursor, visible: false }));
                }}
                aria-label={`Vùng tô màu cho tranh ${art.title}`}
              />
              <span
                aria-hidden="true"
                className={`coloring-brush-cursor ${isEraser ? "is-eraser" : ""}`}
                style={{
                  backgroundColor: isEraser ? "rgba(255,255,255,.72)" : `${color}55`,
                  borderColor: isEraser ? "#2e261e" : color,
                  height: cursorDiameter,
                  left: brushCursor.x,
                  opacity: brushCursor.visible && !isPanMode && !isBucket ? 1 : 0,
                  top: brushCursor.y,
                  width: cursorDiameter,
                }}
              />
              {isFilling ? <div className="coloring-fill-loading" role="status"><span />Đang đổ màu...</div> : null}
            </div>
            <p>{art.title}</p>
          </div>
        </div>
      </div>

      <div className="coloring-paint-tools">
        <div className="coloring-paint-heading"><strong>🎨 Hộp màu của bé</strong><span>Bút, đổ màu hoặc phóng to để tô chi tiết</span></div>
        <div className="coloring-zoom-tools" role="group" aria-label="Thu phóng và di chuyển tranh">
          <button onClick={() => updateZoom(zoom - 25)} disabled={zoom <= 50} aria-label="Thu nhỏ tranh">−</button>
          <label>
            <span>Thu phóng</span>
            <input type="range" min="50" max="300" step="25" value={zoom} onChange={(event) => updateZoom(Number(event.target.value))} aria-label="Mức thu phóng tranh" />
          </label>
          <output aria-live="polite">{zoom}%</output>
          <button onClick={() => updateZoom(zoom + 25)} disabled={zoom >= 300} aria-label="Phóng to tranh">＋</button>
          <button className={isPanMode ? "is-active" : ""} onClick={() => setIsPanMode((value) => !value)} aria-pressed={isPanMode} disabled={zoom <= 100}>
            {isPanMode ? "✎ Tô tiếp" : "✥ Di chuyển"}
          </button>
        </div>
        {zoom > 100 ? <p className="coloring-pan-tip">Phóng to xong, chọn “Di chuyển”, rồi chạm giữ và kéo tranh.</p> : null}
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
