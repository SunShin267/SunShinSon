import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workerSource = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

test("prevents browsers and the CDN from serving stale page code", () => {
  assert.match(workerSource, /function preventDocumentCaching/u);
  assert.match(workerSource, /text\/html/u);
  assert.match(workerSource, /text\/x-component/u);
  assert.match(workerSource, /Cache-Control", "no-store, no-cache, must-revalidate, max-age=0/u);
  assert.match(workerSource, /CDN-Cache-Control", "no-store/u);
  assert.match(workerSource, /return preventDocumentCaching\(request, response\)/u);
});
