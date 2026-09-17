export const MIN_VIEW_SCALE = 0.5;
export const MAX_VIEW_SCALE = 5;

export type ViewTransform = { scale: number; x: number; y: number };
export type ViewSize = { height: number; width: number };
export type ClientPoint = { x: number; y: number };
export type TimedClientPoint = ClientPoint & { time: number };
export type ClientRectLike = { height: number; left: number; top: number; width: number };

export function clampViewScale(scale: number) {
  return Math.min(MAX_VIEW_SCALE, Math.max(MIN_VIEW_SCALE, scale));
}

/** Recognizes two nearby taps without relying on browser-synthesized click events. */
export function isDoubleTap(
  previous: TimedClientPoint | null,
  current: TimedClientPoint,
  maximumDelay = 450,
  maximumDistance = 36,
) {
  if (!previous) return false;
  const elapsed = current.time - previous.time;
  return elapsed >= 0
    && elapsed <= maximumDelay
    && Math.hypot(current.x - previous.x, current.y - previous.y) <= maximumDistance;
}

/** Maps a transformed CSS position back to the canvas' stable pixel space. */
export function canvasPointFromClient(
  point: ClientPoint,
  rect: ClientRectLike,
  canvas: ViewSize,
): ClientPoint {
  if (!rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: (point.x - rect.left) * canvas.width / rect.width,
    y: (point.y - rect.top) * canvas.height / rect.height,
  };
}

/**
 * Keeps the transformed artwork touching the viewport edges. When an axis is
 * smaller than the viewport, the artwork is centered instead of leaving a
 * large blank area on one side.
 */
export function constrainViewTransform(
  transform: ViewTransform,
  viewport: ViewSize,
  content: ViewSize,
): ViewTransform {
  const scale = clampViewScale(transform.scale);
  const scaledWidth = content.width * scale;
  const scaledHeight = content.height * scale;
  const x = scaledWidth <= viewport.width
    ? (viewport.width - scaledWidth) / 2
    : Math.min(0, Math.max(viewport.width - scaledWidth, transform.x));
  const y = scaledHeight <= viewport.height
    ? (viewport.height - scaledHeight) / 2
    : Math.min(0, Math.max(viewport.height - scaledHeight, transform.y));
  return { scale, x, y };
}

/**
 * Owns only viewport math and CSS transforms. Drawing and flood-fill remain
 * independent, which keeps canvas pixel coordinates stable at every zoom.
 */
export class CanvasViewportController {
  private state: ViewTransform = { scale: 1, x: 0, y: 0 };
  private readonly viewport: HTMLElement;
  private readonly content: HTMLElement;
  private readonly onChange: (state: ViewTransform) => void;

  constructor(
    viewport: HTMLElement,
    content: HTMLElement,
    onChange: (state: ViewTransform) => void,
  ) {
    this.viewport = viewport;
    this.content = content;
    this.onChange = onChange;
    this.reset();
  }

  getState() { return { ...this.state }; }

  reset() {
    const viewport = this.viewportSize();
    const content = this.contentSize();
    this.setState({
      scale: 1,
      x: (viewport.width - content.width) / 2,
      y: (viewport.height - content.height) / 2,
    });
  }

  zoomAt(nextScale: number, anchorX: number, anchorY: number) {
    const scale = clampViewScale(nextScale);
    const ratio = scale / this.state.scale;
    this.setState({
      scale,
      x: anchorX - (anchorX - this.state.x) * ratio,
      y: anchorY - (anchorY - this.state.y) * ratio,
    });
  }

  /** Applies pinch scale and translation from one immutable gesture snapshot. */
  pinchFrom(
    start: ViewTransform,
    nextScale: number,
    startCenter: { x: number; y: number },
    currentCenter: { x: number; y: number },
  ) {
    const scale = clampViewScale(nextScale);
    const ratio = scale / start.scale;
    this.setState({
      scale,
      x: currentCenter.x - (startCenter.x - start.x) * ratio,
      y: currentCenter.y - (startCenter.y - start.y) * ratio,
    });
  }

  panFrom(start: ViewTransform, deltaX: number, deltaY: number) {
    this.setState({ scale: start.scale, x: start.x + deltaX, y: start.y + deltaY });
  }

  refreshBounds() { this.setState(this.state); }

  private setState(next: ViewTransform) {
    this.state = constrainViewTransform(next, this.viewportSize(), this.contentSize());
    this.content.style.transform = `translate3d(${this.state.x}px, ${this.state.y}px, 0) scale(${this.state.scale})`;
    this.onChange(this.getState());
  }

  private viewportSize(): ViewSize {
    return { width: this.viewport.clientWidth, height: this.viewport.clientHeight };
  }

  private contentSize(): ViewSize {
    return { width: this.content.offsetWidth, height: this.content.offsetHeight };
  }
}
