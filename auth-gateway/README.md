# INTAL Google Authentication Gateway (scaffold)

This directory is an isolated Vercel Node.js project for the first server-side authentication boundary. It is deliberately **not yet connected to the production Apps Script RPC layer** and must not be treated as a completed login system.

## Endpoints

- `POST /api/auth/google-login`: accepts a Google Identity Services ID token in `{ "credential": "..." }`, verifies it with Google's published keys through `google-auth-library`, requires a verified email, requires the stable Google `sub` to be enrolled, and returns a 15-minute signed application session.
- `POST /api/auth/verify-session`: internal verification endpoint. Requires `x-intal-gateway-key` and `{ "sessionToken": "..." }`; verifies signature, issuer, audience, purpose and expiry.

Responses are marked `Cache-Control: no-store`. Failure responses do not expose token or verification details. Tokens must never be logged or placed in URLs.

## Required Vercel environment variables

Configure these as server-side secrets/settings; do not commit values:

- `GOOGLE_OAUTH_CLIENT_ID`: OAuth 2.0 Web client ID from a Google Cloud project.
- `ALLOWED_WEB_ORIGINS`: comma-separated exact HTTPS origins allowed to call the login endpoint; no wildcard.
- `AUTHORIZED_GOOGLE_SUBJECTS`: comma-separated stable Google `sub` values approved by the application owner. Do not enroll users based only on email.
- `APP_SESSION_SIGNING_SECRET`: high-entropy random secret (at least 32 random bytes).
- `APP_SESSION_ISSUER`: exact HTTPS gateway issuer URL.
- `GAS_GATEWAY_SHARED_SECRET`: separate high-entropy secret shared only with Apps Script Script Properties for server-to-server verification.

If configuration is missing, the endpoints fail closed. Use separate secrets per environment and rotate them through a documented process.

## Deployment steps

1. Create a Google Cloud project and OAuth 2.0 **Web application** client.
2. Add only the exact gateway/browser origins and authorized JavaScript origins needed by the selected deployment.
3. Create a Vercel project linked to this repository with Root Directory set to `auth-gateway`; deploy a preview first.
4. Configure all environment variables above. Enroll approved `sub` values only after identity has been independently confirmed.
5. Test invalid, expired, wrong-audience, unverified-email, un-enrolled-subject, missing-secret, wrong-origin, wrong-service-key and expired-session cases.
6. Only after those tests pass, implement the Apps Script integration so **every protected RPC** sends the browser session token to a server-side validation seam and validates it before existing RBAC checks. Resolve the verified `sub` to an active `USERS` record and fetch permissions from the authoritative server-side registry for each protected request.
7. Keep public TV methods on an explicit read-only allowlist. Do not trust roles or permissions in the session/browser payload.

## Important integration gate

Apps Script's existing `google.script.run` calls do not automatically forward a gateway cookie or bearer token to every server function. Therefore this gateway scaffold alone does not authenticate existing Apps Script calls. Do not switch `appsscript.json` access mode, weaken guards, merge to `main`, or deploy this as a completed fix until the RPC/session bridge and end-to-end tests are implemented.

The integration must preserve the canonical monthly dataset and the separate daily-input staging store. Authentication failures must result in zero writes to either store.
