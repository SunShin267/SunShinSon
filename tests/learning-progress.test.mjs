import assert from "node:assert/strict";
import test from "node:test";

import { getProgressStorageKey, normalizeChildProfileName } from "../app/hoc-cung-be/progress.ts";

test("keeps learning progress isolated between child profiles", () => {
  assert.notEqual(getProgressStorageKey("An"), getProgressStorageKey("Bình"));
  assert.notEqual(getProgressStorageKey("Anh"), getProgressStorageKey("Ánh"));
});

test("reuses progress when the same child name has harmless formatting differences", () => {
  assert.equal(getProgressStorageKey("  THIỆN PHƯỚC "), getProgressStorageKey("thiện phước"));
  assert.equal(normalizeChildProfileName("Ａn"), "an");
});
