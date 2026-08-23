import assert from "node:assert/strict";
import test from "node:test";

import * as numberHunt from "../app/tim-so/game.ts";

test("staggers neighboring numbers without moving them outside their cells", () => {
  assert.equal(typeof numberHunt.getNumberOffset, "function");

  const offsets = Array.from({ length: 24 }, (_, index) => numberHunt.getNumberOffset(index));
  assert.deepEqual(offsets.slice(0, 4), [
    { x: -12, y: 8 },
    { x: 6, y: -12 },
    { x: 14, y: 3 },
    { x: -6, y: 14 },
  ]);
  assert.ok(offsets.every(({ x, y }) => Math.abs(x) <= 14 && Math.abs(y) <= 14));
  assert.ok(offsets.every((offset, index) => index === 0 || offset.x !== offsets[index - 1].x || offset.y !== offsets[index - 1].y));
});
