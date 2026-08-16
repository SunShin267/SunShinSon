# Home Games Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the shared routing, child-session, storage, layout, and test foundations required by all three Home games.

**Architecture:** Extract reusable client components from the current single Home page without changing login behavior. Route all internal links through one base-path helper, and keep persistence behind typed versioned adapters.

**Tech Stack:** Next.js 16.2.6, React 19.2.6, TypeScript 5.9.3, Vitest 4.1.10, jsdom 30.0.1, React Testing Library 16.3.2

## Global Constraints

- Preserve the existing Home and login appearance and `sunshinson-name` localStorage key.
- The production build must remain compatible with `output: "export"`, `basePath`, and `trailingSlash: true`.
- Internal navigation must never hard-code a deployment root.
- Every storage record is versioned and invalid data must not prevent rendering.
- Do not add a database, account system, or network API.
- All new interactive controls must support keyboard focus and accessible names.

---

## File Structure

- `app/page.tsx`: Home/login orchestration only.
- `app/components/SunLogo.tsx`: reusable brand mark.
- `app/components/AppHeader.tsx`: shared authenticated header.
- `app/components/GameShell.tsx`: shared game page wrapper and navigation.
- `app/lib/paths.ts`: base-path-safe internal URL construction.
- `app/lib/child-session.ts`: child name read/write/clear helpers.
- `app/lib/versioned-storage.ts`: guarded versioned localStorage adapter.
- `tests/setup.ts`: DOM matcher setup.
- `tests/paths.test.ts`, `tests/child-session.test.ts`, `tests/versioned-storage.test.tsx`: foundation tests.
- `vitest.config.ts`: test environment and aliases.

### Task 1: Add the focused unit/component test harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: `npm run test:unit`, jsdom environment, `@/*` alias, and jest-dom matchers.

- [ ] **Step 1: Install exact test dependencies**

Run:

```bash
npm install --save-dev --save-exact vitest@4.1.10 jsdom@30.0.1 @testing-library/react@16.3.2 @testing-library/dom@10.4.1 @testing-library/jest-dom@7.0.0
```

Expected: `package.json` and `package-lock.json` contain exact versions.

- [ ] **Step 2: Write the failing smoke test**

```ts
// tests/smoke.test.ts
import { describe, expect, it } from "vitest";

describe("unit test harness", () => {
  it("provides a DOM", () => expect(document.createElement("main")).toBeInstanceOf(HTMLElement));
});
```

- [ ] **Step 3: Add configuration and setup**

```ts
// vitest.config.ts
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: { environment: "jsdom", setupFiles: ["./tests/setup.ts"] },
});
```

```ts
// tests/setup.ts
import "@testing-library/jest-dom/vitest";
```

Add `"test:unit": "vitest run"` to `scripts` without replacing the existing `test` command.

- [ ] **Step 4: Run the harness and lint**

Run: `npm run test:unit && npm run lint`

Expected: smoke test passes; lint has no new errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/setup.ts tests/smoke.test.ts
git commit -m "test: add game unit test harness"
```

### Task 2: Add base-path-safe navigation

**Files:**
- Create: `app/lib/paths.ts`
- Test: `tests/paths.test.ts`

**Interfaces:**
- Produces: `appPath(path: `/${string}`, basePath?: string): string`.

- [ ] **Step 1: Write failing path tests**

```ts
import { describe, expect, it } from "vitest";
import { appPath } from "@/app/lib/paths";

describe("appPath", () => {
  it.each([
    ["/tim-so", "", "/tim-so"],
    ["/co-caro", "/SunShinSon", "/SunShinSon/co-caro"],
    ["/", "/SunShinSon/", "/SunShinSon/"],
  ])("joins %s under %s", (path, base, expected) => expect(appPath(path as `/${string}`, base)).toBe(expected));
});
```

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/paths.test.ts`

Expected: FAIL because `appPath` does not exist.

- [ ] **Step 3: Implement the helper**

```ts
export function appPath(path: `/${string}`, basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "") {
  const base = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  return path === "/" ? `${base}/` : `${base}${path}`;
}
```

- [ ] **Step 4: Verify green**

Run: `npm run test:unit -- tests/paths.test.ts`

Expected: 3 cases pass.

- [ ] **Step 5: Commit**

```bash
git add app/lib/paths.ts tests/paths.test.ts
git commit -m "feat: add base path navigation helper"
```

### Task 3: Extract child session and shared shell components

**Files:**
- Create: `app/lib/child-session.ts`
- Create: `app/components/SunLogo.tsx`
- Create: `app/components/AppHeader.tsx`
- Create: `app/components/GameShell.tsx`
- Modify: `app/page.tsx`
- Test: `tests/child-session.test.ts`
- Test: `tests/game-shell.test.tsx`

**Interfaces:**
- Produces: `readChildName(storage)`, `writeChildName(storage, name)`, `clearChildName(storage)`.
- Produces: `GameShell({ name, title, children })`.
- Consumes: `appPath()` from Task 2.

- [ ] **Step 1: Write failing session and shell tests**

```ts
// tests/child-session.test.ts
import { expect, it } from "vitest";
import { readChildName, writeChildName } from "@/app/lib/child-session";

it("trims and persists the child name", () => {
  writeChildName(localStorage, "  Minh  ");
  expect(readChildName(localStorage)).toBe("Minh");
});
```

```tsx
// tests/game-shell.test.tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { GameShell } from "@/app/components/GameShell";

it("renders an accessible Home link", () => {
  render(<GameShell name="Minh" title="Tìm số"><p>Board</p></GameShell>);
  expect(screen.getByRole("link", { name: /về trang chủ/i })).toHaveAttribute("href", "/");
});
```

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/child-session.test.ts tests/game-shell.test.tsx`

Expected: FAIL on missing modules.

- [ ] **Step 3: Extract shared components and session helpers**

Use this session contract:

```ts
export const CHILD_NAME_KEY = "sunshinson-name";
export const readChildName = (storage: Pick<Storage, "getItem">) => (storage.getItem(CHILD_NAME_KEY) ?? "").trim();
export const writeChildName = (storage: Pick<Storage, "setItem">, name: string) => storage.setItem(CHILD_NAME_KEY, name.trim());
export const clearChildName = (storage: Pick<Storage, "removeItem">) => storage.removeItem(CHILD_NAME_KEY);
```

Move the existing `SunLogo` and `AppHeader` markup without visual changes. Implement `GameShell` with a Home `<Link href={appPath("/")}>`, title, child name, main landmark, and children.

- [ ] **Step 4: Replace inline Home helpers and verify**

Run: `npm run test:unit -- tests/child-session.test.ts tests/game-shell.test.tsx && npm run lint && npm run build:pages`

Expected: tests pass; Home still builds for static export.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/components app/lib/child-session.ts tests/child-session.test.ts tests/game-shell.test.tsx
git commit -m "refactor: extract shared game shell"
```

### Task 4: Add guarded versioned storage

**Files:**
- Create: `app/lib/versioned-storage.ts`
- Test: `tests/versioned-storage.test.ts`

**Interfaces:**
- Produces: `createVersionedStore<T>({ key, version, validate, fallback, limit? })` with `read`, `write`, and `clear`.

- [ ] **Step 1: Write failing corruption tests**

```ts
import { expect, it } from "vitest";
import { createVersionedStore } from "@/app/lib/versioned-storage";

it("falls back when persisted JSON is corrupt", () => {
  localStorage.setItem("sample", "{");
  const store = createVersionedStore({ key: "sample", version: 1, fallback: [] as string[], validate: Array.isArray });
  expect(store.read(localStorage)).toEqual([]);
});
```

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/versioned-storage.test.ts`

Expected: FAIL on missing module.

- [ ] **Step 3: Implement the envelope and quota-safe result**

```ts
export type PersistResult = { ok: true } | { ok: false; reason: "quota" | "unavailable" };
type Envelope<T> = { version: number; data: T };
```

`read` parses inside `try/catch`, accepts only the exact version and validated data, and returns `fallback` otherwise. `write` stores `{ version, data }` and returns `PersistResult`; `clear` removes only its own key.

- [ ] **Step 4: Cover valid, wrong-version, invalid-shape, quota, and clear cases**

Run: `npm run test:unit -- tests/versioned-storage.test.ts`

Expected: all storage cases pass.

- [ ] **Step 5: Commit**

```bash
git add app/lib/versioned-storage.ts tests/versioned-storage.test.ts
git commit -m "feat: add versioned local storage adapter"
```

### Task 5: Route Home cards to game pages

**Files:**
- Modify: `app/page.tsx`
- Create: `app/tim-so/page.tsx`
- Create: `app/co-caro/page.tsx`
- Create: `app/co-vua/page.tsx`
- Test: `tests/home-navigation.test.tsx`

**Interfaces:**
- Consumes: `appPath`, `GameShell`, and child session helpers.
- Produces: static-exportable route entry points for the three following plans.

- [ ] **Step 1: Write a failing Home navigation test**

Assert that the three topic cards are links with `href` values `/tim-so`, `/co-caro`, and `/co-vua`, while Quiz retains its configured behavior.

```tsx
expect(screen.getByRole("link", { name: /chơi tìm số/i })).toHaveAttribute("href", "/tim-so");
```

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/home-navigation.test.tsx`

Expected: FAIL because topic cards are buttons.

- [ ] **Step 3: Add route metadata to topics and initial route shells**

Extend `Topic` with `href?: `/${string}``; give the three game records their routes; render a `<Link>` when `href` exists. Each route initially renders `GameShell` plus an honest “Đang chuẩn bị trò chơi” status, not the old locked preview.

- [ ] **Step 4: Verify navigation and static export**

Run: `npm run test:unit -- tests/home-navigation.test.tsx && npm run build:pages`

Expected: links pass and `out/tim-so/index.html`, `out/co-caro/index.html`, `out/co-vua/index.html` exist.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/tim-so app/co-caro app/co-vua tests/home-navigation.test.tsx
git commit -m "feat: route Home cards to game pages"
```

### Task 6: Foundation verification gate

**Files:**
- Modify only if a verification failure identifies a foundation defect.

- [ ] **Step 1: Run focused tests**

Run: `npm run test:unit`

Expected: all foundation tests pass.

- [ ] **Step 2: Run quality gates**

Run: `npm run lint && npm run build && npm run build:pages`

Expected: all commands exit 0.

- [ ] **Step 3: Inspect the production output**

Run: `test -f out/tim-so/index.html && test -f out/co-caro/index.html && test -f out/co-vua/index.html`

Expected: exit 0.

- [ ] **Step 4: Commit verification-only fixes if needed**

```bash
git add app tests package.json package-lock.json vitest.config.ts
git commit -m "fix: complete game foundation verification"
```
