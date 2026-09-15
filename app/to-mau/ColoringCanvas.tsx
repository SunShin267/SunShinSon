"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type CanvasArt = {
  id: string;
  title: string;
  src: string;
  generated?: boolean;
};

type Point = { x: number; y: number };
type Stroke = {
  color: string;
  eraser: boolean;
  points: Point[];
  size: number;
};

const palette = [
  { color: "#ef4444", name: "Đỏ" },
  { color: "#f97316", name: "Cam" },
  { color: "#facc15", name: "Vàng" },
  { color: "#22c55e", name: "Xanh lá" },
  { color: "#38bdf8", name: "Xanh da trời" },
  { color: "#6366f1", name: "Chàm" },
  { color: "#a855f7", name: "Tím" },
  { color: "#ec4899", name: "Hồng" },
  { color: "#92400e", name: "Nâu" },
  { color: "#111827", name: "Đen" },
];

function baseDownloadExtension(src: string) {
  if (/\.webp(?:\?|$)/i.test(src) || src.startsWith("data:image/webp")) return "webp";
  if (/\.png(?:\?|$)/i.test(src) || src.startsWith("data:image/png")) return "png";
  return "jpg";
}

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

export function ColoringCanvas({
  art,
  childName,
  isSaved,
  onSave,
}: {
  art: CanvasArt;
  childName: string;
  isSaved: boolean;
  onSave: () => void;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const [color, setColor] = useState(palette[0].color);
  const [brushSize, setBrushSize] = useState(28);
  const [isEraser, setIsEraser] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);

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

  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete) prepareCanvas();
  }, [art.src]);

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function startStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    const stroke: Stroke = { color, eraser: isEraser, points: [point], size: brushSize };
    activePointerRef.current = event.pointerId;
    activeStrokeRef.current = stroke;
    const context = canvasRef.current?.getContext("2d");
    if (context) drawDot(context, stroke, point);
  }

  function continueStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
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

  return (
    <>
      <div className="coloring-paper">
        <div className="coloring-paper-heading"><span>SunShinSon</span><strong>Tranh của {childName}</strong></div>
        <div className="coloring-canvas-wrap">
          <img ref={imageRef} src={art.src} alt={art.title} onLoad={prepareCanvas} draggable={false} />
          <canvas
            ref={canvasRef}
            className={isEraser ? "is-erasing" : ""}
            onPointerDown={startStroke}
            onPointerMove={continueStroke}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
            aria-label={`Vùng tô màu cho tranh ${art.title}`}
          />
        </div>
        <p>{art.title}</p>
      </div>

      <div className="coloring-paint-tools">
        <div className="coloring-paint-heading"><strong>🎨 Tô trực tiếp</strong><span>Chạm hoặc kéo chuột trên tranh</span></div>
        <div className="coloring-palette" role="group" aria-label="Chọn màu vẽ">
          {palette.map((item) => (
            <button
              key={item.color}
              className={color === item.color && !isEraser ? "is-active" : ""}
              style={{ backgroundColor: item.color }}
              onClick={() => { setColor(item.color); setIsEraser(false); }}
              aria-label={`Màu ${item.name}`}
              title={item.name}
            />
          ))}
        </div>
        <div className="coloring-tool-row">
          <button className={!isEraser ? "is-active" : ""} onClick={() => setIsEraser(false)}>✎ Bút màu</button>
          <button className={isEraser ? "is-active" : ""} onClick={() => setIsEraser(true)}>▱ Tẩy</button>
          <label>Nét <input type="range" min="10" max="64" step="2" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} aria-label="Độ dày nét vẽ" /></label>
          <button onClick={undo} disabled={!strokeCount}>↶ Hoàn tác</button>
          <button onClick={clearPainting} disabled={!strokeCount}>× Xóa màu</button>
        </div>
      </div>

      <div className="coloring-preview-actions">
        <button onClick={() => window.print()}>⌁ In tranh</button>
        <a href={art.src} download={`${art.id}-sunshinson.${baseDownloadExtension(art.src)}`}>↓ Ảnh nét</a>
        <button className="coloring-download-painted" onClick={downloadColoredPainting} disabled={!strokeCount}>↓ Tranh đã tô</button>
        {art.generated ? (
          <button className="coloring-save" onClick={onSave} disabled={isSaved}>{isSaved ? "✓ Đã lưu" : "♡ Lưu vào mẫu"}</button>
        ) : null}
      </div>
    </>
  );
}

