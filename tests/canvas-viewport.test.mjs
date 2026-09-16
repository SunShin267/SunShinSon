import assert from "node:assert/strict";
import test from "node:test";

import {
  CanvasViewportController,
  canvasPointFromClient,
  clampViewScale,
  constrainViewTransform,
} from "../app/to-mau/canvas-viewport.ts";

test("viewport scale remains within 50% and 500% during repeated zoom", () => {
  let scale = 1;
  for (let index = 0; index < 100; index += 1) scale = clampViewScale(scale * 1.2);
  assert.equal(scale, 5);
  for (let index = 0; index < 100; index += 1) scale = clampViewScale(scale / 1.2);
  assert.equal(scale, 0.5);
});

test("pan constraints do not expose large blank areas", () => {
  const viewport = { width: 300, height: 240 };
  const content = { width: 300, height: 300 };
  assert.deepEqual(
    constrainViewTransform({ scale: 2, x: 200, y: -900 }, viewport, content),
    { scale: 2, x: 0, y: -360 },
  );
  assert.deepEqual(
    constrainViewTransform({ scale: 0.5, x: -200, y: 100 }, viewport, content),
    { scale: 0.5, x: 75, y: 45 },
  );
});

test("wheel and pinch zoom keep their visual anchor stable", () => {
  const viewport = { clientWidth: 300, clientHeight: 300 };
  const content = { offsetWidth: 300, offsetHeight: 300, style: { transform: "" } };
  const controller = new CanvasViewportController(viewport, content, () => {});

  controller.zoomAt(2, 150, 150);
  assert.deepEqual(controller.getState(), { scale: 2, x: -150, y: -150 });

  const start = controller.getState();
  controller.pinchFrom(start, 4, { x: 150, y: 150 }, { x: 170, y: 165 });
  assert.deepEqual(controller.getState(), { scale: 4, x: -430, y: -435 });
  assert.match(content.style.transform, /scale\(4\)/);
});

test("painting coordinates remain exact at minimum and maximum zoom", () => {
  const canvas = { width: 1000, height: 1000 };
  assert.deepEqual(
    canvasPointFromClient({ x: 200, y: 300 }, { left: 100, top: 200, width: 200, height: 200 }, canvas),
    { x: 500, y: 500 },
  );
  assert.deepEqual(
    canvasPointFromClient({ x: 2600, y: 2650 }, { left: 100, top: 150, width: 5000, height: 5000 }, canvas),
    { x: 500, y: 500 },
  );
});
