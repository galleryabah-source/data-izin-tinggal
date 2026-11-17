# RPC Gateway Authentication Design — INTAL

Date: 2026-11-17
Status: design contract only; not deployed and not an implementation claim.

## 1. Security boundary

Apps Script google.script.run calls are direct RPC entry points. A browser-side token, hidden button, route guard, or generic client wrapper is not an authorization boundary. Every protected server endpoint must validate the authenticated principal and authorize the requested capability before reading or mutating application data.

The current P0 branch uses Session.getActiveUser().getEmail() plus USERS and PERMISSIONS. The RPC audit did not find Gateway token transport in the current browser adapter. This document does not claim that a Gateway currently exists.

## 2. Target request lifecycle

1. User authenticates through the approved identity provider / Gateway.
2. Gateway issues a short-lived signed access token after validating the identity and account status.
3. Browser sends the token with each protected RPC request through an explicit server-call contract.
4. Server validates signature against pinned issuer/key material, issuer, audience, algorithm allowlist, expiry (exp), not-before (nbf), issued-at (iat) policy, and token identifier (jti).
5. Server resolves immutable subject to an active INTAL user and current role/permissions. Token claims must not be the sole source of current permissions.
6. Server checks endpoint manifest capability and resource scope; deny by default.
7. Mutations use idempotency, lock/transaction boundary, audit correlation, and re-check authorization immediately before the write.
8. Responses return a normalized unauthenticated/forbidden error without exposing token contents or account existence.

## 3. Token policy

- Access token lifetime target: 5 minutes; configurable only by reviewed server policy.
- Clock skew: at most 60 seconds.
- Refresh token: never passed to Apps Script RPC and never stored in script properties or spreadsheet cells.
- Token storage: prefer memory-only browser storage; avoid localStorage/sessionStorage for bearer credentials.
- Revocation: check active user state and a server-side jti/session revocation record on every protected request, or use a versioned session epoch with a bounded cache. Do not rely on JWT expiry alone for account disablement.
- Key rotation: kid allowlist, overlapping verification keys during rotation, emergency key revocation procedure.
- Never log raw access/refresh tokens, authorization headers, passwords, or signing secrets.

## 4. RBAC binding

- Token sub maps to one immutable internal user identity.
- Resolve current USERS.status, role, and PERMISSIONS on the server for every protected RPC (or a bounded cache with explicit invalidation).
- Require exact capability match from RPC_MANIFEST_V1.
- Resource scope (office/dataset) must be independently checked; role membership alone is insufficient.
- backoffice.access remains a role gate and must not be converted into a client claim.
- Public TV is a separate anonymous read-only surface and must not receive a general-purpose authenticated bypass.

## 5. RPC migration strategy

- Do not attempt blanket token injection into dynamic google.script.run calls.
- Select one read-only pilot endpoint and migrate its complete path: browser callsite, token acquisition, server verifier, manifest enforcement, RBAC resolution, error handling, telemetry, and negative tests.
- Keep all other endpoints on their existing guard until their own migration is complete.
- Do not add a dispatcher-only check while direct top-level Apps Script functions remain callable.
- Do not add permissive compatibility fallbacks such as if token missing, use legacy identity.
- Rollback must restore the previous protected call path without opening anonymous access.

## 6. Mandatory negative tests

- Missing token -> UNAUTHENTICATED.
- Malformed token, wrong signature, unknown kid, wrong issuer/audience/algorithm -> UNAUTHENTICATED.
- Expired token and future nbf beyond skew -> UNAUTHENTICATED.
- Revoked jti, disabled user, or stale session epoch -> UNAUTHENTICATED.
- Valid identity without required permission -> FORBIDDEN.
- Permission removed after token issuance -> FORBIDDEN on next request.
- Attempt to call unlisted RPC -> denied.
- Public TV allowlisted read-only endpoint -> only sanitized public projection.
- Public TV attempt to access protected endpoint or mutation -> denied.
- Concurrent mutation/idempotency replay -> no duplicate effect and complete audit evidence.

## 7. Release gates

No pilot implementation until the repository confirms: approved identity provider and issuer, token signing/key-discovery contract, secure browser acquisition flow, Apps Script server-side verification feasibility, secret/key storage, revocation source, account-to-subject mapping, and representative browser callsites.

No production deployment or merge approval is implied by this design. Daily Input Gate 9.1 remains BLOCKED. Canonical monthly datasets and historical baselines remain out of scope.
