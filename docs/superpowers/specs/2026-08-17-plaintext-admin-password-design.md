# Plaintext Cloudflare Secret for Quiz Admin Password

## Goal

Simplify quiz-admin authentication by storing the chosen password as a plaintext Cloudflare Secret named `ADMIN_PASSWORD`. The password value remains outside source control, generated assets, browser storage, URLs, and logs.

## Design

- Replace `ADMIN_PASSWORD_HASH` and `ADMIN_PASSWORD_SALT` in the Worker environment with `ADMIN_PASSWORD`.
- Compare the submitted password with `ADMIN_PASSWORD` using a constant-time byte comparison.
- Keep `ADMIN_SESSION_SECRET` for signed eight-hour admin cookies.
- Keep `LOGIN_ATTEMPT_SALT` and the existing D1 rate limit unchanged.
- Update the secret helper and deployment documentation to require three production secrets: `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and `LOGIN_ATTEMPT_SALT`.
- Do not hardcode `1234` or any other password in tracked files. The user will set `ADMIN_PASSWORD=1234` directly through Wrangler.

## Error Handling and Migration

- Missing or empty `ADMIN_PASSWORD` is a server configuration error and must return the existing generic HTTP 500 response without exposing configuration details.
- Invalid passwords continue to return the generic HTTP 401 response and count toward the existing limit.
- Remove the obsolete `ADMIN_PASSWORD_HASH` and `ADMIN_PASSWORD_SALT` secrets from Cloudflare after the new deployment is verified.

## Verification

- Type-check and production build.
- Confirm the Worker lists the three required secret names without reading their values.
- Confirm login with the user-entered password succeeds, a wrong password fails, and authenticated question CRUD/cache invalidation still work.
