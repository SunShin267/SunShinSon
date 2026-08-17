import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the personalized home greeting clear of the number board", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Xin chào, <span>\{name\}!<\/span>/);
  assert.match(page, /Chọn một hoạt động bé thích\{\" \"\}/);
  assert.match(page, /className="welcome-followup">và cùng SunShinSon khám phá nhé\.<\/span>/);
  assert.match(css, /\.welcome-followup\s*\{[^}]*display:\s*block/s);
  assert.match(css, /\.welcome-hero-copy\s*\{[^}]*padding:\s*46px 46px 46px 34px/s);
  assert.match(css, /\.welcome-hero-copy > p:last-of-type\s*\{[^}]*max-width:\s*225px/s);
});
