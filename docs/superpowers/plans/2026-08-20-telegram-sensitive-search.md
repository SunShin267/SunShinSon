# Telegram Sensitive Content Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only macOS web application that indexes Telegram content available to one authorized account, classifies supported text and media locally, and provides read-only sensitive-content search.

**Architecture:** A React/Vite dashboard talks to a loopback-only FastAPI service. The service isolates TDLib behind a gateway, persists resumable synchronization and analysis state in SQLite, runs local extractors/detectors, and exposes keyword and semantic search without sending message content to third-party AI services.

**Tech Stack:** Python 3.12+, FastAPI, Uvicorn, SQLite/FTS5, TDLib JSON interface, React 19, Vite 8, TypeScript 5.9, local optional OCR/transcription/document/model adapters.

**Spec:** `docs/superpowers/specs/2026-08-20-telegram-sensitive-search-design.md`

## Global Constraints

- The HTTP service must bind only to `127.0.0.1`.
- Telegram and model-download endpoints are the only intended network destinations.
- Message bodies, credentials, authorization codes, and extracted file contents must not be logged.
- The application is read-only with respect to Telegram.
- One Telegram account and one local macOS user are supported in the first version.
- Supported content is text, common images, audio/voice, video, PDF, DOCX, XLSX, PPTX, and TXT.
- No dedicated automated test suite will be added, per the user's request; each task instead includes a deterministic local smoke command.
- The tool lives under `telegram-search/` and does not join the deployed SunShinSon application bundle.

---

### Task 1: Local backend, security boundary, and persistence

**Files:**
- Create: `telegram-search/backend/pyproject.toml`
- Create: `telegram-search/backend/app/__init__.py`
- Create: `telegram-search/backend/app/config.py`
- Create: `telegram-search/backend/app/db.py`
- Create: `telegram-search/backend/app/models.py`
- Create: `telegram-search/backend/app/security.py`
- Create: `telegram-search/backend/app/main.py`
- Create: `telegram-search/backend/app/routers/health.py`
- Create: `telegram-search/backend/app/routers/settings.py`
- Create: `telegram-search/backend/scripts/smoke_backend.py`

**Interfaces:**
- Produces: `Settings.load() -> Settings`, `Database.initialize() -> None`, `Database.connection() -> sqlite3.Connection`, `create_app(settings: Settings | None = None) -> FastAPI`.
- Produces tables: `app_settings`, `sources`, `messages`, `attachments`, `analysis_results`, `jobs`, `custom_rules`, and FTS5 table `message_search`.
- Produces API: `GET /api/health`, `GET /api/settings`, `PATCH /api/settings`.

- [ ] **Step 1: Scaffold the isolated Python package**

Define runtime dependencies and optional media extras without adding them to the root Node project:

```toml
[project]
name = "telegram-sensitive-search"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.116,<1",
  "uvicorn[standard]>=0.35,<1",
  "pydantic-settings>=2.10,<3",
  "keyring>=25.6,<26",
  "cryptography>=45,<46",
  "python-multipart>=0.0.20,<1",
]

[project.optional-dependencies]
media = [
  "Pillow>=11.3,<12",
  "pypdf>=5.9,<6",
  "python-docx>=1.2,<2",
  "openpyxl>=3.1,<4",
  "python-pptx>=1.0,<2",
]
ai = [
  "numpy>=2.2,<3",
  "onnxruntime>=1.22,<2",
  "sentence-transformers>=5,<6",
  "faster-whisper>=1.2,<2",
]
```

- [ ] **Step 2: Implement configuration and secret storage**

Use `~/Library/Application Support/TelegramSensitiveSearch` by default, allow `TELEGRAM_SEARCH_DATA_DIR` for development, validate that the host is exactly `127.0.0.1`, and store `api_hash` plus TDLib database key through `keyring` rather than SQLite.

```python
class Settings(BaseSettings):
    host: Literal["127.0.0.1"] = "127.0.0.1"
    port: int = 8765
    data_dir: Path
    max_media_mb: int = 250
    retention_days: int = 7
    analysis_workers: int = 2
```

- [ ] **Step 3: Implement the database and migrations**

Use explicit `CREATE TABLE IF NOT EXISTS` migrations tracked in `schema_meta`. Store Telegram numeric identifiers as decimal text so JavaScript precision cannot corrupt them. Add FTS triggers or explicit upserts that keep `message_search(message_key, body, extracted_text)` synchronized.

```python
@contextmanager
def connection(self) -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(self.path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
```

- [ ] **Step 4: Enforce the loopback API boundary**

Generate a random token at process start, return it only from the local bootstrap HTML/config endpoint, require it on state-changing routes, and reject `Origin` values other than the configured local origin. Keep health read-only and token-free.

```python
if origin and origin != settings.browser_origin:
    return JSONResponse({"detail": "origin_not_allowed"}, status_code=403)
```

- [ ] **Step 5: Add health and settings routes**

Health reports database readiness and optional dependency availability without exposing filesystem paths or secrets. Settings PATCH accepts only storage, retention, threshold, and concurrency fields.

- [ ] **Step 6: Run the backend smoke check**

Run:

```bash
cd telegram-search/backend
python3 -m venv .venv
.venv/bin/pip install -e .
.venv/bin/python scripts/smoke_backend.py
```

Expected: exits `0`, prints `health=ok`, creates the schema in a temporary directory, confirms a non-loopback host is rejected, and deletes the temporary directory.

- [ ] **Step 7: Commit the backend foundation**

```bash
git add telegram-search/backend
git commit -m "feat: add local Telegram search backend foundation"
```

---

### Task 2: Extraction, classification, and local search pipeline

**Files:**
- Create: `telegram-search/backend/app/analysis/types.py`
- Create: `telegram-search/backend/app/analysis/extractors.py`
- Create: `telegram-search/backend/app/analysis/rules.py`
- Create: `telegram-search/backend/app/analysis/models.py`
- Create: `telegram-search/backend/app/analysis/pipeline.py`
- Create: `telegram-search/backend/app/search.py`
- Create: `telegram-search/backend/app/routers/search.py`
- Create: `telegram-search/backend/app/routers/rules.py`
- Create: `telegram-search/backend/scripts/smoke_analysis.py`

**Interfaces:**
- Consumes: `Database.connection()` and schema from Task 1.
- Produces: `ExtractionResult`, `Detection`, `AnalysisPipeline.analyze(message_key: str) -> AnalysisSummary`, `SearchService.search(query: SearchQuery) -> SearchPage`.
- Produces API: `GET /api/search`, `GET/POST/PATCH/DELETE /api/rules`.

- [ ] **Step 1: Define stable analysis types**

```python
@dataclass(frozen=True)
class Detection:
    category: str
    score: float
    evidence: str
    detector: str
    detector_version: str

@dataclass(frozen=True)
class ExtractionResult:
    text: str
    media_kind: str
    warnings: tuple[str, ...] = ()
```

Never put full message content into `evidence`; use matched terms, page/frame/timestamp references, and short bounded excerpts.

- [ ] **Step 2: Implement format extractors with graceful capability reporting**

Implement direct text, Pillow metadata/image OCR hook, PDF, DOCX, XLSX, PPTX, and TXT extraction. Add subprocess adapters for `tesseract` and `ffmpeg`; add a `faster-whisper` adapter only when installed and a local model is configured. Return `unsupported`, `missing_dependency`, `protected`, `oversized`, or `corrupt` statuses explicitly.

- [ ] **Step 3: Implement deterministic category rules**

Seed Vietnamese and English rule groups for adult material, violence, scams, gambling, and controlled substances. Normalize Unicode, strip zero-width characters, preserve the original for previews, support regex exclusions, and bound regex execution by rejecting nested/unbounded expressions during rule validation.

```python
def classify_text(text: str, rules: Sequence[CompiledRule]) -> list[Detection]:
    normalized = normalize_for_matching(text)
    return merge_rule_hits(normalized, rules)
```

- [ ] **Step 4: Add optional local semantic and media adapters**

Load configured models from the application data directory only. `sentence-transformers` supplies local embeddings; ONNX adapters accept a manifest containing labels, input size, normalization, and model SHA-256. If no model is installed, health/settings must say `not_installed` and deterministic rules remain usable.

- [ ] **Step 5: Implement the resumable analysis pipeline**

Claim one queued job transactionally, check attachment hashes, run available extractors and detectors, store results with detector versions, update FTS, and always transition the job to `done`, `retry`, `blocked`, or `failed` with a sanitized reason.

- [ ] **Step 6: Implement keyword and semantic search**

Support query text, categories, source ids, time range, media types, minimum confidence, cursor, and page size. Use parameterized FTS queries and stable `(sent_at, message_key)` cursor ordering. If vector search is unavailable, return `semantic_available: false` rather than failing the request.

- [ ] **Step 7: Implement the minor-safety barrier and preview policy**

Store only a restricted marker when a dedicated local detector crosses the configured suspected-minor threshold. Do not write extracted text, embeddings, thumbnail paths, or user-searchable labels for that item. Blur other sensitive previews by default in response metadata.

- [ ] **Step 8: Run the analysis smoke check**

Run:

```bash
cd telegram-search/backend
.venv/bin/pip install -e '.[media]'
.venv/bin/python scripts/smoke_analysis.py
```

Expected: fixture messages and generated local documents are extracted, classified, indexed, filtered, and paginated; missing OCR/transcription binaries are reported as capabilities rather than crashes.

- [ ] **Step 9: Commit the local analysis pipeline**

```bash
git add telegram-search/backend
git commit -m "feat: add local sensitive content analysis and search"
```

---

### Task 3: TDLib authorization and resumable Telegram synchronization

**Files:**
- Create: `telegram-search/backend/app/telegram/types.py`
- Create: `telegram-search/backend/app/telegram/gateway.py`
- Create: `telegram-search/backend/app/telegram/tdjson.py`
- Create: `telegram-search/backend/app/telegram/service.py`
- Create: `telegram-search/backend/app/routers/telegram.py`
- Create: `telegram-search/backend/scripts/smoke_telegram_gateway.py`

**Interfaces:**
- Consumes: `Settings`, secret store, `Database`, job schema, and media limits.
- Produces: `TelegramGateway` protocol, `TdJsonGateway`, `TelegramService`, and `MockTelegramGateway` for offline smoke/demo mode.
- Produces API: `GET /api/telegram/status`, `POST /api/telegram/configure`, `POST /api/telegram/auth/{action}`, `GET /api/sources`, `PATCH /api/sources/{source_id}`, `POST /api/sync`, `GET /api/jobs`.

- [ ] **Step 1: Define the gateway protocol and DTOs**

```python
class TelegramGateway(Protocol):
    async def authorization_state(self) -> AuthorizationState: ...
    async def submit_auth(self, action: AuthAction) -> AuthorizationState: ...
    async def list_sources(self, cursor: str | None) -> SourcePage: ...
    async def iter_history(self, source_id: str, checkpoint: str | None) -> AsyncIterator[TelegramMessage]: ...
    async def download(self, file_id: str, destination: Path) -> DownloadResult: ...
```

No method for sending, deleting, forwarding, joining, inviting, banning, or editing is included.

- [ ] **Step 2: Implement the TDLib JSON bridge**

Load `libtdjson` from `TELEGRAM_SEARCH_TDLIB_PATH` or standard Homebrew locations, bind `td_json_client_create/send/receive/execute/destroy`, match responses by `@extra`, and fan out updates through an async queue. Sanitize all errors before logging.

- [ ] **Step 3: Implement authorization state handling**

Handle TDLib parameter, phone number, email, code, QR, registration, and 2FA password states. Never persist codes or passwords. Persist `api_id` in SQLite and `api_hash` plus the TDLib encryption key in the secret store.

- [ ] **Step 4: Implement source discovery and selection**

Load main, archive, and folder chat lists incrementally. Normalize source type, title, username, access flags, and last activity. Allow a public username/link lookup only through Telegram; selecting a source never bypasses membership or content protection.

- [ ] **Step 5: Implement resumable history synchronization**

Page backward through `getChatHistory`, upsert messages idempotently, enqueue eligible attachments, honor `max_media_mb`, persist a per-source checkpoint, and process TDLib `updateNewMessage`/`updateMessageContent` updates for selected sources.

- [ ] **Step 6: Implement protected-content and flood-wait behavior**

Mark protected or unavailable media without retry loops. Convert TDLib rate-limit errors into a `retry_at` timestamp; the worker sleeps no blocking thread and resumes from the last committed checkpoint.

- [ ] **Step 7: Run the gateway smoke check without private data**

Run:

```bash
cd telegram-search/backend
.venv/bin/python scripts/smoke_telegram_gateway.py
```

Expected: the mock gateway walks all authorization states, discovers fixture sources, resumes history from a checkpoint, deduplicates messages, queues supported attachments, and proves no write-action method exists on the gateway.

- [ ] **Step 8: Commit Telegram integration**

```bash
git add telegram-search/backend
git commit -m "feat: integrate read-only TDLib synchronization"
```

---

### Task 4: Local dashboard

**Files:**
- Create: `telegram-search/frontend/package.json`
- Create: `telegram-search/frontend/vite.config.ts`
- Create: `telegram-search/frontend/tsconfig.json`
- Create: `telegram-search/frontend/index.html`
- Create: `telegram-search/frontend/src/main.tsx`
- Create: `telegram-search/frontend/src/api.ts`
- Create: `telegram-search/frontend/src/types.ts`
- Create: `telegram-search/frontend/src/App.tsx`
- Create: `telegram-search/frontend/src/components/SetupView.tsx`
- Create: `telegram-search/frontend/src/components/SourcesView.tsx`
- Create: `telegram-search/frontend/src/components/SearchView.tsx`
- Create: `telegram-search/frontend/src/components/JobsView.tsx`
- Create: `telegram-search/frontend/src/styles.css`
- Create: `telegram-search/frontend/scripts/smoke-ui.mjs`

**Interfaces:**
- Consumes: all HTTP APIs from Tasks 1–3.
- Produces: production static assets in `telegram-search/frontend/dist` served by FastAPI, plus setup, sources, search, and jobs/settings views.

- [ ] **Step 1: Scaffold React/Vite with strict TypeScript**

Use React 19 and Vite 8. Configure `/api` proxying to `http://127.0.0.1:8765` for development and a relative base for production static serving.

- [ ] **Step 2: Implement the typed API client**

Bootstrap the run token once, attach `X-Local-Session` to state-changing calls, parse structured error bodies, abort superseded searches, and never persist auth codes/passwords in browser storage.

```ts
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, withLocalSession(init));
  if (!response.ok) throw await ApiError.fromResponse(response);
  return response.json() as Promise<T>;
}
```

- [ ] **Step 3: Implement guided setup**

Show TDLib installation status, `api_id`/`api_hash` configuration, Telegram authorization state, model capabilities, storage limits, and explicit local-only privacy copy. Password/code fields clear immediately after submission.

- [ ] **Step 4: Implement sources and synchronization**

Add debounced source search, source-type/access badges, selection toggles, last-sync/checkpoint status, start/pause controls, and disk-limit warnings. Source selection remains a local database setting until synchronization begins.

- [ ] **Step 5: Implement sensitive search results**

Add text/semantic mode, category chips, source/date/type/confidence filters, cursor pagination, match evidence, detector version, explicit unavailable states, blurred previews, and an open-in-Telegram action. Never render suspected-minor content or previews.

- [ ] **Step 6: Implement jobs, custom rules, and cleanup**

Show sync/analysis progress, retry time, sanitized failures, storage usage, detector capability/version, rule editor with validation errors, re-analysis action, and cache cleanup confirmation.

- [ ] **Step 7: Build and run the UI smoke check**

Run:

```bash
cd telegram-search/frontend
npm install
npm run build
node scripts/smoke-ui.mjs
```

Expected: TypeScript and Vite build succeed; the smoke script confirms required routes, form labels, preview blur controls, and no Telegram write-action labels are present in the production bundle.

- [ ] **Step 8: Commit the dashboard**

```bash
git add telegram-search/frontend
git commit -m "feat: add local Telegram search dashboard"
```

---

### Task 5: Launcher, packaging, documentation, and end-to-end smoke verification

**Files:**
- Create: `telegram-search/Start Telegram Search.command`
- Create: `telegram-search/scripts/setup-macos.sh`
- Create: `telegram-search/scripts/smoke-local.sh`
- Create: `telegram-search/.gitignore`
- Create: `telegram-search/README.md`
- Modify: `telegram-search/backend/app/main.py`

**Interfaces:**
- Consumes: backend and dashboard artifacts from Tasks 1–4.
- Produces: one setup script, one double-click launcher, static frontend serving, and an offline demo/smoke path.

- [ ] **Step 1: Serve the production dashboard from FastAPI**

Mount `frontend/dist/assets` and return `index.html` only for non-API browser routes. API 404 responses remain JSON and are never swallowed by the SPA fallback.

- [ ] **Step 2: Implement the macOS setup script**

Check Python/Node versions, create `.venv`, install backend and selected optional extras, install/build frontend dependencies, detect `brew`/TDLib/ffmpeg/tesseract, and print exact installation commands for missing optional capabilities. Do not install Homebrew or system packages without explicit user action.

- [ ] **Step 3: Implement the double-click launcher**

Resolve its own directory without relying on the caller's current directory, start Uvicorn at `127.0.0.1:8765`, wait on `/api/health`, open the browser, keep logs free of content/secrets, and shut down the child process when the terminal closes.

- [ ] **Step 4: Write operator documentation**

Document `api_id`/`api_hash` creation, TDLib prerequisites, setup, launch, first authorization, model installation, storage/privacy behavior, supported formats, protected-content/Secret Chat limitations, backup/cleanup, and troubleshooting.

- [ ] **Step 5: Run the end-to-end local smoke check**

Run:

```bash
cd telegram-search
./scripts/smoke-local.sh
```

Expected: builds the UI, initializes a temporary database, starts the server on loopback, verifies origin rejection and session-token enforcement, imports mock messages/media, runs classification, returns filtered search results, serves the SPA, stops the server, and removes temporary data.

- [ ] **Step 6: Inspect the final diff and secrets**

Run:

```bash
git diff --check
git status --short
rg -n --hidden --glob '!**/.venv/**' --glob '!**/node_modules/**' '(api_hash|phone_number|auth_code|BEGIN .*PRIVATE KEY)' telegram-search
```

Expected: no whitespace errors; only intentional configuration field names/examples are found; no credentials, session databases, downloaded models, media caches, or generated build outputs are tracked.

- [ ] **Step 7: Commit the local distribution**

```bash
git add telegram-search
git commit -m "feat: deliver local Telegram sensitive search"
```
