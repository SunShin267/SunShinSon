# Telegram Sensitive Content Search — Design

## Goal

Build a local-only web application for macOS that signs in to one Telegram user account, indexes content the account is permitted to access, classifies sensitive content locally, and presents searchable results with a link back to the original Telegram message.

The application is a separate local tool rather than part of the deployed SunShinSon games website. It performs read-only analysis and never deletes, hides, forwards, or otherwise modifies Telegram content.

## Scope

The first version supports:

- private chats, joined groups and channels, managed groups and channels, and public channels that the signed-in account can access;
- text, images, voice/audio, video, PDF, DOCX, XLSX, PPTX, and TXT attachments;
- sensitive-content labels for adult material, violence/gore, scams, gambling, controlled substances, and user-defined keywords or topics;
- keyword, metadata, and semantic search;
- filters for source, date, media type, category, and confidence;
- one Telegram account and one local macOS user.

The first version excludes archives, executables, specialist document formats, remote access, multi-user administration, automatic moderation, and exhaustive indexing of content that Telegram does not expose to the account.

Content suspected to depict sexual exploitation of minors is not indexed as searchable content and receives no thumbnail or preview.

## Architecture

The user opens a React/Vite dashboard in a browser at a loopback address. A Python FastAPI backend binds only to `127.0.0.1` and owns Telegram access, analysis jobs, local storage, and search APIs.

TDLib provides Telegram authorization, updates, history access, file downloads, and a local message cache. The backend uses TDLib's JSON interface so the Telegram integration remains isolated behind a small adapter.

SQLite stores normalized message metadata, analysis status, labels, scores, extracted text, and job checkpoints. SQLite FTS provides exact and fuzzy text retrieval. A local vector index provides semantic retrieval without sending content to an external service.

All classification runs locally. The analysis layer is split into adapters so individual models and extractors can be replaced without changing Telegram synchronization or the UI.

## Data Flow

1. The user configures a Telegram `api_id` and `api_hash`, then completes Telegram authorization in the local dashboard.
2. The source picker lists chats and allows selected public sources to be added when Telegram makes them accessible.
3. A resumable synchronization job imports message metadata and text before downloading media.
4. Media is downloaded only when it is eligible under the configured source, size, and retention limits.
5. Extractors process each supported format:
   - text and captions are normalized directly;
   - images pass through OCR and image classifiers;
   - audio and voice messages are transcribed;
   - videos are transcribed and sampled for representative frames;
   - documents use native text extraction first and OCR when necessary.
6. Rules and local models produce category scores plus human-readable match evidence.
7. Extracted text and labels are indexed. Duplicate files are skipped using a content hash.
8. The search API returns metadata, evidence, confidence, a safe preview when permitted, and an action to open the original message in Telegram.

## Search and Classification

Classification combines deterministic keyword/regular-expression rules with local semantic and media models. Each category has an adjustable threshold. Results retain the detector version so items can be reprocessed after model or rule changes.

The UI distinguishes a model prediction from a confirmed fact and supports false-positive feedback stored locally. User-defined rules can include keywords, regular expressions, exclusions, languages, and per-source thresholds.

## Security and Privacy

- The HTTP service binds to loopback only and rejects unexpected `Origin` headers.
- A random per-run session token protects local state-changing endpoints.
- Telegram credentials, session secrets, and database encryption keys are stored in macOS Keychain or an encrypted local secret store.
- Telegram content is never sent to a cloud AI service.
- Network access is limited to Telegram and explicit model downloads during setup.
- Temporary media follows configurable size and retention limits and is securely removed from the application's cache when expired.
- Protected Telegram content is handled according to Telegram restrictions; failure to download or copy it is surfaced explicitly.
- Secret Chat availability is device/session-dependent and is not guaranteed.
- Logs omit message bodies, credentials, authorization codes, and file contents.

## Failure Handling

Synchronization and analysis are separate resumable job queues. Telegram flood-wait responses pause only the affected synchronization work. Crashes and restarts resume from persisted checkpoints. Unsupported, protected, corrupt, oversized, or unavailable files receive visible status values instead of being silently skipped.

Low disk space pauses downloads and analysis before existing user data is endangered. Model-load failures degrade to the detectors that remain available and are shown in the dashboard.

## User Interface

The dashboard contains four primary views:

- **Setup:** Telegram credentials, authorization, local models, storage limits, and retention.
- **Sources:** searchable chat/channel list, selected scan scope, and synchronization status.
- **Search:** query, category chips, source/date/type/confidence filters, result cards, evidence, and open-in-Telegram action.
- **Jobs and settings:** progress, failures, model/rule versions, custom categories, storage usage, and cache cleanup.

Sensitive previews are blurred by default and revealed only by an explicit user action.

## Delivery and Verification

The repository will provide a local setup command and a macOS `.command` launcher that starts the backend and dashboard and opens the browser. No Apple Developer account is required.

Per the user's request, the implementation will not add a dedicated automated test suite. Delivery verification is limited to dependency installation, static/type checks where available, database initialization, backend health, dashboard startup, loopback-only binding, and a manual smoke path using mock/local fixture data rather than the user's private Telegram content.

## Completion Criteria

The first version is complete when a macOS user can configure Telegram credentials, authorize one account, choose accessible sources, run a resumable scan, search locally across supported formats and categories, understand why each result matched, and open the original Telegram message without any content being sent to an external AI service.
