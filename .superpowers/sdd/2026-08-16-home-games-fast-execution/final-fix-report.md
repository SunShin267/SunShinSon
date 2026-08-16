# Home games final fix report

Date: 2026-08-17

Worktree: `/Users/Bu/Git/SunShinSon/.worktrees/home-games-fast`

Graph evidence: Tier 2 Verify, project `sunshinson-home-games-fast`, generation `2026-08-16T17:58:52Z`; all affected source paths returned `no_recorded_issue` with `metadata_match`.

## Files changed

- `app/co-vua/ChessGame.tsx`
- `app/co-vua/ChessHistory.tsx`
- `app/co-vua/chess-history.ts`
- `app/co-caro/gomoku-types.ts`
- `app/co-caro/gomoku-engine.ts`
- `app/co-caro/board-viewport.ts`
- `app/co-caro/GomokuBoard.tsx`
- `app/co-caro/GomokuGame.tsx`
- `app/co-caro/gomoku-ai.ts`
- `app/co-caro/gomoku-ai-client.ts`
- `app/co-caro/gomoku-history.ts`
- `app/co-caro/GomokuHistory.tsx`
- `app/co-caro/gomoku.css`
- `app/tim-so/page.tsx`
- `app/tim-so/PrintSheet.tsx`
- `app/globals.css`

## Exact fixes

### Chess

- Unfinished state is now derived from `game && !finalState`, independent of the visible Chess tab/screen. Home/logout therefore continues to open `GameShell`'s leave confirmation while lessons or history are visible, including before the first move.
- The Stockfish request is cancelled and the active clock is paused when the live board becomes hidden. Returning to the board resumes the correct side with a fresh monotonic `lastTick`, so hidden time is not charged and stale engine work cannot move.
- `finishGame` now clears a pending promotion and synchronously marks the game terminal. `commitMove` rejects stale, saved, final, chess-terminal, and clock-expired sources. It advances the clock to the exact event timestamp before applying any move; an expiry is adjudicated before mutation. `promote` also rejects final/terminal sources and delegates the precise clock-expiry gate to `commitMove`.
- A dedicated atomic polite live region now emits event-driven thinking, turn, check, checkmate, draw, resignation, and timeout messages.
- Chess replay's first/previous/next/last glyph buttons now have Vietnamese accessible labels.
- Stored Chess history now bounds identifiers, timestamps, player/reason/SAN/FEN strings, clock values, and difficulty values before reconstructing a record.
- Chess help now identifies Stockfish 18 and links through `internalPath` to the deployed source notice and GPL license.

### Gomoku

- `GomokuState` now carries a logical world-coordinate `origin`. Expansion subtracts half of each size increase from both origin axes, so 20→30→40→50 adds equal rows/columns on every side and never contracts.
- Board rendering, keyboard bounds, labels, winning-line geometry, fallback AI centering, heuristic centering, legal bounds, replay, stored history, and history snapshots all translate through the origin. Existing history without an origin remains compatible by using `[0, 0]`.
- Because the board element remains centered with a centered transform origin, stable world stones retain their visual position as symmetric cells are added around them.
- Medium AI now searches at most eight candidate moves and, for every evaluated non-terminal candidate, evaluates up to six opponent replies. It always inspects one reply before honoring its 120–450 ms deadline and checks cancellation before candidates/replies. Immediate wins and blocks remain fast tactical paths.
- An atomic polite live region now emits concise invalid/out-of-bounds, occupied, thinking, next-turn, undo, win, and draw announcements. Hidden history also cancels current AI work and resumes it only after returning to the live board.

### Number Hunt

- The unfinished `Xáo lại bảng` action now requires explicit confirmation before destroying progress.
- Elapsed time is derived from `performance.now() - startedAt` on refresh, rather than counting interval callbacks. It therefore catches up after background throttling and a blocking print dialog; completion takes a final monotonic reading.
- The empty WAV data URI was replaced by a short user-gesture-initiated Web Audio oscillator/gain tone, with graceful no-audio fallback and context cleanup.
- The print header uses a four-column bounded grid. Child names are whitespace-normalized and truncated to 24 Unicode code points with an ellipsis; the full value remains in `title`.
- Before `window.print`, preflight now validates all title/name/date/time fields, nonblank content, field-within-header bounds, header/grid-within-sheet bounds, cell bounds, scroll overflow at field/header/grid/sheet levels, page dimensions, cell count, uniqueness, and complete `1..N` membership. Screen-time header typography matches print typography so the measurement is representative.

## Verification output

The user explicitly waived automated tests. None were added or run.

### `npm run lint`

Final exit: `0`

```text
> site-creator-vinext-starter@0.1.0 lint
> eslint . --ignore-pattern dist --ignore-pattern .next --ignore-pattern public/engines/stockfish
```

### `npm run build`

Final exit: `0`

```text
vinext build (Vite 8.0.13)
client references: 140 modules transformed
server references: 80 modules transformed
rsc environment: 146 modules transformed
client environment: 88 modules transformed
ssr environment: 86 modules transformed
Routes: /, /co-caro, /co-vua, /tim-so
Build complete.
```

### `npm run build:pages`

Final exit: `0` (rerun outside the sandbox after the sandbox denied Turbopack's local helper-port bind)

```text
Copied Stockfish 18.0.8 lite single-threaded assets
Compiled successfully
TypeScript finished
Generated static pages (6/6)
Static routes: /, /_not-found, /co-caro, /co-vua, /tim-so
```

### Direct artifact checks

Final exit: `0`. All files were nonempty; route markers, compiled fix strings, GPL text, and the pinned Stockfish source notice were present.

```text
out/index.html 8906 bytes
out/co-caro/index.html 9446 bytes
out/co-vua/index.html 9679 bytes
out/tim-so/index.html 9397 bytes
out/engines/stockfish/stockfish-18-lite-single.js 21429 bytes
out/engines/stockfish/stockfish-18-lite-single.wasm 7295411 bytes
out/engines/stockfish/COPYING.txt 35821 bytes
out/engines/stockfish/SOURCE.md 1382 bytes
```

`git diff --check` also exited `0`.

## Self-review

- Re-read every final-review finding against the final source and traced each state transition through the affected callbacks/effects.
- Verified Chess hiding, resuming, timeout, promotion, final-save, and leave-confirm paths do not depend on the rendered screen.
- Verified Gomoku coordinates remain world-stable, origin bounds cover every UI/AI/history path, every expansion is symmetric, and the maximum remains 50 through the `BoardSize`/zoom mapping.
- Verified Medium AI's non-tactical branch cannot select a candidate before performing its bounded opponent-reply evaluation.
- Verified Number Hunt's unfinished reset has a single confirmation path, the timer is delta-based, audio contains an audible envelope, and print preflight includes the complete header as well as the grid.
- Checked the final diff for whitespace errors and unrelated changes. The pre-existing untracked `docs/superpowers/plans/2026-08-16-home-games-fast-execution.md` was not modified or staged.

## Concerns and limitations

- `npm run build` and `npm run build:pages` still print Node's existing `DEP0205 module.register()` deprecation warning. The Pages build also reports the existing multiple-lockfile/workspace-root inference warning. Neither command reports a compile, type, or export failure.
- The first sandboxed Pages build failed only because Turbopack was prohibited from binding a local helper port (`Operation not permitted`). The required final rerun outside the sandbox completed with exit `0`.
- Per the explicit test waiver, behavior was verified by source/state-flow review, lint, both production builds, and exported-artifact inspection; no automated or interactive browser test was run.
