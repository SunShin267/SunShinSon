import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as rememberNumbers from "../app/nho-so/game.ts";

test("generates a deterministic digit sequence with the requested length", () => {
  const values = [0, 0.19, 0.55, 0.999];
  let index = 0;
  const sequence = rememberNumbers.generateDigitSequence(4, () => values[index++]);

  assert.equal(sequence, "0159");
});

test("normalizes input and compares every remembered position", () => {
  assert.equal(rememberNumbers.normalizeDigits("12 3a-45", 4), "1234");
  assert.deepEqual(rememberNumbers.evaluateRecall("38157", "38197"), {
    answer: "38197",
    correct: false,
    matched: 4,
    positions: [true, true, true, false, true],
  });
  assert.equal(rememberNumbers.evaluateRecall("38157", "38157").correct, true);
});

test("increases difficulty only after a fully correct answer", () => {
  assert.equal(rememberNumbers.getNextLength(5, true), 6);
  assert.equal(rememberNumbers.getNextLength(5, false), 5);
  assert.equal(rememberNumbers.getNextLength(24, true), 24);
  assert.ok(rememberNumbers.getMemorizeDurationMs(5, "focus") >= 2_000);
});

test("links the remember-numbers game from the home screen", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /id: "nho-so"/);
  assert.match(page, /"nho-so": "\/nho-so"/);
  assert.match(page, /9 hoạt động dành cho bé/);
});
