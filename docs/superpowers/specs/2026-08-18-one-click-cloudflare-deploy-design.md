# One-click Cloudflare Deploy Command

## Goal

Provide a macOS command file that deploys the current project checkout to the configured Cloudflare Worker when double-clicked.

## Design

- Add `Deploy Production.command` at the project root.
- Resolve the project directory from the command file's own location so it works regardless of the terminal's initial directory.
- Require `node` and `npm`, install project dependencies, verify Wrangler authentication, and run the existing `npm run deploy:cloudflare` script.
- On success, print the production URL and wait for Enter before closing so the result remains visible.
- On failure, print a focused error and wait for Enter before exiting with a non-zero status.
- Do not commit, push, migrate D1, seed D1, modify secrets, or alter GitHub Pages. Those operations remain explicit and separate.

## Verification

- Validate shell syntax with `sh -n`.
- Confirm the file is executable.
- Inspect the command flow without performing a production deployment as part of implementation verification.
