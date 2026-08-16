# Task 5 Report — Whole-site integration and production readiness

## Status

Completed the integration pass in the assigned `feature/home-games-fast` worktree. No automated tests were created or run, per the user override.

## Integration fixes

- Added site-specific title/description plus Open Graph and X summary-card metadata for the finished learning site.
- Copied the one parent-provided Sites social card byte-for-byte to `public/og.png`; no second image was generated and no existing user asset was overwritten.
- Made social metadata host-safe for the GitHub Pages deployment: `SITE_URL` comes from `actions/configure-pages`, with a repository/basePath-aware GitHub Pages fallback for local production builds. The exported metadata contains absolute HTTPS image URLs and no localhost fallback.
- Added focus entry, Escape dismissal, focus trapping, and focus restoration to shared help/leave dialogs and Gomoku restart/setup confirmations. Added a visible focus ring to Gomoku's visually hidden mode radios.
- Hardened Gomoku history loading with bounded collection/record validation, per-record corrupt-data filtering, coordinate bounds, and semantic move replay before records reach the UI.
- Propagated Gomoku history write/delete/clear failures to the UI. Failed mutations now preserve visible records and show a non-blocking Vietnamese status message instead of pretending persistence succeeded.
- Added a horizontally scrollable, minimum-cell-width viewport for large Number Hunt boards on narrow screens so values do not collapse into unusable touch targets.

## Verification

Fresh final-tree verification:

- `npm run lint` — exit 0; no diagnostics.
- `npm run build` — exit 0; vinext completed all five build stages and included `/`, `/tim-so`, `/co-caro`, and `/co-vua`.
- `npm run build:pages` — exit 0; Next.js compiled, completed TypeScript, and statically generated all six pages, including the three game routes.
- Confirmed non-empty `out/tim-so/index.html`, `out/co-caro/index.html`, and `out/co-vua/index.html`.
- Confirmed non-empty exported Stockfish JS, WASM, `COPYING.txt`, and `SOURCE.md`; byte comparisons matched the pinned `stockfish@18.0.8` package JS/WASM/license.
- Confirmed `out/og.png` is byte-identical to `public/og.png` and the supplied generated source.
- Inspected exported Open Graph/X tags: title, description, dimensions, alt text, `summary_large_image`, and `https://sunshin267.github.io/SunShinSon/og.png` are present; no `localhost:3000` URL remains.
- `npm ls chess.js stockfish --depth=0` confirmed `chess.js@1.4.0` and `stockfish@18.0.8`.
- `git diff --check` — clean.

## Environment notes

- The first sandboxed Pages build was denied when Turbopack tried to bind a local worker port. The exact command was rerun with the required sandbox exception and passed; this was an environment restriction, not a source/build failure.
- The successful builds retain the existing non-fatal linked-worktree/multiple-lockfile warning and Node `module.register()` deprecation warning.
- Codebase Memory Tier 2 verification used generation `2026-08-16T17:32:57Z`. Operated source paths had no recorded coverage gaps and matching metadata at inspection time. `public/**` is intentionally excluded from the graph, so social/Stockfish assets were inspected directly and verified by size/byte comparison.
- The pre-existing untracked execution plan at `docs/superpowers/plans/2026-08-16-home-games-fast-execution.md` was preserved and excluded from this task's commit.

## Review fix — persisted Gomoku player tuples

- Tightened persisted-player validation so each two-player tuple must contain exactly one `p1` and one `p2`; duplicate identities are now rejected before replay or rendering.
- Player name, color, and piece fields must contain at least one non-whitespace character while retaining their existing length bounds. Corrupt records with blank display fields are skipped individually by `loadGomokuHistory()`.
- No automated tests were created or run, per the user override.
- Fresh review-fix verification: `npm run lint` exit 0, `npm run build` exit 0, and `npm run build:pages` exit 0 with all six static pages generated.
