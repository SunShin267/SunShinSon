# Number Hunt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a playable ordered Number Hunt with a verified one-sheet A4 print mode for every allowed board size.

**Architecture:** Keep shuffle, progression, and print geometry as pure functions. The route component owns timers and interaction state; a separate print sheet receives an immutable shuffled array and measures itself before printing.

**Tech Stack:** React 19.2.6, TypeScript 5.9.3, Vitest 4.1.10, CSS Grid, browser print CSS

## Global Constraints

- This plan starts only after `2026-08-16-home-games-foundation.md` passes.
- `N` is an integer from 10 through 500; default 100.
- The play sequence is exactly 1 through `N`, and a wrong choice never advances progress.
- A correct number is circled and cannot be selected again.
- Printing uses a fresh shuffle and never mutates the live game.
- Every printed value must fit on one A4 sheet with no missing, duplicate, clipped, or split cell.
- Print acceptance sizes are exactly 10, 100, 200, and 500.

---

## File Structure

- `app/tim-so/number-hunt-engine.ts`: construction, shuffle, and selection transitions.
- `app/tim-so/print-layout.ts`: deterministic A4 geometry.
- `app/tim-so/NumberGrid.tsx`: accessible interactive grid.
- `app/tim-so/NumberHuntGame.tsx`: setup, timer, feedback, and completion UI.
- `app/tim-so/PrintSheet.tsx`: isolated print DOM and preflight measurement.
- `app/tim-so/page.tsx`: route wrapper.
- `app/tim-so/number-hunt.css`: screen and `@media print` styles.
- `tests/number-hunt-engine.test.ts`, `tests/number-print-layout.test.ts`, `tests/number-hunt-flow.test.tsx`: verification.

### Task 1: Build the pure Number Hunt engine

**Files:**
- Create: `app/tim-so/number-hunt-engine.ts`
- Test: `tests/number-hunt-engine.test.ts`

**Interfaces:**
- Produces: `createSequence(max: number): number[]`.
- Produces: `shuffleNumbers(values: readonly number[], random?: () => number): number[]`.
- Produces: `selectNumber(state: HuntProgress, selected: number): HuntProgress`.

- [ ] **Step 1: Write failing invariant and transition tests**

```ts
it("creates every number exactly once", () => expect(createSequence(200)).toEqual(Array.from({ length: 200 }, (_, i) => i + 1)));
it("does not mutate the source while shuffling", () => {
  const source = [1, 2, 3, 4];
  expect(shuffleNumbers(source, () => 0)).not.toBe(source);
  expect(source).toEqual([1, 2, 3, 4]);
});
it("records an error without advancing", () => expect(selectNumber({ next: 3, mistakes: 0, complete: false }, 7)).toEqual({ next: 3, mistakes: 1, complete: false }));
```

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/number-hunt-engine.test.ts`

Expected: FAIL on missing engine.

- [ ] **Step 3: Implement validation, Fisher-Yates, and transitions**

```ts
export type HuntProgress = { next: number; mistakes: number; complete: boolean; max: number };
export function createSequence(max: number) {
  if (!Number.isInteger(max) || max < 10 || max > 500) throw new RangeError("MAX_OUT_OF_RANGE");
  return Array.from({ length: max }, (_, index) => index + 1);
}
```

Implement Fisher-Yates from the last index to 1. `selectNumber` ignores input after completion, increments mistakes on wrong input, and marks complete when `selected === max`.

- [ ] **Step 4: Verify green**

Run: `npm run test:unit -- tests/number-hunt-engine.test.ts`

Expected: validation, immutability, shuffle, wrong/correct/completion cases pass.

- [ ] **Step 5: Commit**

```bash
git add app/tim-so/number-hunt-engine.ts tests/number-hunt-engine.test.ts
git commit -m "feat: add Number Hunt engine"
```

### Task 2: Calculate one-page A4 geometry

**Files:**
- Create: `app/tim-so/print-layout.ts`
- Test: `tests/number-print-layout.test.ts`

**Interfaces:**
- Produces: `calculatePrintLayout(count: number): PrintLayout`.
- Produces: `validatePrintValues(values: readonly number[], max: number): boolean`.

- [ ] **Step 1: Write failing print geometry tests**

```ts
it.each([10, 100, 200, 500])("fits %i values in one printable box", (count) => {
  const layout = calculatePrintLayout(count);
  expect(layout.rows * layout.columns).toBeGreaterThanOrEqual(count);
  expect(layout.gridWidthMm).toBeLessThanOrEqual(layout.printableWidthMm);
  expect(layout.gridHeightMm).toBeLessThanOrEqual(layout.printableHeightMm);
});
it("rejects duplicate or absent values", () => expect(validatePrintValues([1, 2, 2], 3)).toBe(false));
```

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/number-print-layout.test.ts`

Expected: FAIL on missing layout module.

- [ ] **Step 3: Implement a bounded layout search**

```ts
export type PrintLayout = {
  orientation: "portrait" | "landscape";
  rows: number;
  columns: number;
  cellWidthMm: number;
  cellHeightMm: number;
  fontSizePt: number;
  gridWidthMm: number;
  gridHeightMm: number;
  printableWidthMm: number;
  printableHeightMm: number;
};
```

Use 6 mm page margins and reserve 18 mm for the heading. Evaluate portrait `(198 x 267 mm)` and landscape `(285 x 180 mm)` grid boxes. Search column counts `ceil(sqrt(count))` through `count`, score the largest minimum cell dimension, and cap font size between 7 and 18 pt.

- [ ] **Step 4: Verify the four acceptance sizes**

Run: `npm run test:unit -- tests/number-print-layout.test.ts`

Expected: all four layouts fit and value integrity cases pass.

- [ ] **Step 5: Commit**

```bash
git add app/tim-so/print-layout.ts tests/number-print-layout.test.ts
git commit -m "feat: calculate single-sheet number print layouts"
```

### Task 3: Implement the accessible play flow

**Files:**
- Create: `app/tim-so/NumberGrid.tsx`
- Create: `app/tim-so/NumberHuntGame.tsx`
- Modify: `app/tim-so/page.tsx`
- Create: `app/tim-so/number-hunt.css`
- Test: `tests/number-hunt-flow.test.tsx`

**Interfaces:**
- Consumes: Number Hunt engine and `GameShell`.
- Produces: setup, active, and completed screen states.

- [ ] **Step 1: Write failing interaction tests**

```tsx
it("circles only the next number", async () => {
  render(<NumberHuntGame initialNumbers={[3, 1, 2, 10, 4, 5, 6, 7, 8, 9]} initialMax={10} />);
  fireEvent.click(screen.getByRole("button", { name: "Số 2" }));
  expect(screen.getByRole("status")).toHaveTextContent("Hãy tìm số 1 trước nhé");
  fireEvent.click(screen.getByRole("button", { name: "Số 1" }));
  expect(screen.getByRole("button", { name: "Số 1, đã tìm thấy" })).toBeDisabled();
});
```

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/number-hunt-flow.test.tsx`

Expected: FAIL on missing component.

- [ ] **Step 3: Build setup and active game UI**

Use a controlled numeric input with `min=10`, `max=500`, and `step=1`. Start elapsed time on the first correct or incorrect board selection. Render progress as text and `<progress value={next - 1} max={max}>`. Give found cells the label `Số X, đã tìm thấy` and `disabled`.

- [ ] **Step 4: Add completion, sound toggle, and reduced motion**

Render elapsed time and mistake count at completion. Add replay-same-order and reshuffle buttons. Keep audio optional and never autoplay before user interaction.

- [ ] **Step 5: Verify flow, lint, and build**

Run: `npm run test:unit -- tests/number-hunt-flow.test.tsx && npm run lint && npm run build:pages`

Expected: wrong/right/completion flows pass and route exports.

- [ ] **Step 6: Commit**

```bash
git add app/tim-so tests/number-hunt-flow.test.tsx
git commit -m "feat: add playable Number Hunt"
```

### Task 4: Add print preflight and print-only rendering

**Files:**
- Create: `app/tim-so/PrintSheet.tsx`
- Modify: `app/tim-so/NumberHuntGame.tsx`
- Modify: `app/tim-so/number-hunt.css`
- Test: `tests/number-print-flow.test.tsx`

**Interfaces:**
- Produces: `preflightPrint(sheet: HTMLElement, expectedCount: number): PrintPreflightResult`.
- Consumes: immutable fresh shuffle and `PrintLayout`.

- [ ] **Step 1: Write failing preflight tests**

```ts
expect(preflightPrint(makeSheet({ cells: 200, overflowX: 0, overflowY: 0 }), 200)).toEqual({ ok: true });
expect(preflightPrint(makeSheet({ cells: 199, overflowX: 0, overflowY: 0 }), 200)).toEqual({ ok: false, reason: "missing-cells" });
expect(preflightPrint(makeSheet({ cells: 200, overflowX: 1, overflowY: 0 }), 200)).toEqual({ ok: false, reason: "overflow" });
```

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/number-print-flow.test.tsx`

Expected: FAIL on missing preflight.

- [ ] **Step 3: Implement immutable print creation and measurement**

The print button creates `shuffleNumbers(createSequence(max))`, calculates layout, renders cells with `data-print-cell`, waits two animation frames and `document.fonts.ready`, then verifies cell count, `scrollWidth <= clientWidth`, `scrollHeight <= clientHeight`, and each cell rectangle inside the sheet rectangle. Call `window.print()` only after success.

- [ ] **Step 4: Add exact print CSS**

```css
@page { size: A4 landscape; margin: 6mm; }
@media print {
  body * { visibility: hidden; }
  .number-print-sheet, .number-print-sheet * { visibility: visible; }
  .number-print-sheet { position: fixed; inset: 0; width: 285mm; height: 198mm; overflow: visible; }
  .number-print-cell { break-inside: avoid; page-break-inside: avoid; min-width: 0; min-height: 0; }
}
```

Set the actual `@page` orientation through a print class/style matching the calculated layout. Never rely on browser shrink-to-fit for correctness.

- [ ] **Step 5: Verify and commit**

Run: `npm run test:unit -- tests/number-print-layout.test.ts tests/number-print-flow.test.tsx && npm run build:pages`

Expected: print is blocked on missing cells/overflow and allowed only on a valid sheet.

```bash
git add app/tim-so tests/number-print-flow.test.tsx
git commit -m "feat: add verified A4 Number Hunt printing"
```

### Task 5: Number Hunt acceptance gate

**Files:**
- Modify only for defects found by acceptance checks.

- [ ] **Step 1: Run automated gates**

Run: `npm run test:unit && npm run lint && npm run build && npm run build:pages`

Expected: all commands exit 0.

- [ ] **Step 2: Inspect the four print sizes in browser print preview**

For 10, 100, 200, and 500, confirm one A4 page, every number exactly once, no clipped border/text, and unchanged live game after closing preview.

- [ ] **Step 3: Inspect desktop and mobile play**

Confirm keyboard selection, touch targets, wrong-choice live message, circle state, timer, completion, replay, and reduced-motion behavior.

- [ ] **Step 4: Commit acceptance fixes if needed**

```bash
git add app/tim-so tests
git commit -m "fix: complete Number Hunt acceptance"
```
