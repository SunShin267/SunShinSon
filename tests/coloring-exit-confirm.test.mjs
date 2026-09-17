import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(new URL("../app/to-mau/page.tsx", import.meta.url), "utf8");
const canvasSource = await readFile(new URL("../app/to-mau/ColoringCanvas.tsx", import.meta.url), "utf8");

test("uses an in-app exit dialog instead of a browser-native confirm", () => {
  assert.match(pageSource, /role="alertdialog"/u);
  assert.match(pageSource, /Ở lại tô tiếp/u);
  assert.match(pageSource, /Lưu ảnh rồi thoát/u);
  assert.match(pageSource, /Thoát và bỏ nét tô/u);
  assert.doesNotMatch(pageSource, /window\.confirm\("Tranh của bé đang có thay đổi/u);
});

test("always asks for confirmation when the coloring popup is closed", () => {
  assert.match(pageSource, /if \(artModalMode === "paint"\) \{[\s\S]*?setShowExitConfirmation\(true\)/u);
  assert.doesNotMatch(pageSource, /artModalMode === "paint" && paintHasUnsavedChangesRef\.current/u);
  assert.match(pageSource, /Bé chưa có thay đổi nào cần lưu/u);
});

test("can save the current colored canvas locally before closing", () => {
  assert.match(pageSource, /coloringCanvasRef\.current\?\.saveToDevice\(\)/u);
  assert.match(canvasSource, /saveToDevice: downloadColoredPainting/u);
  assert.match(canvasSource, /downloadColoredPainting\(\): Promise<boolean>/u);
});

test("reports painting changes synchronously so immediate close is protected", () => {
  assert.match(pageSource, /paintHasUnsavedChangesRef\.current/u);
  assert.match(canvasSource, /function scheduleTapCommand[\s\S]*?onDirtyChange\?\.\(true\)/u);
  assert.match(canvasSource, /activeStrokeAppliedRef\.current = true;\s*onDirtyChange\?\.\(true\)/u);
});
