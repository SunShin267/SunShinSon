"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import type { ColoringArt } from "./coloring-arts";

type Point = { x: number; y: number };
type Stroke = { color: string; eraser: boolean; points: Point[]; size: number };
type BrushCursor = { x: number; y: number; scale: number; visible: boolean };

const palette = [
  { color: "#ef4444", name: "Đỏ" }, { color: "#f97316", name: "Cam" },
  { color: "#facc15", name: "Vàng" }, { color: "#22c55e", name: "Xanh lá" },
  { color: "#38bdf8", name: "Xanh da trời" }, { color: "#6366f1", name: "Chàm" },
  { color: "#a855f7", name: "Tím" }, { color: "#ec4899", name: "Hồng" },
  { color: "#92400e", name: "Nâu" }, { color: "#111827", name: "Đen" },
];

function drawDot(context: CanvasRenderingContext2D, stroke: Stroke, point: Point) {
  context.save();
  context.globalCompositeOperation = stroke.eraser ? "destination-out" : "source-over";
  context.fillStyle = stroke.color;
  context.beginPath();
  context.arc(point.x, point.y, stroke.size / 2, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSegment(context: CanvasRenderingContext2D, stroke: Stroke, from: Point, to: Point) {
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

function drawWholeStroke(context: CanvasRenderingContext2D, stroke: Stroke) {
  const first = stroke.points[0];
  if (!first) return;
  drawDot(context, stroke, first);
  for (let index = 1; index < stroke.points.length; index += 1) {
    drawSegment(context, stroke, stroke.points[index - 1], stroke.points[index]);
  }
}

export function ColoringCanvas({ art, childName }: { art: ColoringArt; childName: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const [color, setColor] = useState(palette[0].color);
  const [brushSize, setBrushSize] = useState(28);
  const [isEraser, setIsEraser] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const [brushCursor, setBrushCursor] = useState<BrushCursor>({ x: 0, y: 0, scale: 1, visible: false });

  function redraw() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    strokesRef.current.forEach((stroke) => drawWholeStroke(context, stroke));
  }

  function prepareCanvas() {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas || !image.naturalWidth || !image.naturalHeight) return;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    strokesRef.current = [];
    activeStrokeRef.current = null;
    activePointerRef.current = null;
    setStrokeCount(0);
    redraw();
  }

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>): Point {
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

  function startStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    updateBrushCursor(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    const stroke: Stroke = { color, eraser: isEraser, points: [point], size: brushSize };
    activePointerRef.current = event.pointerId;
    activeStrokeRef.current = stroke;
    const context = canvasRef.current?.getContext("2d");
    if (context) drawDot(context, stroke, point);
  }

  function continueStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    updateBrushCursor(event);
    const stroke = activeStrokeRef.current;
    if (!stroke || activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    const previous = stroke.points[stroke.points.length - 1];
    stroke.points.push(point);
    const context = canvasRef.current?.getContext("2d");
    if (context) drawSegment(context, stroke, previous, point);
  }

  function finishStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    const stroke = activeStrokeRef.current;
    if (!stroke || activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    strokesRef.current.push(stroke);
    activeStrokeRef.current = null;
    activePointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setStrokeCount(strokesRef.current.length);
  }

  function undo() {
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    redraw();
  }

  function clearPainting() {
    if (!strokeCount || !window.confirm("Xóa toàn bộ màu bé đã tô trên tranh này?")) return;
    strokesRef.current = [];
    setStrokeCount(0);
    redraw();
  }

  function downloadColoredPainting() {
    const image = imageRef.current;
    const paintCanvas = canvasRef.current;
    if (!image || !paintCanvas || !strokeCount) return;
    const output = document.createElement("canvas");
    output.width = paintCanvas.width;
    output.height = paintCanvas.height;
    const context = output.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(image, 0, 0, output.width, output.height);
    context.globalCompositeOperation = "multiply";
    context.drawImage(paintCanvas, 0, 0);
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

  const cursorDiameter = Math.max(6, brushSize * brushCursor.scale);
  const previewDiameter = Math.max(8, Math.round(brushSize * 0.48));

  return (
    <>
      <div className="coloring-paper">
        <div className="coloring-paper-heading"><span>SunShinSon</span><strong>Tranh của {childName}</strong></div>
        <div className="coloring-canvas-wrap">
          <img ref={imageRef} src={art.src} alt={art.title} onLoad={prepareCanvas} draggable={false} />
          <canvas
            ref={canvasRef}
            className={isEraser ? "is-erasing" : ""}
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
              opacity: brushCursor.visible ? 1 : 0,
              top: brushCursor.y,
              width: cursorDiameter,
            }}
          />
        </div>
        <p>{art.title}</p>
      </div>

      <div className="coloring-paint-tools">
        <div className="coloring-paint-heading"><strong>🎨 Hộp màu của bé</strong><span>Chạm hoặc kéo chuột trên tranh</span></div>
        <div className="coloring-palette" role="group" aria-label="Chọn màu vẽ">
          {palette.map((item) => (
            <button key={item.color} className={color === item.color && !isEraser ? "is-active" : ""} style={{ backgroundColor: item.color }}
              onClick={() => { setColor(item.color); setIsEraser(false); }} aria-label={`Màu ${item.name}`} title={item.name} />
          ))}
        </div>
        <div className="coloring-tool-row">
          <button className={!isEraser ? "is-active" : ""} onClick={() => setIsEraser(false)}>✎ Bút màu</button>
          <button className={isEraser ? "is-active" : ""} onClick={() => setIsEraser(true)}>▱ Tẩy</button>
          <label className="coloring-brush-size">
            <span>Nét</span>
            <span className="coloring-brush-size-dot" style={{ width: previewDiameter, height: previewDiameter, backgroundColor: isEraser ? "#fff" : color }} aria-hidden="true" />
            <input type="range" min="10" max="72" step="2" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} aria-label="Độ dày nét vẽ" />
            <output aria-live="polite">{brushSize}</output>
          </label>
          <button onClick={undo} disabled={!strokeCount}>↶ Hoàn tác</button>
          <button onClick={clearPainting} disabled={!strokeCount}>× Xóa màu</button>
        </div>
      </div>

      <div className="coloring-preview-actions coloring-paint-actions">
        <button onClick={() => window.print()}>⌁ In tranh</button>
        <button className="coloring-download-painted" onClick={downloadColoredPainting} disabled={!strokeCount}>↓ Tải tranh đã tô</button>
      </div>
    </>
  );
}
