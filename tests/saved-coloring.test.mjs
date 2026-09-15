import assert from "node:assert/strict";
import test from "node:test";

import {
  addSavedColoringArt,
  isSavedColoringCollection,
  MAX_SAVED_COLORING_ARTS,
} from "../app/to-mau/saved-coloring.ts";

function sample(id, src = "data:image/jpeg;base64,ZmFrZQ==") {
  return {
    id: `sun-ai-${id}`,
    title: `Tranh ${id}`,
    prompt: `Ý tưởng ${id}`,
    src,
    icon: "💛",
    theme: "Mẫu của bé",
    generated: true,
    saved: true,
    savedAt: Number(id) || 1,
  };
}

test("validates safe saved coloring collections", () => {
  assert.equal(isSavedColoringCollection([sample("1")]), true);
  assert.equal(isSavedColoringCollection([{ ...sample("1"), src: "javascript:alert(1)" }]), false);
});

test("adds the newest generated art first and removes duplicate ids", () => {
  const result = addSavedColoringArt([sample("1"), sample("2")], sample("2"));
  assert.deepEqual(result.map((art) => art.id), ["sun-ai-2", "sun-ai-1"]);
});

test("keeps the saved collection within its item limit", () => {
  const current = Array.from({ length: MAX_SAVED_COLORING_ARTS }, (_, index) => sample(String(index + 1)));
  const result = addSavedColoringArt(current, sample("new"));
  assert.equal(result.length, MAX_SAVED_COLORING_ARTS);
  assert.equal(result[0].id, "sun-ai-new");
});

