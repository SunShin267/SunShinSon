# SunShinSon Home Games Design

**Date:** 2026-08-16  
**Status:** Approved  
**Scope:** Number Hunt, Gomoku, and Chess activities linked from Home

## 1. Objective

Replace the current coming-soon screens for `tim-so`, `co-caro`, and `co-vua` with three complete, child-friendly activities. The games must work in the browser without a server, remain compatible with the project's GitHub Pages static export, and preserve the existing SunShinSon visual language.

The delivery order is:

1. Number Hunt
2. Gomoku
3. Chess

Each activity is independently releasable. Chess is the largest phase because it includes instruction, complete legal play, and a computer opponent.

## 2. Architecture

### 2.1 Routes

Home links to three dedicated Next.js routes:

- `/tim-so`
- `/co-caro`
- `/co-vua`

Navigation must respect the configured `basePath` so the same build works locally and on GitHub Pages.

### 2.2 Shared boundaries

Each game is divided into small units with explicit responsibilities:

- **Game shell:** shared header, child name, Home navigation, help access, responsive content region, and leave-game confirmation.
- **Game engine:** pure state transitions and rules with no rendering dependency.
- **Game UI:** board/grid rendering and player interaction.
- **Settings:** names, colors, piece theme, difficulty, sound, and game-specific options.
- **Help:** concise rules and contextual instructions.
- **History:** local persistence, statistics, snapshots, and replay data.
- **Print view:** Number Hunt only; isolated from the interactive screen layout.

The existing child name remains in `localStorage`. Active matches are client-side state. No account, database, or network API is required.

### 2.3 Home integration

The three Home cards navigate directly to their routes instead of opening the generic `TopicScreen`. Other existing activities keep their current behavior. Each game route validates that the child name is available and otherwise returns the visitor to the existing login flow.

## 3. Number Hunt (`/tim-so`)

### 3.1 Setup and generation

The child enters a maximum number `N` from 10 through 500; the default is 100. On **Create board**, the engine creates every integer in `[1, N]` exactly once and shuffles the array with Fisher-Yates.

Invalid, missing, fractional, or out-of-range input does not create a board. The UI shows a short Vietnamese validation message and preserves the previous valid game.

### 3.2 Play loop

- The required sequence is strictly `1, 2, ... N`.
- The screen shows the next required number, elapsed time, progress, and mistake count.
- Selecting the correct value circles and recolors that cell, disables repeat selection, advances the target, and optionally plays positive feedback.
- Selecting any other value briefly marks the cell as incorrect and says which value must be found first. Progress does not decrease.
- At `N`, the game stops the timer and shows completion time, mistakes, replay with the same arrangement, and reshuffle actions.
- Sound can be disabled. Motion and feedback obey `prefers-reduced-motion`.

### 3.3 Single-sheet A4 printing

Printing produces a fresh, unmarked Number Hunt sheet with the child name, date, and a blank completion-time field. It never mutates the active on-screen arrangement.

All numbers must fit on exactly one A4 sheet without missing, clipped, duplicated, or partially rendered cells, including at `N = 500`.

The print pipeline must:

1. Verify that the generated set contains exactly `N` unique values covering `[1, N]`.
2. Select portrait or landscape based on the calculated cell dimensions; large boards prefer landscape.
3. Calculate rows, columns, cell size, and font size against a fixed printable A4 box and print margins.
4. Use print-only CSS with a single-page grid, hidden application controls, fixed dimensions, and no element splitting.
5. Measure the rendered print sheet before calling `window.print()` and block printing with a clear message if the grid exceeds either axis or any expected cell is absent.

Acceptance checks cover at least `N = 10, 100, 200, 500`.

## 4. Gomoku (`/co-caro`)

### 4.1 Setup

Players select either local two-player mode or play against the computer.

Setup includes:

- Player names
- Player colors
- A piece set such as `X/O`, `Sun/Moon`, or `Flower/Leaf`
- Starting player
- Computer difficulty: Easy, Medium, or Hard

Names are required and normalized for statistics. Players cannot select indistinguishable color/piece combinations.

### 4.2 Board growth and navigation

The logical board begins at `20 x 20`, centered in the viewport. Zoom ranges from 50% through 200%. The user can use controls, a mouse wheel, or a pinch gesture, and can pan the board by mouse or touch.

Zooming out expands the logical board around the existing center:

- Above 80%: `20 x 20`
- 66% through 80%: `30 x 30`
- 51% through 65%: `40 x 40`
- 50%: `50 x 50`

Once expanded in a match, the logical board does not contract, so played coordinates never disappear when the user zooms back in. No dimension may exceed `50 x 50`.

### 4.3 Rules and feedback

The rules use the approved Vietnamese Gomoku variant: a win requires exactly five consecutive pieces and the winning line must not be blocked at both ends.

- The latest move is highlighted.
- Illegal or occupied cells cannot be selected.
- When a player wins, the exact five winning pieces blink and a colored line connects them. The blink stops after a few seconds and is replaced by a persistent highlight.
- Reduced-motion users receive the persistent highlight without blinking.
- Undo removes one move in two-player mode or the child's move plus the computer reply in computer mode.
- Restart, change starting player, and leave-match actions require confirmation when appropriate.

### 4.4 Computer levels

- **Easy:** chooses legal nearby moves, understands immediate wins/blocks inconsistently, and intentionally makes suboptimal choices.
- **Medium:** reliably blocks immediate threats, builds useful chains, and searches a limited number of candidate replies.
- **Hard:** uses candidate pruning, deeper adversarial search, and a strict time budget.

All computer search runs off the main UI path and must be cancellable. The computer never selects an occupied or out-of-bounds coordinate.

### 4.5 Scores, snapshots, and replay

Local two-player results are grouped by normalized player pair and record games, wins, losses, draws, and current/best win streaks.

At the end of a match, history stores:

- Player names, colors, and pieces
- Mode and difficulty
- Result and timestamp
- Final board dimensions
- Ordered move list
- Winning coordinates when present

The history screen renders the final board as a viewable snapshot and can replay moves one at a time or automatically. The app keeps the 50 most recent completed matches and provides delete-one and clear-all actions.

## 5. Chess (`/co-vua`)

### 5.1 Main areas

The Chess page has three top-level areas.

#### Learn the pieces

Selecting a piece shows its Vietnamese and English name, relative value, movement, capture behavior, and a board illustration of legal target squares. Short exercises ask the child to move a highlighted piece to a valid destination and give immediate feedback.

#### Learn the rules

Short illustrated lessons cover the objective, turns, capture, check, checkmate, castling, promotion, en passant, stalemate, other draws, touch-move etiquette, and use of a chess clock.

#### Play

The child selects local two-player or computer mode, player names, side/color, starting orientation, and optional clock duration. Computer mode also selects Easy, Medium, or Hard.

The first release supports local play on one device, not network multiplayer.

### 5.2 Complete rule handling

`chess.js` is the rules authority for legal move generation and validation, check, checkmate, stalemate, repetition/draw state, castling, promotion, and en passant. UI state must not independently invent or bypass legal game state.

The board highlights the selected piece, legal destinations, last move, captures, and a king in check. Promotion requires the player to choose a legal promotion piece. Once the game ends, further moves are disabled.

The match UI supports board flip, move history, replay, restart, resignation, draw state, and an optional chess clock. If time expires, the clock result follows the applicable mating-material rule supplied by the game layer.

### 5.3 Computer opponent

A lightweight single-threaded Stockfish WebAssembly build runs in a Web Worker and communicates through UCI. Difficulty levels use bounded engine parameters rather than random illegal play:

- **Easy:** low skill, shallow/short search
- **Medium:** moderate skill and time budget
- **Hard:** higher skill and longer bounded search

The worker exposes ready, thinking, result, cancellation, timeout, and failure states. The UI shows when the computer is thinking and prevents conflicting moves. If the engine cannot load, learning and local two-player modes continue working and computer mode offers a retry message.

The Worker script and WebAssembly URL must be constructed with the deployed `basePath`, not a root-relative hard-coded path. The distributed build must retain the applicable Stockfish GPL license and source/attribution obligations. Dependency versions are pinned and their license notices ship with the static assets.

### 5.4 Chess records

Completed games store player names, mode, difficulty, result, timestamps, clock settings, PGN/move history, and final position. Users can review the final position and replay the game. Chess history also retains the 50 most recent completed matches.

## 6. Persistence

All persistence uses versioned `localStorage` records. Separate keys isolate user preferences, Gomoku statistics/history, and Chess statistics/history.

Reads must validate type, version, required fields, and bounded collection sizes. Invalid or future-version data is ignored safely and never prevents a game page from rendering. Storage quota errors leave the completed game playable and show a non-blocking message that history could not be saved.

Users can delete individual records or clear a game's full history. Clearing history does not remove the child's login name or unrelated game settings.

## 7. Accessibility and Responsive Behavior

- All controls work with keyboard, mouse, and touch where applicable.
- Every board cell or square has an accessible label that includes its coordinate/value and state.
- Color is never the only status signal; symbols, outlines, text, or patterns accompany it.
- Focus remains visible and moves predictably through dialogs and game controls.
- Motion, blinking, shaking, and sound can be reduced or disabled.
- Mobile layouts prioritize the board, collapse secondary panels, and keep critical controls reachable.
- Computer thinking, invalid moves, checks, wins, and completion messages use appropriate live-region announcements without excessive repetition.

## 8. Error Handling

- Invalid setup fields remain editable and receive actionable Vietnamese messages.
- A game cannot accept input while its engine transition is unresolved.
- Leaving or restarting an unfinished game requires confirmation.
- Worker timeouts terminate the pending search and let the player retry or switch modes.
- Corrupt history records are skipped individually where possible.
- The Number Hunt print dialog is never opened after a failed integrity or layout check.

## 9. Verification Strategy

### 9.1 Unit tests

- Number sequence construction, Fisher-Yates invariants, ordered selection, mistakes, completion, and print grid calculations
- Gomoku wins at edges and corners, overlines, both-end blocking, board expansion, coordinate stability, undo, scoring, and AI move legality
- Chess integration fixtures for ordinary movement, check/checkmate, stalemate, castling, en passant, promotion, repetition/draw handling, clocks, and worker protocol
- Versioned storage reads/writes, quota errors, corrupt records, retention limits, and replay reconstruction

### 9.2 Component and flow tests

- Home-to-game navigation under local and configured base paths
- Setup, play, completion, restart, leave confirmation, and replay for each game
- Computer ready/thinking/cancel/failure states
- Keyboard and touch-equivalent interactions
- Reduced-motion variants of win and error feedback

### 9.3 Visual and build verification

- Desktop and mobile layouts for all setup, play, help, history, and replay screens
- Gomoku zoom/pan and board expansion through `50 x 50`
- A4 print preview for `10`, `100`, `200`, and `500`, verifying one page and all numbers exactly once
- Production static export, application build, lint, and the repository test suite

## 10. Out of Scope

- Online/network multiplayer
- Cloud-synced accounts, statistics, or history
- Public leaderboards
- Chess tournaments involving multiple remote participants
- Server-side AI
- Printing Gomoku or Chess boards

These can be considered later without changing the game-engine boundaries defined here.

## 11. Approved Implementation Sequence

1. Extract the shared shell and route-safe navigation.
2. Deliver Number Hunt, including single-sheet A4 verification.
3. Deliver Gomoku, computer levels, score history, snapshots, and replay.
4. Deliver Chess learning content and legal local play.
5. Add the Stockfish worker and three computer levels.
6. Complete cross-game accessibility, responsive, persistence, and regression verification.
