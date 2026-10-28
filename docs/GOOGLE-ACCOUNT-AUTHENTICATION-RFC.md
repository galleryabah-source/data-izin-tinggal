# Google Account Authentication Architecture (RFC)

Status: proposed design; not a production authentication implementation.

## Context

The Apps Script web app currently uses `Session.getActiveUser().getEmail()` as its identity source while `gas/appsscript.json` configures the web app to execute as the deployer and allow anonymous access. For consumer Gmail accounts, and especially anonymous/deployer execution, this is not a dependable identity contract. The public unauthenticated `/exec` URL returning `UNAUTHENTICATED` does not establish how a signed-in user session behaves.

The app must accept personal Google accounts and Workspace accounts while preserving server-side authorization and keeping daily-input staging separate from canonical monthly data.

## Decision

Use Google Identity Services for sign-in, but do not treat a browser-supplied email, profile, or unverified JWT as identity. Put token verification behind a trusted server-side authentication boundary. The preferred production implementation is a small HTTPS identity/session gateway (for example, Cloud Run) that verifies Google ID tokens and issues short-lived application sessions. Apps Script must validate each session through a trusted server-to-server boundary before executing protected operations. The gateway must not expose service credentials to the browser.

This adds infrastructure; do not silently substitute an email field, Apps Script `Session.getActiveUser()`, or Google's `tokeninfo` debugging endpoint for production token verification.

## Identity and authorization contract

1. Browser obtains an ID token through Google Identity Services using the configured OAuth client ID.
2. Gateway verifies token signature and claims: `iss`, `aud` (exact configured client ID), `exp`, `iat`, and non-empty stable `sub`. Require HTTPS and reject malformed, expired, wrong-audience, wrong-issuer, or invalid-signature tokens. Use Google's published keys and honor key rotation.
3. Use `sub` as the stable Google identity key. Treat email as a mutable attribute; require `email_verified === true` when email is used for display or account matching.
4. Match the verified identity to the application's `USERS` registry. Only `ACTIVE` users are allowed. No self-service account creation or automatic privilege assignment.
5. Resolve permissions from the existing `PERMISSIONS` table on the server for each protected operation. Never trust role/permission values supplied by the browser.
6. Issue a short-lived, revocable session. Prefer an HttpOnly, Secure, SameSite cookie when the architecture supports it; otherwise use a short-lived bearer session with strict origin/CSRF controls and never put tokens in URLs or logs. Bind session audience and purpose. Rotate/revoke sessions on logout, account disablement, and role changes.
7. Apps Script validates the session before reading or mutating protected data. If that cannot be achieved securely within Apps Script's browser-to-server and deployment constraints, put the protected API behind the gateway rather than accepting an unverified browser token.

## Apps Script deployment constraints

- `USER_DEPLOYING` centralizes spreadsheet access under the deploying account but means `Session.getActiveUser().getEmail()` may be blank in some contexts.
- `ANYONE_ANONYMOUS` does not itself authenticate a Google user. It must not be considered an access-control layer.
- Do not switch to `USER_ACCESSING` as a shortcut without reviewing spreadsheet permissions, OAuth scopes, user consent, and the intended centralized data model.
- Keep public TV routes explicitly read-only and separately reviewed; no protected RPC may be reachable without server-side authorization.
- Never log ID tokens, access tokens, session secrets, or raw authorization headers.

## Existing application integration

- Preserve the existing `USERS`, `ROLES`, and `PERMISSIONS` authorization model; add a stable identity mapping (e.g. `auth_provider`, `provider_subject`) through a reviewed schema migration rather than repurposing password columns.
- Inventory all public Apps Script functions and `google.script.run` entry points. Every data read/write must enforce authorization in the server function itself; page-level checks are only UX.
- Review `doGet`, `getDailyBootstrap`, import/export, administration, reporting, TV routes, and all daily-input endpoints.
- Do not change canonical monthly datasets, dataset registry identity, historical baselines, or daily staging as part of authentication work.

## Required security tests

- No token / malformed token / invalid signature / wrong issuer / wrong audience / expired token / future-issued token.
- Missing or unverified email; stable `sub` mismatch; account not registered; account inactive.
- Revoked session; expired session; replay; logout; role/permission revoked mid-session.
- Direct invocation of every protected server endpoint without a valid session.
- Operator attempts admin functions; viewer attempts writes; anonymous caller attempts daily input.
- CSRF/origin controls for cookie sessions; CORS and allowed origins for gateway APIs.
- Regression assertions: auth failures cause no spreadsheet writes; canonical monthly dataset row counts and totals remain unchanged; daily staging remains separate.

## Rollout gates

1. Inventory all server entry points and document public/read-only exceptions.
2. Decide the identity gateway host, OAuth client ID, allowed web origins, and secret ownership.
3. Implement gateway and session validation in an isolated branch; do not weaken authorization while migrating.
4. Add unit and integration tests, including token negative cases and direct RPC tests.
5. Deploy to a test deployment and verify with personal Gmail and an administrator account.
6. Roll out only after evidence is captured. Do not claim authentication is fixed based on a successful frontend sign-in alone.

## Open deployment prerequisites

- A controlled HTTPS gateway runtime and ownership of its deployment.
- Google Cloud project and OAuth Web client ID with exact authorized origins.
- A private server-to-server verification mechanism between Apps Script and the gateway.
- An account migration policy mapping existing `USERS.email` rows to verified Google `sub` values.
- A documented recovery procedure for administrator access.

Until these prerequisites and tests exist, keep protected operations fail-closed. This RFC alone does not change production authentication or deployment configuration.
