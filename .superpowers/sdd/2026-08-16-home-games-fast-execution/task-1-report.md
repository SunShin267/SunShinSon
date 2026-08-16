# Task 1 Report: Shared game foundation and Home routes

## Implementation

- Extracted the reusable `SunLogo` and authenticated `AppHeader` components while preserving their existing class names and visual styling.
- Added `GameShell` to load the existing child session, redirect unauthenticated visitors to the Home login flow, and provide Home/logout actions.
- Added base-path-safe internal navigation plus guarded child-session and versioned `localStorage` helpers.
- Linked Home's Tìm số, Cờ caro, and Cờ vua cards to `/tim-so`, `/co-caro`, and `/co-vua`; the existing Quiz redirect remains unchanged.
- Added static placeholder route pages for each game, ready for the subsequent game-specific tasks.
- Made `build:pages` explicitly select the existing GitHub Pages export configuration so its configured Pages TypeScript project is used.

## Verification

- `npm run lint` — passed (exit 0).
- `npm run build:pages` — passed (exit 0); static output listed `/`, `/tim-so`, `/co-caro`, and `/co-vua`.
- No automated tests were created or run, per the user override.

## Files

- Modified: `app/page.tsx`, `next.config.ts`, `package.json`.
- Added: `app/components/AppHeader.tsx`, `app/components/GamePlaceholder.tsx`, `app/components/GameShell.tsx`, `app/components/SunLogo.tsx`.
- Added: `app/lib/child-session.ts`, `app/lib/navigation.ts`, `app/lib/versioned-storage.ts`.
- Added: `app/tim-so/page.tsx`, `app/co-caro/page.tsx`, `app/co-vua/page.tsx`.

## Self-review

- Confirmed all navigation to the three new game pages uses the shared base-path helper.
- Confirmed the existing session key remains exactly `sunshinson-name` and all storage access handles unavailable/corrupt storage safely.
- Confirmed the three route pages can be statically generated and use the shared authenticated shell.
- Ran `git diff --check`; no whitespace errors were reported.

## Concerns

- The build prints the repository's existing multiple-lockfile warning and a Node deprecation warning, but completes successfully.
- `docs/superpowers/plans/2026-08-16-home-games-fast-execution.md` was already untracked in the worktree and is intentionally excluded from this task's commit.

## Review fixes

- Added the generic `GameShell` API `isGameInProgress` and `onLeaveGame`. Home and logout actions now open a shared Vietnamese confirmation dialog whenever a caller marks the current game unfinished; confirmation invokes `onLeaveGame` before navigation.
- Added the generic `helpContent` slot. When supplied, `GameShell` renders a shared header help trigger and accessible help dialog. The three initial route shells supply concise placeholder guidance.
- Added matching shared dialog and help-button styling without changing the existing Home design.

### Fix verification

- `npm run lint` — exit 0. Output: `eslint . --ignore-pattern dist --ignore-pattern .next` completed with no diagnostics.
- `npm run build:pages` — exit 0. Output: Pages static build compiled, type-checked, and generated `/`, `/_not-found`, `/co-caro`, `/co-vua`, and `/tim-so` as static content.
- No automated tests were created or run, per the user override.
