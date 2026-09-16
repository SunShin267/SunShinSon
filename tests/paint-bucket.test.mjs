import assert from "node:assert/strict";
import test from "node:test";

import { BucketFillCommand, BucketFillTool, ColorHelper } from "../app/to-mau/paint-bucket.ts";

test("ColorHelper supports tolerance and transparent RGBA pixels", () => {
  const pixels = new Uint8ClampedArray([
    250, 250, 250, 255,
    12, 34, 56, 0,
  ]);

  assert.equal(ColorHelper.matches(pixels, 0, { r: 255, g: 255, b: 255, a: 255 }, 5), true);
  assert.equal(ColorHelper.matches(pixels, 0, { r: 255, g: 255, b: 255, a: 255 }, 2), false);
  assert.equal(ColorHelper.distance({ r: 12, g: 34, b: 56, a: 0 }, { r: 255, g: 0, b: 0, a: 0 }), 0);
});

test("ColorHelper protects antialiased dark outlines", () => {
  const white = { r: 255, g: 255, b: 255, a: 255 };
  assert.equal(ColorHelper.isAntiAliasedEdge({ r: 150, g: 150, b: 150, a: 255 }, white, 32), true);
  assert.equal(ColorHelper.isAntiAliasedEdge({ r: 245, g: 245, b: 245, a: 255 }, white, 32), false);
});

test("BucketFillCommand replays compact connected spans", () => {
  const fills = [];
  const context = {
    fillRect: (...args) => fills.push(args),
    restore() {},
    save() {},
    set fillStyle(value) { this.currentFill = value; },
    set globalCompositeOperation(value) { this.composite = value; },
  };
  const command = new BucketFillCommand(new Uint32Array([2, 3, 7, 3, 4, 6]), "#ef4444");

  command.apply(context);

  assert.deepEqual(fills, [[3, 2, 5, 1], [4, 3, 3, 1]]);
  assert.equal(context.currentFill, "#ef4444");
  assert.equal(context.composite, "source-over");
});

test("BucketFillTool fills only the connected side of a black outline", async () => {
  const width = 7;
  const height = 5;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const isInk = x === 0 || x === width - 1 || y === 0 || y === height - 1 || x === 3;
      data.set(isInk ? [0, 0, 0, 255] : [255, 255, 255, 255], offset);
    }
  }
  const source = {
    width,
    height,
    getContext: () => ({ getImageData: () => ({ data, width, height }) }),
  };
  const manager = { createCompositeCanvas: () => source };
  const command = await new BucketFillTool(manager, {}).createCommand({ color: "#22c55e", tolerance: 24, x: 1, y: 2 });
  const fills = [];
  const context = {
    fillRect: (...args) => fills.push(args),
    restore() {},
    save() {},
    set fillStyle(value) { this.currentFill = value; },
    set globalCompositeOperation(value) { this.composite = value; },
  };

  command.apply(context);

  assert.deepEqual(fills.sort((left, right) => left[1] - right[1]), [[1, 1, 2, 1], [1, 2, 2, 1], [1, 3, 2, 1]]);
});
