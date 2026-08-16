# Plaintext Admin Password Secret Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PBKDF2 admin-password verification with a plaintext Cloudflare Secret named `ADMIN_PASSWORD`, while retaining signed sessions and D1 login throttling.

**Architecture:** The Worker reads the password only from its runtime environment and compares UTF-8 bytes in constant time. Session signing and the hashed client-key rate limiter remain independent and unchanged. Production migration sets the new secret before deployment, verifies authenticated CRUD, then removes the obsolete hash and salt secrets.

**Tech Stack:** TypeScript, Cloudflare Workers, Web Crypto, Wrangler, D1, Vinext

## Global Constraints

- Never hardcode `1234` or any other password in tracked files.
- Never print, log, commit, or send the value of `ADMIN_PASSWORD` through chat.
- Keep `ADMIN_SESSION_SECRET` and `LOGIN_ATTEMPT_SALT` unchanged.
- Do not add or run automated tests; use type-check, build, static review, and production smoke checks.

---

### Task 1: Replace Password Hash Verification

**Files:**
- Modify: `worker/env.ts`
- Modify: `worker/admin-auth.ts`
- Modify: `scripts/generate-admin-secrets.mjs`
- Modify: `docs/superpowers/plans/2026-08-16-cloudflare-d1-quiz-admin.md`

**Interfaces:**
- Consumes: Cloudflare runtime secret `ADMIN_PASSWORD: string`.
- Produces: existing `handleAdminLogin(request, env)` behavior with plaintext-secret verification; secret helper output for `ADMIN_SESSION_SECRET` and `LOGIN_ATTEMPT_SALT` only.

- [ ] **Step 1: Change the Worker environment contract**

Replace `ADMIN_PASSWORD_HASH` and `ADMIN_PASSWORD_SALT` in `Env` with:

```ts
ADMIN_PASSWORD: string;
```

- [ ] **Step 2: Replace PBKDF2 verification**

Remove PBKDF2 decoding/derivation from `worker/admin-auth.ts`. Encode both submitted password and `env.ADMIN_PASSWORD` with the existing `TextEncoder`, then pass the byte arrays to `constantTimeEqual`. Treat an empty configured password as an unexpected configuration error rather than a valid credential.

- [ ] **Step 3: Simplify the secret helper**

Change `scripts/generate-admin-secrets.mjs` so it no longer reads a password or prints password hash/salt. Generate and print only fresh base64url values for:

```text
ADMIN_SESSION_SECRET
LOGIN_ATTEMPT_SALT
```

The script must explicitly state that `ADMIN_PASSWORD` is set separately with `wrangler secret put` without echoing its value.

- [ ] **Step 4: Update deployment documentation**

Replace the four-secret instructions with exactly:

```text
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
LOGIN_ATTEMPT_SALT
```

Document that the obsolete `ADMIN_PASSWORD_HASH` and `ADMIN_PASSWORD_SALT` are removed only after successful login verification.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npx tsc --noEmit --incremental false
npm run build
node --check scripts/generate-admin-secrets.mjs
git diff --check
```

Expected: every command exits 0 and the build prints `Build complete.`

Commit:

```bash
git add worker/env.ts worker/admin-auth.ts scripts/generate-admin-secrets.mjs docs/superpowers/plans/2026-08-16-cloudflare-d1-quiz-admin.md
git commit -m "Use plaintext Cloudflare secret for admin password"
```

---

### Task 2: Migrate Production Secret and Verify Admin CRUD

**Files:**
- No tracked source changes expected.
- Update report: `.superpowers/sdd/2026-08-16-cloudflare-d1-quiz-admin/task-8-report.md`

**Interfaces:**
- Consumes: Task 1 Worker build and user-authorized Cloudflare account.
- Produces: deployed Worker accepting `ADMIN_PASSWORD`, verified authenticated admin session and CRUD/cache invalidation.

- [ ] **Step 1: Set the plaintext password without exposing it**

Run from an interactive user terminal:

```zsh
read -s "ADMIN_PASSWORD?Admin password: "
echo
printf %s "$ADMIN_PASSWORD" | npx wrangler secret put ADMIN_PASSWORD
unset ADMIN_PASSWORD
```

Expected: Wrangler confirms the secret was uploaded without printing its value.

- [ ] **Step 2: Deploy the new Worker**

Run:

```bash
npm run deploy:cloudflare
```

Expected: deployment succeeds at `https://sunshinson.phanthanhtai-cmu-fd4.workers.dev`.

- [ ] **Step 3: Clear the diagnostic lock record**

Run:

```bash
npx wrangler d1 execute DB --remote --config wrangler.jsonc --command "DELETE FROM admin_login_attempts"
```

Expected: D1 reports success.

- [ ] **Step 4: Verify authenticated behavior**

In `/admin`, sign in with the user-entered password. Add one clearly temporary question, edit it, hide/show it, and delete it. Confirm `/api/questions` remains at 180 after deletion and reflects status changes after cache invalidation.

- [ ] **Step 5: Remove obsolete secrets**

After Step 4 succeeds, run:

```bash
npx wrangler secret delete ADMIN_PASSWORD_HASH
npx wrangler secret delete ADMIN_PASSWORD_SALT
npx wrangler secret list
```

Expected: only `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and `LOGIN_ATTEMPT_SALT` remain among admin-auth secrets.

- [ ] **Step 6: Record deployment evidence**

Update the existing SDD report with the deployment version, non-secret secret-name list, successful login/CRUD results, and confirmation that no credential value was stored or printed.
