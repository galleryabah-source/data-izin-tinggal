# Authentication rollout gate checklist

Current status: **BLOCKED — isolated gateway/helper tests pass, but protected RPCs still use the legacy identity path.**

## Evidence
- Gateway unit tests cover session JWT validation.
- Apps Script test shim covers mocked Google subject mapping, permission lookup, missing/expired identity, duplicate subject, upstream failure, and missing gateway configuration.
- Apps Script validation passed for commit `c14fd8fbcf1509d1a81112c679ccd29bd0b1a278`; its deploy job was skipped.
- These tests do not establish end-to-end production login.

## Required before rollout
- [ ] Exhaustive inventory of every globally callable Apps Script function and alternate entry point.
- [ ] Explicit public/protected RPC allowlists; unknown functions rejected by the browser adapter.
- [ ] Browser Google Identity Services flow with configured OAuth Web Client ID and exact HTTPS origins.
- [ ] In-memory session-token lifecycle only; no localStorage/sessionStorage, URL, or logs.
- [ ] Every protected RPC accepts a token and invokes server-side verification before protected reads or side effects.
- [ ] Pass validated identity explicitly to internal helpers; no silent fallback to `Session.getActiveUser()`.
- [ ] Resolve current server-side `PERMISSIONS` for each request; revocation applies on the next request.
- [ ] Keep public TV endpoints separate, read-only, sanitized, and unable to accept elevated identity.
- [ ] Complete verified `google_sub` enrollment for each authorized user using separate identity proofing.
- [ ] Negative end-to-end tests prove anonymous/invalid sessions cannot read protected data or write any sheet.
- [ ] Positive end-to-end tests prove authorized role-specific flows work.
- [ ] Confirm canonical registry identity, row counts, and monthly totals are unchanged before and after auth tests.
- [ ] Owner securely provisions `GOOGLE_OAUTH_CLIENT_ID`, `ALLOWED_WEB_ORIGINS`, `AUTHORIZED_GOOGLE_SUBJECTS`, `APP_SESSION_SIGNING_SECRET`, `APP_SESSION_ISSUER`, and `GAS_GATEWAY_SHARED_SECRET`.
- [ ] Verify deployment target and rollback plan; deploy only after CI and owner-approved UAT.

## Rollout decision
Do not merge or deploy this branch as a completed production authentication fix while any item above remains open. Authentication work must not rewrite canonical monthly datasets. Daily operational data remains in its separate staging store.
