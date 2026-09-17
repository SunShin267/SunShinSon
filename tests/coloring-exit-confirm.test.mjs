import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(new URL("../app/to-mau/page.tsx", import.meta.url), "utf8");
const canvasSource = await readFile(new URL("../app/to-mau/ColoringCanvas.tsx", import.meta.url), "utf8");

test("uses an in-app exit dialog instead of a browser-native confirm", () => {
  assert.match(pageSource, /role="alertdialog"/u);
  assert.match(pageSource, /Ở lại tô tiếp/u);
  assert.match(pageSource, /Thoát và bỏ nét tô/u);
  assert.doesNotMatch(pageSource, /window\.confirm\("Tranh của bé đang có thay đổi/u);
});

test("reports painting changes synchronously so immediate close is protected", () => {
  assert.match(pageSource, /paintHasUnsavedChangesRef\.current/u);
  assert.match(canvasSource, /function scheduleTapCommand[\s\S]*?onDirtyChange\?\.\(true\)/u);
  assert.match(canvasSource, /activeStrokeAppliedRef\.current = true;\s*onDirtyChange\?\.\(true\)/u);
});
