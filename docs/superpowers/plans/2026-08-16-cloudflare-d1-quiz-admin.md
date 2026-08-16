# Cloudflare D1 Quiz Administration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển nguồn câu hỏi chính sang Cloudflare D1, cung cấp API và trang quản trị bằng mật khẩu, đồng thời giữ 180 câu trong HTML và GitHub Pages làm dự phòng.

**Architecture:** Cloudflare Worker hiện có sẽ định tuyến `/api/*` trước khi chuyển các request còn lại cho Vinext. D1 và Drizzle quản lý dữ liệu; trang đố vui tải API cùng origin và chuyển sang mảng fallback khi lỗi; `/admin` là static HTML gọi API quản trị bằng cookie phiên đã ký.

**Tech Stack:** TypeScript, Cloudflare Workers, Cloudflare D1, Drizzle ORM, Web Crypto, HTML/CSS/JavaScript thuần, Vinext/Vite, Wrangler, GitHub Pages.

## Global Constraints

- Giai đoạn 1 chỉ triển khai câu hỏi, API, xác thực quản trị, trang quản trị và phát hành Cloudflare.
- Không triển khai R2, upload ảnh, tài khoản người dùng hoặc lịch sử chơi.
- Giữ nguyên 180 câu trong `public/do-vui-do-meo.html` làm fallback cố định.
- GitHub Pages tiếp tục hoạt động; Cloudflare Worker trở thành URL chính.
- Không lưu mật khẩu, hash, salt hoặc session secret trong Git hay bundle trình duyệt.
- Không bổ sung test tự động theo yêu cầu; mỗi task dùng type-check, build, migration/seed checks hoặc smoke check tương ứng.
- Node.js tối thiểu `22.13.0`; giữ nguyên các phiên bản dependency hiện có.

---

### Task 1: Cấu hình D1 và schema Drizzle

**Files:**
- Modify: `.openai/hosting.json`
- Create: `wrangler.jsonc`
- Modify: `db/schema.ts`
- Modify: `db/index.ts`
- Create: `drizzle/0000_quiz-admin.sql`
- Modify: `package.json`

**Interfaces:**
- Produces: `questions`, `adminLoginAttempts`, `createDb(binding)` và binding `Env.DB` cho các task API.
- Consumes: D1 binding tên `DB` từ Worker environment.

- [ ] **Step 1: Bật D1 binding cho local build**

Đổi `.openai/hosting.json` thành:

```json
{
  "d1": "DB",
  "r2": null
}
```

- [ ] **Step 2: Thêm Wrangler production config**

Tạo `wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "sunshinson",
  "main": "dist/server/index.js",
  "compatibility_date": "2026-05-15",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "dist/client",
    "binding": "ASSETS"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "sunshinson-db",
      "database_id": "00000000-0000-4000-8000-000000000000",
      "migrations_dir": "drizzle"
    }
  ],
  "observability": { "enabled": true }
}
```

Giá trị UUID hợp lệ tạm thời chỉ phục vụ local; Task 8 dùng `wrangler d1 create --update-config` để thay bằng ID production thật.

- [ ] **Step 3: Khai báo schema**

Trong `db/schema.ts`, export hai bảng với `sqliteTable`, `integer`, `text`, `index`, `uniqueIndex`:

```ts
export const questions = sqliteTable("questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  topic: text("topic").notNull(),
  age: text("age").notNull(),
  tag: text("tag").notNull(),
  questionText: text("question_text").notNull(),
  normalizedQuestion: text("normalized_question").notNull(),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  optionC: text("option_c").notNull(),
  optionD: text("option_d").notNull(),
  correctIndex: integer("correct_index").notNull(),
  explanation: text("explanation").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("questions_active_idx").on(table.isActive),
  index("questions_topic_age_active_idx").on(table.topic, table.age, table.isActive),
  uniqueIndex("questions_normalized_unique").on(table.normalizedQuestion),
]);

export const adminLoginAttempts = sqliteTable("admin_login_attempts", {
  clientKey: text("client_key").primaryKey(),
  failedCount: integer("failed_count").notNull().default(0),
  windowStartedAt: integer("window_started_at").notNull(),
  blockedUntil: integer("blocked_until"),
});
```

Migration SQL sinh ra phải bổ sung `CHECK` cho `topic`, `age`, `tag`, `correct_index` và `is_active` nếu Drizzle generator không tự tạo được enum constraints.

- [ ] **Step 4: Chuyển DB factory sang explicit binding**

Đổi `db/index.ts` thành factory không phụ thuộc global env:

```ts
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function createDb(binding: D1Database) {
  return drizzle(binding, { schema });
}

export type Database = ReturnType<typeof createDb>;
```

- [ ] **Step 5: Thêm database scripts**

Thêm vào `package.json`:

```json
"db:generate": "drizzle-kit generate --name quiz-admin",
"db:migrate:local": "wrangler d1 migrations apply DB --local --config wrangler.jsonc",
"db:migrate:remote": "wrangler d1 migrations apply DB --remote --config wrangler.jsonc",
"db:seed:generate": "node scripts/generate-quiz-seed.mjs",
"db:seed:local": "wrangler d1 execute DB --local --file db/seed/questions.sql --config wrangler.jsonc",
"db:seed:remote": "wrangler d1 execute DB --remote --file db/seed/questions.sql --config wrangler.jsonc",
"deploy:cloudflare": "npm run build && wrangler deploy --config wrangler.jsonc"
```

- [ ] **Step 6: Generate và rà soát migration**

Run: `npm run db:generate`

Expected: một migration SQL mới trong `drizzle/` tạo đúng hai bảng và ba index của `questions`.

Run: `git diff --check`

Expected: exit 0.

- [ ] **Step 7: Commit schema**

```bash
git add .openai/hosting.json wrangler.jsonc db/schema.ts db/index.ts drizzle package.json package-lock.json
git commit -m "Add D1 schema for quiz administration"
```

---

### Task 2: Tạo seed 180 câu từ HTML fallback

**Files:**
- Create: `scripts/generate-quiz-seed.mjs`
- Create: `db/seed/questions.sql`

**Interfaces:**
- Consumes: hai mảng câu hỏi hiện có trong `public/do-vui-do-meo.html`.
- Produces: SQL idempotent `INSERT OR IGNORE` cho schema `questions`.

- [ ] **Step 1: Viết seed generator**

Script đọc HTML, lấy hai array literals bằng biểu thức:

```js
const match = html.match(
  /const questions = (\[[\s\S]*?\n\]);[\s\S]*?questions\.push\(\.\.\.(\[[\s\S]*?\n\])\);/
);
```

Script chạy riêng hai array literals bằng `node:vm`, ghép thành 180 phần tử, xác nhận từng phần tử có `topic`, `age`, `tag`, `q`, bốn `opts`, `correct` từ 0–3 và `explain`. Chuẩn hoá nội dung bằng:

```js
const normalizeQuestion = (value) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
```

Escape SQL single quote bằng `value.replaceAll("'", "''")`. Sinh một transaction gồm `INSERT OR IGNORE INTO questions (...) VALUES (...)`; `created_at` và `updated_at` dùng `unixepoch()`.

- [ ] **Step 2: Sinh và kiểm tra seed**

Run: `npm run db:seed:generate`

Expected: output báo `Generated 180 quiz questions` và tạo `db/seed/questions.sql`.

Run:

```bash
npm run db:migrate:local
npm run db:seed:local
npx wrangler d1 execute DB --local --config wrangler.jsonc --command "SELECT topic, age, COUNT(*) AS count FROM questions GROUP BY topic, age ORDER BY topic, age"
```

Expected: 15 nhóm, mỗi nhóm có `count = 12`.

- [ ] **Step 3: Chạy seed lần hai**

Run: `npm run db:seed:local`

Run: `npx wrangler d1 execute DB --local --config wrangler.jsonc --command "SELECT COUNT(*) AS count FROM questions"`

Expected: `count = 180`, chứng minh seed không tạo bản ghi trùng.

- [ ] **Step 4: Commit seed**

```bash
git add scripts/generate-quiz-seed.mjs db/seed/questions.sql
git commit -m "Add idempotent seed for quiz questions"
```

---

### Task 3: Kiểu dữ liệu và validation câu hỏi

**Files:**
- Create: `worker/env.ts`
- Create: `worker/http.ts`
- Create: `worker/question-model.ts`

**Interfaces:**
- Produces: `Env`, `QuestionInput`, `PublicQuestion`, `normalizeQuestion`, `validateQuestionInput`, `toPublicQuestion`, `jsonResponse`, `errorResponse`.
- Consumes: schema Drizzle từ Task 1.

- [ ] **Step 1: Khai báo Worker Env**

`worker/env.ts` export interface:

```ts
export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  ADMIN_PASSWORD_HASH: string;
  ADMIN_PASSWORD_SALT: string;
  ADMIN_SESSION_SECRET: string;
  LOGIN_ATTEMPT_SALT: string;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}
```

- [ ] **Step 2: Thêm HTTP helpers**

`worker/http.ts` tạo JSON response với `content-type: application/json; charset=utf-8`, nhận status và headers tuỳ chọn. Error shape cố định:

```ts
export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}
```

- [ ] **Step 3: Thêm question model**

`QuestionInput` dùng tên `topic`, `age`, `tag`, `q`, `opts`, `correct`, `explain`, `isActive`. `validateQuestionInput(value)` trả discriminated union `{ ok: true; value } | { ok: false; fields }` và kiểm tra enum, chuỗi không rỗng, đúng bốn đáp án khác rỗng, `correct` nguyên từ 0–3.

`toPublicQuestion(row)` map bốn cột option thành `opts` và các cột DB thành shape HTML hiện tại:

```ts
export interface PublicQuestion {
  id: number;
  topic: "dongvat" | "tunhien" | "toanhoc" | "domeo" | "vanhoa";
  age: "de" | "vua" | "kho";
  tag: "đố vui" | "đố mẹo";
  q: string;
  opts: [string, string, string, string];
  correct: number;
  explain: string;
  isActive?: boolean;
}
```

- [ ] **Step 4: Type-check và commit**

Run: `npx tsc --noEmit`

Expected: exit 0.

```bash
git add worker/env.ts worker/http.ts worker/question-model.ts
git commit -m "Add quiz API models and validation"
```

---

### Task 4: Xác thực quản trị và giới hạn đăng nhập

**Files:**
- Create: `worker/admin-auth.ts`
- Create: `scripts/generate-admin-secrets.mjs`

**Interfaces:**
- Consumes: `Env`, `createDb`, `adminLoginAttempts`, request headers/cookies.
- Produces: `handleAdminLogin`, `handleAdminLogout`, `requireAdmin`, `requireSameOrigin` và công cụ sinh bốn secret.

- [ ] **Step 1: Thêm encoding và crypto helpers**

Dùng Web Crypto cho:

- PBKDF2-SHA-256, 210.000 iterations, 256-bit output để so sánh mật khẩu với `ADMIN_PASSWORD_HASH` và `ADMIN_PASSWORD_SALT` dạng base64url.
- HMAC-SHA-256 với `ADMIN_SESSION_SECRET` để ký payload JSON có trường `exp` là Unix timestamp theo giây.
- So sánh byte bằng vòng lặp constant-time thay vì so sánh string trực tiếp.
- Session token được ghép bằng `base64url(payload) + "." + base64url(signature)`.

- [ ] **Step 2: Thêm cookie helpers**

Cookie tên `sunshinson_admin`; login thành công đặt:

```text
HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800
```

Logout đặt cùng cookie với `Max-Age=0`.

- [ ] **Step 3: Thêm rate limit D1**

`client_key` là SHA-256 của `CF-Connecting-IP + ":" + LOGIN_ATTEMPT_SALT`. Trước khi kiểm tra password:

- Xoá record có `window_started_at` cũ hơn 24 giờ.
- Nếu `blocked_until > now`, trả HTTP 429.
- Cửa sổ 15 phút; sau 5 lần sai đặt `blocked_until = now + 900`.
- Login đúng xoá record của client.

- [ ] **Step 4: Thêm auth handlers**

- `POST /api/admin/login` chỉ nhận JSON `{ "password": string }`, trả thông báo chung khi sai.
- `POST /api/admin/logout` xoá cookie.
- `requireAdmin(request, env)` trả HTTP 401 nếu token thiếu, chữ ký sai hoặc hết hạn.
- `requireSameOrigin(request)` so sánh `Origin` với `new URL(request.url).origin`, trả HTTP 403 nếu khác.

- [ ] **Step 5: Type-check và commit**

Tạo `scripts/generate-admin-secrets.mjs` nhận mật khẩu từ biến môi trường `SUNSHINSON_ADMIN_PASSWORD`, tạo salt 16 byte, chạy PBKDF2-SHA-256 210.000 iterations và tạo hai random secret 32 byte. Script in bốn dòng theo đúng tên secret nhưng không in lại mật khẩu. Nếu biến môi trường rỗng, script phải thoát lỗi trước khi sinh dữ liệu.

Người dùng chạy script trong terminal riêng bằng password prompt ẩn:

```zsh
read -s "SUNSHINSON_ADMIN_PASSWORD?Admin password: "
export SUNSHINSON_ADMIN_PASSWORD
node scripts/generate-admin-secrets.mjs
unset SUNSHINSON_ADMIN_PASSWORD
```

Run: `npx tsc --noEmit`

```bash
git add worker/admin-auth.ts scripts/generate-admin-secrets.mjs
git commit -m "Add password authentication for quiz admin"
```

---

### Task 5: API đọc và CRUD câu hỏi

**Files:**
- Create: `worker/questions-api.ts`
- Modify: `worker/index.ts`

**Interfaces:**
- Consumes: `Env`, `createDb`, schema, validation, auth helpers và Worker cache/context.
- Produces: public `GET /api/questions` và toàn bộ `/api/admin/*` routes.

- [ ] **Step 1: Public questions handler**

`GET /api/questions`:

- Dùng exact cache key `${origin}/api/questions`.
- Trả cache hit trước khi query.
- Query `isActive = true`, order theo `id`.
- Map bằng `toPublicQuestion` và bỏ `isActive` khỏi public response.
- Header `Cache-Control: public, max-age=60, s-maxage=300`.
- Dùng `ctx.waitUntil(caches.default.put(cacheKey, response.clone()))`.

- [ ] **Step 2: Admin list/create/update/status/delete**

Routes và status:

- `GET /api/admin/questions`: 200, tất cả rows mapped có `isActive`.
- `POST /api/admin/questions`: 201; validate rồi insert normalized question.
- `PUT /api/admin/questions/:id`: 200; validate rồi update toàn bộ fields và `updatedAt`.
- `PATCH /api/admin/questions/:id/status`: 200; body `{ "isActive": boolean }`.
- `DELETE /api/admin/questions/:id`: 204 khi xoá được.
- ID sai hoặc không tồn tại: 404.
- Unique conflict: 409 `duplicate_question`.

Mọi mutation gọi `requireSameOrigin`, `requireAdmin` và xoá cache `${origin}/api/questions` bằng `ctx.waitUntil(caches.default.delete(cacheKey))`.

- [ ] **Step 3: Tách route dispatcher**

Trong `worker/index.ts`, trước image optimization:

```ts
const apiResponse = await handleApiRequest(request, env, ctx);
if (apiResponse) return apiResponse;
```

`handleApiRequest` trả `null` cho path không bắt đầu `/api/`. Với lỗi ngoài dự kiến, log chi tiết bằng `console.error` và trả HTTP 500 với message chung. Thay interface `Env` cũ bằng import từ `worker/env.ts`; image optimization chỉ chạy khi `env.IMAGES` tồn tại, nếu thiếu trả asset gốc hoặc chuyển request cho Vinext.

- [ ] **Step 4: Build và local API smoke check**

Run: `npm run build`

Expected: `Build complete.`

Run local server, gọi `GET /api/questions`, xác nhận HTTP 200 và mảng 180 phần tử. Gọi mutation không có cookie, xác nhận HTTP 401.

- [ ] **Step 5: Commit API**

```bash
git add worker/questions-api.ts worker/index.ts
git commit -m "Add D1 quiz question APIs"
```

---

### Task 6: Trang quản trị câu hỏi

**Files:**
- Create: `public/admin.html`

**Interfaces:**
- Consumes: `/api/admin/login`, `/api/admin/logout`, `/api/admin/questions` và CRUD endpoints từ Task 5.
- Produces: UI cùng origin tại `/admin.html` và `/admin` nếu static asset routing hỗ trợ extensionless path.

- [ ] **Step 1: Tạo login view**

Form một trường password, submit `POST /api/admin/login` với `credentials: "same-origin"`. HTTP 200 mở dashboard; 401/429 hiển thị message từ API. Không lưu password vào localStorage, sessionStorage, URL hoặc log.

- [ ] **Step 2: Tạo questions dashboard**

Dashboard có:

- Tổng số câu và số câu đang xuất bản.
- Tìm kiếm client-side theo nội dung.
- Filter `topic`, `age`, `isActive`.
- Bảng hiển thị ID, nội dung rút gọn, chủ đề, tuổi, trạng thái và actions.
- Nút thêm mới, sửa, ẩn/hiện, xoá, đăng xuất.

- [ ] **Step 3: Tạo add/edit form**

Form có `topic`, `age`, `tag`, `q`, bốn input đáp án, select đáp án đúng, `explain`, `isActive`. Submit POST hoặc PUT theo mode. Hiển thị `error.fields` cạnh trường tương ứng. Thành công reload list và đóng form.

- [ ] **Step 4: Thêm status/delete actions**

- Status dùng PATCH với body `{ isActive: !current }`.
- Delete chỉ gửi DELETE sau `window.confirm` chứa ID và phần đầu nội dung câu hỏi.
- HTTP 401 ở bất kỳ request nào quay về login view.

- [ ] **Step 5: Build và commit**

Run: `npm run build`

Expected: `dist/client/admin.html` tồn tại.

```bash
git add public/admin.html
git commit -m "Add quiz administration page"
```

---

### Task 7: DB-first loading và HTML fallback

**Files:**
- Modify: `public/do-vui-do-meo.html`

**Interfaces:**
- Consumes: public `GET /api/questions` và mảng 180 câu hiện có.
- Produces: `fallbackQuestions`, mutable `questions`, `loadQuestions()` và nhãn trạng thái nguồn dữ liệu.

- [ ] **Step 1: Đổi tên dữ liệu fallback**

Đổi `const questions = [...]` thành `const fallbackQuestions = [...]`; đổi `questions.push(...[...])` thành `fallbackQuestions.push(...[...])`; tạo:

```js
let questions = fallbackQuestions.slice();
```

- [ ] **Step 2: Thêm validation dữ liệu API**

`isValidQuestion(value)` kiểm tra object, topic/age/tag hợp lệ, `q`/`explain` không rỗng, `opts.length === 4`, mọi option không rỗng và `correct` nguyên 0–3. `isValidQuestionList(value)` yêu cầu array không rỗng và mọi phần tử hợp lệ.

- [ ] **Step 3: Thêm loading và fallback flow**

`loadQuestions()` dùng `AbortController` timeout 5.000 ms và `fetch('./api/questions')` để GitHub Pages subpath vẫn gọi tương đối. Khi response/API data hợp lệ, gán `questions = data`; nếu lỗi, gán bản sao fallback và hiển thị `Đang dùng dữ liệu dự phòng`.

Thay lời gọi cuối file:

```js
loadQuestions().finally(renderSetup);
```

Trong khi tải, hiển thị card `Đang tải ngân hàng câu hỏi…` và disable bắt đầu chơi. Thêm nhãn nhỏ cho source trạng thái, không làm thay đổi luồng quiz sau khi đã load.

- [ ] **Step 4: Rà soát hai chế độ**

- Local Cloudflare dev có D1: setup hiển thị 180 câu từ API.
- Chặn `/api/questions`: setup vẫn hiển thị 180 câu và nhãn fallback.
- GitHub Pages build: relative API trả 404 và fallback hoạt động.

- [ ] **Step 5: Build và commit**

Run: `npm run build`

Run: `GITHUB_ACTIONS=true BASE_PATH=/SunShinSon NEXT_PUBLIC_QUIZ_PATH=/SunShinSon/do-vui-do-meo.html npm run build:pages`

Expected: cả hai build exit 0.

```bash
git add public/do-vui-do-meo.html
git commit -m "Load quiz questions from D1 with HTML fallback"
```

---

### Task 8: Provision Cloudflare, secrets, migration và deploy

**Files:**
- Modify: `wrangler.jsonc` bằng Wrangler để ghi D1 production ID.
- Include: `docs/superpowers/plans/2026-08-16-cloudflare-d1-quiz-admin.md`

**Interfaces:**
- Consumes: Cloudflare account authorization và toàn bộ code từ Tasks 1–7.
- Produces: production D1, Worker URL, admin credentials và deployed application.

- [ ] **Step 1: Authenticate Wrangler**

Run: `npx wrangler login`

Người dùng hoàn tất xác thực trong trình duyệt. Run: `npx wrangler whoami` và xác nhận đúng Cloudflare account.

- [ ] **Step 2: Create production D1**

Run:

```bash
npx wrangler d1 create sunshinson-db --location apac --binding DB --update-config --config wrangler.jsonc
```

Expected: `wrangler.jsonc` chứa database UUID thật thay cho UUID tạm.

- [ ] **Step 3: Apply migration và seed production**

Run:

```bash
npm run db:migrate:remote
npm run db:seed:remote
npx wrangler d1 execute DB --remote --config wrangler.jsonc --command "SELECT topic, age, COUNT(*) AS count FROM questions GROUP BY topic, age ORDER BY topic, age"
```

Expected: 15 nhóm, mỗi nhóm 12 câu.

- [ ] **Step 4: Deploy Worker lần đầu**

Run: `npm run deploy:cloudflare`

Expected: Wrangler trả production URL của Worker tên `sunshinson` trên domain `workers.dev` và deployment success. Admin login chưa hoạt động cho tới khi Step 5 cấu hình secrets.

- [ ] **Step 5: Configure four secrets**

Người dùng tự chạy `scripts/generate-admin-secrets.mjs` trong terminal riêng bằng password prompt ẩn ở Task 4, sau đó nhập bốn giá trị trực tiếp vào Cloudflare dashboard của Worker `sunshinson` hoặc lần lượt bằng `wrangler secret put`. Không gửi secret qua chat và không ghi chúng vào file trong repo.

Secret names chính xác:

```text
ADMIN_PASSWORD_HASH
ADMIN_PASSWORD_SALT
ADMIN_SESSION_SECRET
LOGIN_ATTEMPT_SALT
```

- [ ] **Step 6: Production smoke checks**

Trên URL production:

- Home và `/do-vui-do-meo.html` trả HTTP 200.
- `/api/questions` trả 180 câu.
- `/admin.html` đăng nhập được với mật khẩu quản trị.
- Thêm một câu tạm, sửa, ẩn/hiện, xoá; API public phản ánh cache invalidation.
- Tạm làm `/api/questions` lỗi trong browser devtools hoặc bằng request interception; trang quiz dùng fallback 180 câu.
- GitHub Pages hiện tại vẫn tải và dùng fallback.

- [ ] **Step 7: Commit production config và push**

Kiểm tra `wrangler.jsonc` chỉ chứa D1 database ID công khai, không chứa secret.

```bash
git add wrangler.jsonc docs/superpowers/plans/2026-08-16-cloudflare-d1-quiz-admin.md
git commit -m "Configure Cloudflare production deployment"
git push origin main
```

- [ ] **Step 8: Bàn giao**

Bàn giao Worker URL, admin URL, GitHub Pages backup URL và hướng dẫn đổi mật khẩu bằng cách cập nhật `ADMIN_PASSWORD_HASH`/`ADMIN_PASSWORD_SALT` trong Cloudflare Secrets.
