# Cờ tướng online Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm Cờ sáng và Cờ úp, mỗi loại có thể chơi với máy hoặc chơi online qua link mời/danh sách hiện diện.

**Architecture:** Engine luật thuần TypeScript là nguồn chân lý cho cả UI, AI và API. Ván online được lưu ở D1, xác thực bằng cookie phiên tên ẩn danh và đồng bộ bằng HTTP polling; máy chủ kiểm tra nước đi và đồng hồ trước khi ghi.

**Tech Stack:** Next/Vinext, React 19, TypeScript, Cloudflare Worker, Cloudflare D1, Drizzle schema/migrations, Web Worker.

**Spec:** `docs/superpowers/specs/2026-08-24-xiangqi-online-design.md`

## Global Constraints

- Cờ sáng và Cờ úp đều có chế độ máy và online; không có hai người cùng thiết bị.
- Đồng hồ 5, 10 và 15 phút, mặc định 10 phút; không có increment.
- Online sử dụng D1 + polling: sảnh 3 giây, ván 1 giây.
- Cookie phiên là HttpOnly, Secure, SameSite=Lax; mutation kiểm tra Origin và JSON content type.
- Chỉ dữ liệu công khai của quân úp được gửi về client; danh tính quân chưa lật không được lộ trong snapshot online.
- Theo yêu cầu trực tiếp của người dùng, không thêm hoặc chạy một giai đoạn test riêng; chỉ chạy build tối thiểu sau khi tích hợp.
- Không thay đổi hành vi của các trò chơi hiện có.

---

### Task 1: Tạo engine Cờ tướng dùng chung và AI phía trình duyệt

**Files:**
- Create: `lib/xiangqi/types.ts`
- Create: `lib/xiangqi/rules.ts`
- Create: `lib/xiangqi/ai.ts`
- Create: `app/co-tuong/xiangqi-ai.worker.ts`
- Create: `app/co-tuong/xiangqi-ai-client.ts`

**Interfaces:**
- Produces `createGame(variant, seed)`, `legalMoves(state, from?)`, `applyMove(state, move)`, `getGameStatus(state)`, `toPublicState(state)` and `hydrateState(value)`.
- Produces `chooseComputerMove(publicState, difficulty, options)` which never accepts the concealed layout mapping.
- Produces `requestComputerMove(state, difficulty, options)` for the React game component.

- [ ] **Step 1: Define serializable game types and deterministic setup**

Create `lib/xiangqi/types.ts` with a 9×10 coordinate type, `red | black` side, seven piece identities, `bright | blind` variant, `Piece`, `Move`, `XiangqiState`, `PublicXiangqiState`, and `GameStatus`. Store a `coverRole` for every blind piece and store each unrevealed identity only in the private `concealedPieces` map.

- [ ] **Step 2: Implement standard and blind move rules**

Create `lib/xiangqi/rules.ts`. Generate pseudo-legal destinations for each piece, including horse-leg, elephant-eye, cannon-screen, palace, river, flying-general, check and self-check constraints. `createGame("blind", seed)` must leave both generals visible, shuffle 15 identities per side deterministically, and preserve the original square role as `coverRole`. `applyMove` must reveal a blind piece only after its first legal move and permit revealed advisors outside the palace and revealed elephants across the river.

- [ ] **Step 3: Implement terminal states and public-state masking**

In `rules.ts`, return `checkmate`, `no-legal-move`, `repetition`, `timeout`, `resignation`, `draw-agreed`, or `active`; encode threefold repetition from a stable board-position key. Implement `toPublicState` so every unrevealed blind piece lacks its actual identity, and `hydrateState` validates all serialized fields before game use.

- [ ] **Step 4: Implement a bounded fair AI**

Create `lib/xiangqi/ai.ts` with move ordering, material/position/king-safety evaluation and alpha-beta search. Limit Dễ/Vừa/Khó by fixed search budgets. For blind chess, calculate evaluation from `PublicXiangqiState`, represent concealed identities as remaining-piece probability, and never import or inspect `concealedPieces`.

- [ ] **Step 5: Run AI inside a module worker**

Create `app/co-tuong/xiangqi-ai.worker.ts` that receives `{ state, difficulty }` and replies with `{ move }` or a structured error. Create `xiangqi-ai-client.ts` with `requestComputerMove`, cancellation through `AbortSignal`, worker termination and a legal-move fallback chosen from the public state.

- [ ] **Step 6: Commit the shared gameplay layer**

Run `git add lib/xiangqi app/co-tuong/xiangqi-ai.worker.ts app/co-tuong/xiangqi-ai-client.ts` and commit with `feat: add xiangqi rules and ai`.

### Task 2: Thêm dữ liệu D1 và API online có thẩm quyền máy chủ

**Files:**
- Modify: `db/schema.ts`
- Create: `drizzle/0001_xiangqi_online.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `worker/index.ts`
- Create: `worker/xiangqi-api.ts`
- Modify: `worker/env.ts` only if types require an additional binding (expected: no change)

**Interfaces:**
- Consumes `XiangqiState`, `applyMove`, `getGameStatus`, and `toPublicState` from `lib/xiangqi`.
- Produces `handleXiangqiApiRequest(request, env): Promise<Response | null>`.
- API routes: `/api/xiangqi/session`, `/presence/heartbeat`, `/lobby`, `/invites`, `/invites/:id/accept`, `/invites/:id/decline`, `/invites/:id/cancel`, `/games/:id`, `/games/:id/commands`.

- [ ] **Step 1: Declare persistence model and migration**

Add Drizzle declarations for `xiangqi_sessions`, `xiangqi_presence`, `xiangqi_invites`, `xiangqi_games`, and `xiangqi_moves`, including indexes for session, presence state, invite status/expiry, room code and active games. Add migration `0001_xiangqi_online.sql` with concrete foreign keys, state checks and indexes; update Drizzle journal/snapshot by running the repository generator if it succeeds without downloading packages.

- [ ] **Step 2: Create anonymous session and request helpers**

Implement secure cookie parsing and creation in `worker/xiangqi-api.ts`. `POST /api/xiangqi/session` must accept exactly `{ name: string }`, trim it, enforce 1–30 visible characters, upsert the session record and reply with public player data plus `Set-Cookie`. All state-changing endpoints require same-origin and `application/json`.

- [ ] **Step 3: Implement presence and lobby endpoints**

Implement heartbeat expiration after 15 seconds, status transitions (`available`, `waiting`, `playing`) and `GET /lobby`. Do not return the requester in the online-player collection. Include public invitations addressed to the caller and the caller's currently waiting room or active game.

- [ ] **Step 4: Implement invitations with atomic state transitions**

Create link invitations with a 10-minute expiration and direct invitations with a 2-minute expiration. On accept, atomically ensure both sessions are not in a game, assign red/black randomly, create a game state through `createGame`, set both presence rows to playing, and mark exactly one invite accepted. Implement decline and cancel with owner checks.

- [ ] **Step 5: Implement game snapshots, ready state and authoritative commands**

Store private state JSON, active side, revision, current clock values, active-clock timestamp, player ready flags and pending draw offer in `xiangqi_games`. `GET /games/:id` only admits either participant and returns a participant-safe `toPublicState` snapshot with `ETag` revision. `POST /games/:id/commands` handles `ready`, `move`, `offer_draw`, `accept_draw`, `decline_draw`, `resign`, and `rematch`; each mutation checks revision, participant, turn, clock, game status and applies a conditional update. Update elapsed server clock before each read/write and end a timeout game server-side.

- [ ] **Step 6: Attach API routing and errors**

Call `handleXiangqiApiRequest` from `worker/index.ts` before the existing questions API handler. Return Vietnamese, no-store JSON errors for malformed body, stale revisions, expired rooms, forbidden access and conflicts; do not expose server errors or private blind layout data.

- [ ] **Step 7: Commit the online backend**

Run `git add db worker drizzle` and commit with `feat: add xiangqi online api`.

### Task 3: Xây dựng giao diện lựa chọn chế độ, bàn cờ và chơi với máy

**Files:**
- Create: `app/co-tuong/page.tsx`
- Create: `app/co-tuong/XiangqiGame.tsx`
- Create: `app/co-tuong/XiangqiSetup.tsx`
- Create: `app/co-tuong/XiangqiBoard.tsx`
- Create: `app/co-tuong/XiangqiClock.tsx`
- Create: `app/co-tuong/xiangqi.css`

**Interfaces:**
- Consumes rules and AI client from Task 1.
- `XiangqiGame` receives optional `{ inviteCode?: string }` from a route page.
- `XiangqiBoard` receives a public state, player side, selected square, legal targets and `onSquareClick`.

- [ ] **Step 1: Add route shell and selection screen**

Create `/co-tuong` page importing the game component and CSS. Build `XiangqiSetup` with accessible choices for Cờ sáng/Cờ úp, Máy/Online, player color, Dễ/Vừa/Khó and 5/10/15 minutes. The default choice is Cờ sáng, Chơi với máy, difficulty Vừa, 10 minutes.

- [ ] **Step 2: Render a responsive 9×10 board**

Build `XiangqiBoard` with CSS grid lines, river labels, palaces, semantic square buttons, piece glyphs, visible blind backs, selection, legal target, last-move and checked-general states. Include Vietnamese aria labels that distinguish a hidden piece from a revealed piece. Render side orientation correctly for red and black while preserving keyboard focus order.

- [ ] **Step 3: Implement local game controller and clocks**

In `XiangqiGame`, create private state with `createGame`, select source/destination using `legalMoves`, apply moves, set announcements and start/stop two local clocks with `performance.now()`. Guard inputs during the computer turn, after terminal state, or while a reveal animation is running. Add end-state, resign and restart controls.

- [ ] **Step 4: Wire machine turns**

When the configured human side is not `state.turn`, call `requestComputerMove` through an `AbortController`. Apply only a move still legal against the same state revision; on worker failure, choose a legal public fallback and report a recoverable message. Cancel computation and timers when navigating away or restarting.

- [ ] **Step 5: Add game metadata and cohesive CSS**

Use a wood-toned board and SunShinSon cards. Put player cards, timer, history and actions beside the board on desktop and below it on mobile. Add reduced-motion behavior for blind reveal and alert/progress formatting for clocks. Update `app/layout.tsx` descriptions to include Cờ tướng.

- [ ] **Step 6: Commit the local gameplay UI**

Run `git add app/co-tuong app/layout.tsx` and commit with `feat: add xiangqi local game ui`.

### Task 4: Thêm đăng nhập tên, sảnh online và đồng bộ ván

**Files:**
- Create: `app/co-tuong/xiangqi-online-client.ts`
- Create: `app/co-tuong/XiangqiLobby.tsx`
- Create: `app/co-tuong/XiangqiOnlineGame.tsx`
- Create: `app/co-tuong/phong/[code]/page.tsx`
- Modify: `app/co-tuong/XiangqiGame.tsx`
- Modify: `app/co-tuong/xiangqi.css`

**Interfaces:**
- Consumes Task 2 JSON endpoints.
- `XiangqiOnlineClient` exposes `ensureSession(name)`, `heartbeat()`, `loadLobby()`, `createInvite()`, `acceptInvite()`, `loadGame()` and `command()`.
- `XiangqiOnlineGame` receives a game id or invite code and owns polling/reconnect UI.

- [ ] **Step 1: Implement API client with normalised errors**

Create a thin fetch client that adds JSON headers, maps error JSON to `{ code, message }`, sends `credentials: "same-origin"`, and supports ETag / `If-None-Match` snapshots. Keep all API endpoint strings in this file and require a current revision for every mutation.

- [ ] **Step 2: Add name-only online entry flow**

When the user opens an online flow without a server session, show a compact Cờ tướng login card with one name field. Pre-fill it from `readChildName`, call `saveChildName` on success, then call `ensureSession`. This route must retain invite code so an invitee returns directly to the same room.

- [ ] **Step 3: Build online lobby and direct invite controls**

Render a 3-second polling lobby with the player’s current status, link creation/copy feedback, sent/received invitations and online players grouped by Rảnh, Đang chờ and Đang chơi. Only give a `Mời chơi` action to Rảnh players. Let recipient accept/decline and owner cancel; navigate into a game after a successful accept or when lobby reports an active game.

- [ ] **Step 4: Build online game synchronization**

Render the board using server snapshots, use 1-second polling while the game is active, send `ready` after first snapshot and show a ready room until both players report ready. Use server timestamps to display clocks; replace current snapshot on stale-revision conflict. Support move, draw offer response, resign, rematch and a disconnected/retrying state with 1/2/4/8 second backoff.

- [ ] **Step 5: Add shareable room route**

Create `/co-tuong/phong/[code]` as a route that opens `XiangqiGame` in invitation mode. It calls lobby/invite data to resolve the code, presents the name-only card when needed, and displays a friendly expired/full/unknown-room state when the room cannot be joined.

- [ ] **Step 6: Commit online UI**

Run `git add app/co-tuong` and commit with `feat: add xiangqi online lobby`.

### Task 5: Tích hợp trang chủ và kiểm tra tối thiểu

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css` only if the home card requires an existing shared style adjustment
- Modify: `README.md` only if its games list names individual activities

**Interfaces:**
- Adds the `/co-tuong` navigation destination to the home card map.

- [ ] **Step 1: Add Cờ tướng to the home game grid**

Add a Cờ tướng activity using copy appropriate for the existing child-friendly home page and point its selection to `/co-tuong`. Preserve all existing topic ids and game paths.

- [ ] **Step 2: Inspect the integrated change for TypeScript/build errors**

Run `npm run build` once. Fix only actual compilation or bundling errors caused by the Cờ tướng implementation; do not add or run a separate test suite, per the user request.

- [ ] **Step 3: Commit final integration**

Run `git add app/page.tsx app/globals.css README.md` for files that changed and commit with `feat: add xiangqi to home`.

## Plan self-review

- Spec coverage: Tasks 1 and 3 implement both rule variants, board, AI, clocks and local mode. Tasks 2 and 4 implement sessions, presence, invitations, link joins, authoritative online games, reconnect and clocks. Task 5 integrates the home route and runs the requested minimal build check.
- Data privacy: Task 1 defines masking and Task 2 uses it for every online snapshot; AI receives only public blind state.
- User exception: all automated test steps are intentionally omitted; Task 5 retains a single compile/build gate to prevent a broken deploy.
- No placeholders remain; endpoint names and interfaces are defined before their consumers.
