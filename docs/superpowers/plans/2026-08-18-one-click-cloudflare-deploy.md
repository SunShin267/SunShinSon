# One-click Cloudflare Deploy Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an executable macOS command file that deploys the current checkout to the configured Cloudflare Worker with one double-click.

**Architecture:** A root-level POSIX shell script resolves its own project directory, validates local tools and Wrangler authentication, installs dependencies, and delegates build/deployment to the existing `deploy:cloudflare` npm script. It contains no Git, D1 migration/seed, or secret mutation behavior.

**Tech Stack:** POSIX shell, npm, Wrangler, Vinext, macOS `.command`

## Global Constraints

- Do not perform a production deployment while verifying this implementation.
- Do not commit, push, migrate/seed D1, or modify Cloudflare secrets from the command file.
- Reuse the existing `npm run deploy:cloudflare` script as the only deployment entry point.

---

### Task 1: Create the Production Deploy Command

**Files:**
- Create: `Deploy Production.command`

**Interfaces:**
- Consumes: `node`, `npm`, authenticated Wrangler session, and package script `deploy:cloudflare`.
- Produces: executable macOS command file with clear success/failure output.

- [ ] **Step 1: Create the command file**

Use `#!/bin/sh`, a reusable pause function, and `cd -- "$(dirname -- "$0")"`. Check `node` and `npm`, run `npm install`, run `npx wrangler whoami`, then run `npm run deploy:cloudflare`. Print the production URL only after a successful deployment, and wait for Enter before closing on both success and failure.

- [ ] **Step 2: Make the command executable**

Run:

```bash
chmod +x "Deploy Production.command"
```

- [ ] **Step 3: Verify without deploying**

Run:

```bash
sh -n "Deploy Production.command"
test -x "Deploy Production.command"
rg -n "git (commit|push)|db:migrate|db:seed|secret (put|delete)" "Deploy Production.command"
```

Expected: syntax and executable checks exit 0; the restricted-operation scan returns no matches.

- [ ] **Step 4: Commit**

```bash
git add "Deploy Production.command"
git commit -m "Add one-click Cloudflare deployment command"
```
