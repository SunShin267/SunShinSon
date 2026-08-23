import assert from "node:assert/strict";
import test from "node:test";

import { getPrintGeometry } from "../app/tim-so/print-geometry.ts";

const printStyles = await import("../app/tim-so/print-styles.ts").catch(() => ({}));

const PAGE_HEIGHT_MM = { portrait: 277, landscape: 190 };
const HEADER_HEIGHT_MM = 12;
const PRINT_SAFETY_GAP_MM = 2;

test("keeps the largest number board inside one A4 printable page", () => {
  const geometry = getPrintGeometry(500);

  assert.ok(geometry);
  const usedHeight = HEADER_HEIGHT_MM + geometry.rows * geometry.cellHeight;
  assert.ok(
    usedHeight <= PAGE_HEIGHT_MM[geometry.orientation] - PRINT_SAFETY_GAP_MM,
    `used ${usedHeight}mm in a ${PAGE_HEIGHT_MM[geometry.orientation]}mm page`,
  );
});

test("removes the game page from print layout before showing the A4 sheet", () => {
  assert.equal(typeof printStyles.getPrintDocumentCss, "function");

  const css = printStyles.getPrintDocumentCss("portrait");
  assert.match(css, /body\s*>\s*:not\(#number-hunt-print-sheet\)\s*{[^}]*display:\s*none\s*!important/i);
  assert.match(css, /#number-hunt-print-sheet\s*{[^}]*display:\s*block\s*!important/i);
  assert.match(css, /@page\s*{[^}]*size:\s*A4 portrait/i);
});
